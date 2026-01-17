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
    You are an expert Dubbing Director.
    
    TARGET LANGUAGE: ${targetLanguage}
    
    TASK:
    1. Listen to the audio content.
    2. Transcribe and translate strictly into ${targetLanguage} (Native Script).
    3. Analyze the specific tone/emotion of EACH individual sentence.
    
    FORMAT:
    [Emotion] Spoken text...
    [Emotion] Spoken text...

    EMOTION LIST (Use variety):
    [Happy], [Excited], [Sad], [Serious], [Urgent], [Calm], [Curious], [Sarcastic], [Warm], [Whisper], [Shout], [Professional], [Dramatic].

    CRITICAL RULES:
    - DETECT VARIETY: Do NOT use the same emotion tag (e.g. [Serious]) for the whole script. 
    - Listen for pitch, speed, and volume changes to assign specific tags.
    - Start EVERY sentence with a tag.
    - No Speaker labels.
    - No Romanized text.
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
        config: {
          systemInstruction: `You are a dynamic script writer. You HATE monotony. You always find specific emotional nuances in speech. You never output Romanized text.`,
          thinkingConfig: { thinkingBudget: 1024 }
        }
      });
      
      if (!response.text) {
          throw new Error("Model returned empty text.");
      }

      return response.text.trim();
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
  
  const prompt = `
    I need a dubbing script for the video found at this URL: ${url}
    
    TARGET LANGUAGE: ${targetLanguage}
    
    INSTRUCTIONS:
    1. Find the content.
    2. Translate it strictly into ${targetLanguage}.
    3. Infer the intended emotion for each line based on context.
    
    FORMAT:
    [Emotion] Spoken text...
    [Emotion] Spoken text...
    
    RULES:
    - Use varied emotions (e.g. [Curious], [Excited], [Serious], [Warm]).
    - Do NOT default to [Neutral] for everything.
    - No Speaker names.
    - Native script only.
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
      
      if (!text || text.length < 50) {
          return `[Neutral] (Could not automatically extract dialogue. Please type the ${targetLanguage} script here manually.)\n\n${text}`;
      }

      // Clean up markdown
      text = text.replace(/^#.*\n/gm, '').replace(/\*\*.*?\*\*/g, '').trim();

      return text;
  } catch (err) {
      console.error("URL Extraction Error:", err);
      throw new Error("Failed to extract script from URL.");
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

  // Strip emotion tags for the TTS engine
  const cleanScript = script
    .replace(/\[.*?\]/g, '') 
    .replace(/\(.*?\)/g, '')
    .trim();

  const ttsPrompt = `
    Say the following text in a ${voice.style} tone.
    Language: Detect from text (ensure native pronunciation).
    
    Text:
    ${cleanScript}
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