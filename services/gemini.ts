import { GoogleGenAI } from "@google/genai";
import { VoiceConfig } from "../types";

// Helper to get AI instance safely
const getAI = () => {
  // @ts-ignore - Handle potential process not defined in some browser environments
  const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;
  if (!apiKey) {
    console.error("API Key is missing from process.env.API_KEY");
  }
  return new GoogleGenAI({ apiKey: apiKey || 'MISSING_KEY' });
};

export const extractScriptFromVideo = async (
  videoBase64: string,
  mimeType: string,
  targetLanguage: string
): Promise<string> => {
  const ai = getAI();
  const prompt = `
    You are an expert dubbing script writer. Your task is to translate the spoken dialogue from this video into ${targetLanguage}.

    CRITICAL INSTRUCTIONS:
    1. **Strict Fidelity**: Translate ONLY what is actually spoken.
    2. **Match Duration**: The translated sentences should take roughly the same amount of time to speak as the original. Do not be overly concise if the original speaker talks slowly or at length.
    3. **Natural Flow**: Use a conversational, human tone.
    4. **No Hallucinations**: Do not invent dialogue for silent parts.

    Output Structure:
    1. Identify the global "Style" (e.g., Documentary, Vlog, Dramatic).
    2. List the dialogue line-by-line with [Emotion] tags.

    Output Format:
    STYLE: [Insert Style Here]
    
    [Emotion] Translated Line 1
    [Emotion] Translated Line 2
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
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

  return response.text || "No script extracted.";
};

export const extractScriptFromUrl = async (
  url: string,
  targetLanguage: string
): Promise<string> => {
  const ai = getAI();
  const prompt = `
    I need the dubbing script for the video at: ${url}
    
    Target Language: ${targetLanguage}

    CRITICAL INSTRUCTIONS:
    1. Extract ONLY the spoken dialogue.
    2. Translate to ${targetLanguage} keeping it casual and natural.
    3. **DURATION MATCHING**: Ensure the translation length matches the original speech duration. If the original is wordy, the translation should be wordy. If short, keep it short.
    4. Do not add intro/outro text.

    Output Format:
    STYLE: [Insert Style Here]

    [Emotion] Line 1...
  `;

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

  return response.text || "No script extracted from URL.";
};

export const generateVoiceOver = async (
  script: string,
  voice: VoiceConfig
): Promise<string> => {
  const ai = getAI();
  
  if (!script || script.trim() === "") {
      throw new Error("Script is empty. Cannot generate voiceover.");
  }

  // 1. Extract Style
  const styleMatch = script.match(/STYLE:\s*(.*)/i);
  const detectedStyle = styleMatch ? styleMatch[1].trim() : "Neutral";

  // 2. Process Script for TTS:
  // - Remove STYLE header
  // - Remove [Emotion] tags from spoken text entirely so they aren't read aloud.
  let ttsReadyScript = script
    .replace(/STYLE:.*\n?/i, '')
    .replace(/\[.*?\]/g, '') // Remove all [Tags]
    .replace(/\(.*?\)/g, '') // Remove all (Tags)
    .trim();

  // 3. Construct prompt
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
      responseModalities: ['AUDIO'], 
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice.id },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (!base64Audio) {
    throw new Error("Failed to generate audio: No audio data returned from API.");
  }

  return base64Audio;
};