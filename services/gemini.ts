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
    You are an expert Dubbing Director and Native Translator.
    
    TARGET LANGUAGE: ${targetLanguage}
    
    TASK:
    1. Listen to the audio content.
    2. Transcribe and translate strictly into ${targetLanguage}.
    3. CRITICAL: The translation must sound 100% NATURAL and AUTHENTIC to a native speaker. Do NOT provide a literal, robotic translation. Use colloquialisms and natural phrasing where appropriate.
    4. Analyze the specific tone/emotion of EACH individual sentence.
    
    FORMAT:
    [Emotion] Spoken text...
    [Emotion] Spoken text...

    EMOTION LIST (Use variety):
    [Happy], [Excited], [Sad], [Serious], [Urgent], [Calm], [Curious], [Sarcastic], [Warm], [Whisper], [Shout], [Professional], [Dramatic].

    CRITICAL RULES:
    - OUTPUT ONLY THE SCRIPT. No introductory text, no "Here is the script", no markdown formatting (like **bold** or # headers) outside the lines.
    - DETECT VARIETY: Do NOT use the same emotion tag (e.g. [Serious]) for the whole script. 
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
          systemInstruction: `You are a professional subtitle and dubbing generator. You only output the final script. You do not chat. You do not add meta-commentary.`,
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
    3. CRITICAL: The translation must sound 100% NATURAL and AUTHENTIC to a native speaker. Avoid literal, robotic phrasing.
    4. Infer the intended emotion for each line based on context.
    
    FORMAT:
    [Emotion] Spoken text...
    [Emotion] Spoken text...
    
    RULES:
    - OUTPUT ONLY THE SCRIPT. No "Here is the translation" or conversational filler.
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
      // Remove any common AI chat preamble if it sneaked in
      text = text.replace(/^Here is the.*?:\n/i, '').trim();

      return text;
  } catch (err) {
      console.error("URL Extraction Error:", err);
      throw new Error("Failed to extract script from URL.");
  }
};

export const generateVoiceOver = async (
  script: string,
  voice: VoiceConfig,
  speed: string = 'Normal',
  accent: string = 'American'
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

  let speedInstruction = "";
  switch(speed) {
    case 'Slow':
      speedInstruction = "Speaking Rate: Slow (approx 0.8x). Speak slowly, clearly, and deliberately.";
      break;
    case 'Fast':
      speedInstruction = "Speaking Rate: Fast (approx 1.2x). Speak quickly, energetically, and efficiently.";
      break;
    case 'Normal':
    default:
      speedInstruction = "Speaking Rate: Normal. Speak at a natural, conversational pace.";
      break;
  }

  const ttsPrompt = `
    Generate audio for the following text.
    
    Configuration:
    - Voice Style: ${voice.style}
    - Accent/Dialect: ${accent}
    - ${speedInstruction}
    - Language: Detect from text (ensure native pronunciation).
    
    Text:
    "${cleanScript}"
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