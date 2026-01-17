import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceConfig } from "../types";

const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API Key is missing. Please check your Vercel Environment Variables.");
    }
    return new GoogleGenAI({ apiKey });
};

export const extractScriptFromVideo = async (
  videoBase64: string,
  mimeType: string,
  targetLanguage: string
): Promise<string> => {
  const ai = getAiClient();
  
  const prompt = `
    You are an expert dubbing script writer.
    
    TASK:
    1. Listen to the video audio carefully.
    2. Transcribe the spoken dialogue exactly.
    3. Translate it to ${targetLanguage}.
    
    FORMAT:
    STYLE: [Video Style, e.g. Vlog, News, Drama]
    
    [Emotion] Line of dialogue...
    [Emotion] Line of dialogue...
    
    RULES:
    - CRITICAL: Do NOT include speaker names, labels, or prefixes (e.g. "Narrator:", "Speaker 1:", "Man:").
    - Output ONLY the spoken text prefixed by the emotion tag.
    - Capture the nuance and timing implicitly by keeping sentences of similar length.
    - Do not output timestamps.
    - Do not hallucinate content for silence.
  `;

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: videoBase64,
              },
            },
            { text: prompt },
          ],
        },
      });
      
      if (!response.text) {
          throw new Error("Model returned empty text.");
      }

      return response.text;
  } catch (err: any) {
      console.error("Video Extraction Error:", err);
      if (err.message?.includes("413")) {
          throw new Error("Video file is too large for AI processing. Please use a smaller file (under 20MB).");
      }
      throw err;
  }
};

export const extractScriptFromUrl = async (
  url: string,
  targetLanguage: string
): Promise<string> => {
  const ai = getAiClient();
  
  // Robust prompt for URL grounding
  const prompt = `
    I need a dubbing script for the video found at this URL: ${url}
    
    Target Language: ${targetLanguage}
    
    INSTRUCTIONS:
    1. Use Google Search to find the transcript, caption text, or a detailed summary of the dialogue for this video.
    2. If exact dialogue is found, translate it.
    3. If only a summary is found, reconstruct a plausible script based on the summary.
    4. Output strictly in the requested format.
    
    FORMAT:
    STYLE: [Style of content]
    
    [Emotion] Line of dialogue...
    [Emotion] Line of dialogue...

    RULES:
    - CRITICAL: Do NOT include speaker names, labels, or prefixes (e.g. "Narrator:", "Speaker 1:", "Man:").
    - Output ONLY the spoken text prefixed by the emotion tag.
  `;

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { text: prompt },
          ],
        },
        config: {
          tools: [{ googleSearch: {} }],
        }
      });

      let text = response.text || "";
      
      // Fallback message if search failed to yield text
      if (!text || text.length < 50) {
          return `STYLE: Unknown\n\n[Neutral] (Could not extract exact dialogue from URL. Please manually type the script here based on the video.)\n\n${text}`;
      }

      // Append sources
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        const sources = groundingChunks
          .map((chunk: any) => chunk.web?.uri)
          .filter((uri: string) => uri)
          .map((uri: string) => `[Source: ${uri}]`)
          .join('\n');
        
        if (sources) {
          text += `\n\n${sources}`;
        }
      }

      return text;
  } catch (err) {
      console.error("URL Extraction Error:", err);
      throw new Error("Failed to extract script from URL. The video might be restricted or not indexed.");
  }
};

export const generateVoiceOver = async (
  script: string,
  voice: VoiceConfig
): Promise<string> => {
  const ai = getAiClient();
  
  if (!script || script.trim() === "") {
      throw new Error("Script is empty. Cannot generate voiceover.");
  }

  const styleMatch = script.match(/STYLE:\s*(.*)/i);
  const detectedStyle = styleMatch ? styleMatch[1].trim() : "Neutral";

  let ttsReadyScript = script
    .replace(/STYLE:.*\n?/i, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  // Guard against empty script after cleaning
  if (!ttsReadyScript) {
      ttsReadyScript = "Audio generation test.";
  }

  const ttsPrompt = `
    Speak the following text in a ${detectedStyle} tone.
    Speak naturally and clearly.
    
    Text:
    ${ttsReadyScript}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: ttsPrompt }] }],
    config: {
      responseModalities: [Modality.AUDIO], 
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice.id },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (!base64Audio) {
    throw new Error("Failed to generate audio. Please try again.");
  }

  return base64Audio;
};