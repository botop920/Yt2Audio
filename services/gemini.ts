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
    3. CRITICAL: If the audio is in a different language (e.g., Hindi, Urdu, English), you MUST translate it to ${targetLanguage}.
    4. CRITICAL: Do NOT use Romanized/Transliterated text (e.g. do not write Bengali in English letters). Use the native script of ${targetLanguage} only.
    5. Output ONLY the raw spoken text. 
       - No "Narrator:" or Speaker labels.
       - No [Emotion] tags.
       - No "Scene:" descriptions.
       - No timestamps.
       - No "Translation:" headers.
    6. Combine short fragments into coherent, natural sentences suitable for a voiceover.
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
          systemInstruction: `You are a strict translator. You only output text in ${targetLanguage}. You never output Romanized text for Asian languages.`,
          thinkingConfig: { thinkingBudget: 1024 } // Allow some thinking for better translation
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
    1. Use Google Search to find the transcript or content of this video.
    2. Translate the content strictly into ${targetLanguage}.
    3. CRITICAL: Do NOT use Romanized/Transliterated text. Use the native script of ${targetLanguage}.
    4. Output ONLY the raw spoken text. 
       - No "Narrator:" or Speaker labels.
       - No [Emotion] tags.
       - No timestamps.
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
          return `(Could not automatically extract dialogue. Please type the ${targetLanguage} script here manually.)\n\n${text}`;
      }

      // Clean up any potential markdown or headers that might have slipped through
      text = text.replace(/^#.*\n/gm, '').replace(/\*\*.*?\*\*/g, '').trim();

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

  // Since we stripped tags from the UI, we just use the raw script.
  // We inject the voice style into the prompt to guide the TTS model.
  const ttsPrompt = `
    Say the following text in a ${voice.style} tone.
    Language: Detect from text (ensure native pronunciation).
    
    Text:
    ${script}
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