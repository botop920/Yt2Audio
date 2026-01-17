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
    You are a professional translator and dubbing script writer.
    
    TARGET LANGUAGE: ${targetLanguage}
    
    INSTRUCTIONS:
    1. Listen to the audio content carefully.
    2. Translate the spoken dialogue strictly into ${targetLanguage}.
    3. CRITICAL: If the audio is in a different language, translate it to ${targetLanguage}.
    4. CRITICAL: Do NOT use Romanized/Transliterated text. Use the native script of ${targetLanguage} only.
    
    FORMAT:
    [Emotion] Spoken text...
    [Emotion] Spoken text...

    RULES:
    - START every sentence with an emotion tag in English (e.g. [Happy], [Sad], [Serious], [Excited]).
    - Do NOT use speaker labels (e.g. "Narrator:", "Man:").
    - Do NOT output timestamps.
    - Combine short fragments into coherent sentences.
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
          systemInstruction: `You are a strict translator. You only output text in ${targetLanguage} prefixed by [Emotion] tags. You never output Romanized text.`,
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
    1. Find the transcript or content.
    2. Translate it strictly into ${targetLanguage}.
    3. CRITICAL: Do NOT use Romanized text. Use native script.
    
    FORMAT:
    [Emotion] Spoken text...
    [Emotion] Spoken text...
    
    RULES:
    - Include [Emotion] tags at the start of lines.
    - No Speaker names.
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

  // Strip emotion tags for the TTS engine so it doesn't read "[Happy]" aloud
  // regex removes [Anything] and (Anything)
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