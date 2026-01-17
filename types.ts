export enum AppStep {
  UPLOAD = 0,
  SCRIPT_ANALYSIS = 1,
  VOICE_GENERATION = 2,
  PREVIEW_EXPORT = 3,
}

export interface ExtractedScript {
  originalText: string;
  formattedText: string;
}

export interface VoiceConfig {
  name: string;
  id: string; // 'Kore', 'Puck', 'Fenrir', 'Charon', 'Zephyr'
  gender: 'Male' | 'Female';
  style: string;
}

export const AVAILABLE_VOICES: VoiceConfig[] = [
  { name: 'Kore', id: 'Kore', gender: 'Female', style: 'Calm, Soothing' },
  { name: 'Puck', id: 'Puck', gender: 'Male', style: 'Energetic, Playful' },
  { name: 'Fenrir', id: 'Fenrir', gender: 'Male', style: 'Deep, Authoritative' },
  { name: 'Charon', id: 'Charon', gender: 'Male', style: 'Steady, Professional' },
  { name: 'Zephyr', id: 'Zephyr', gender: 'Female', style: 'Warm, Friendly' },
];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English (US)' },
  { code: 'bn', name: 'Bengali (Bangla)' },
  { code: 'es', name: 'Spanish' },
  { code: 'hi', name: 'Hindi' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'pt', name: 'Portuguese' },
];