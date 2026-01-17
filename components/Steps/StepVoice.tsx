import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic2, Sparkles, CheckCircle2, ArrowRight, RotateCcw, AlertCircle, Quote, ChevronDown, ChevronUp, Gauge, Globe2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { AVAILABLE_VOICES, VoiceConfig, SUPPORTED_ACCENTS } from '../../types';
import { generateVoiceOver } from '../../services/gemini';
import { base64ToUint8Array, createWavBlob, blobToUrl, formatTime } from '../../services/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface StepVoiceProps {
  script: string;
  onAudioGenerated: (base64Audio: string) => void;
  onBack: () => void;
}

const getEmotionColor = (tag: string) => {
  const t = tag.toLowerCase().replace(/[\[\]]/g, '');
  if (['happy', 'excited', 'joy', 'fun', 'cheerful', 'laugh'].some(k => t.includes(k))) {
    return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  }
  if (['sad', 'grief', 'cry', 'upset', 'depressed'].some(k => t.includes(k))) {
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
  if (['angry', 'shout', 'intense', 'furious', 'urgent', 'dramatic'].some(k => t.includes(k))) {
    return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
  }
  if (['fear', 'scared', 'nervous', 'worry'].some(k => t.includes(k))) {
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  }
  if (['calm', 'soothing', 'warm', 'gentle', 'whisper'].some(k => t.includes(k))) {
    return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
  }
  if (['curious', 'question', 'surprised'].some(k => t.includes(k))) {
    return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
  }
  return 'bg-zinc-700/50 text-zinc-300 border-zinc-600'; // Default/Serious/Neutral
};

// Advanced Script Display with Highlighted Emotions
const ScriptDisplay: React.FC<{ text: string }> = ({ text }) => {
  // Regex to capture [Emotion] tags
  const parts = text.split(/(\[.*?\])/g);

  return (
    <p className="text-zinc-300 text-sm md:text-base leading-relaxed font-light whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part.startsWith('[') && part.endsWith(']')) {
          const emotion = part.replace(/[\[\]]/g, '');
          const colorClass = getEmotionColor(emotion);
          return (
            <span 
              key={index} 
              className={`inline-flex items-center px-2 py-0.5 mx-1 rounded-md text-[10px] md:text-xs font-bold uppercase tracking-wider border align-middle transform -translate-y-px select-none shadow-sm ${colorClass}`}
            >
              {emotion}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
};

// Premium Waveform Player Component
const WaveformPlayer: React.FC<{ 
  src: string; 
  isPlaying: boolean; 
  onToggle: () => void;
}> = ({ src, isPlaying, onToggle }) => {
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
        if (isPlaying) onToggle(); 
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isPlaying, onToggle]);

  useEffect(() => {
    if (audioRef.current) {
        if (isPlaying) audioRef.current.play().catch(console.error);
        else audioRef.current.pause();
    }
  }, [isPlaying]);

  return (
    <div className="bg-black rounded-3xl p-4 md:p-6 ring-1 ring-white/10 shadow-xl flex items-center gap-4 md:gap-6 relative overflow-hidden group">
        <audio ref={audioRef} src={src} className="hidden" />
        
        <button 
            onClick={onToggle}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white hover:scale-105 active:scale-95 transition-all flex items-center justify-center shrink-0 z-10 shadow-lg shadow-white/10"
        >
            {isPlaying ? (
                <Pause className="w-5 h-5 md:w-6 md:h-6 text-black fill-black" />
            ) : (
                <Play className="w-5 h-5 md:w-6 md:h-6 text-black fill-black ml-1" />
            )}
        </button>

        <div className="flex-1 flex flex-col justify-center gap-2 z-10">
             <div className="h-8 md:h-10 flex items-center gap-1 opacity-80">
                {Array.from({ length: 30 }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="w-1 bg-zinc-600 rounded-full"
                        animate={{ 
                            height: isPlaying ? [10, Math.random() * 32 + 4, 10] : 8,
                            backgroundColor: isPlaying ? '#818cf8' : '#52525b' 
                        }}
                        transition={{ 
                            duration: 0.5, 
                            repeat: Infinity, 
                            delay: i * 0.05,
                            ease: "easeInOut" 
                        }}
                    />
                ))}
             </div>
             
             <div className="flex justify-between text-[10px] md:text-xs text-zinc-500 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration || 0)}</span>
             </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-50 pointer-events-none" />
    </div>
  );
};

export const StepVoice: React.FC<StepVoiceProps> = ({ script, onAudioGenerated, onBack }) => {
  const [selectedVoice, setSelectedVoice] = useState<VoiceConfig>(AVAILABLE_VOICES[0]);
  const [selectedSpeed, setSelectedSpeed] = useState<string>('Normal');
  const [selectedAccent, setSelectedAccent] = useState<string>('American');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAccentDropdownOpen, setIsAccentDropdownOpen] = useState(false);
  
  useEffect(() => {
    if (generatedAudio) {
       try {
           const cleanBase64 = generatedAudio.replace(/^data:audio\/\w+;base64,/, "");
           const pcmData = base64ToUint8Array(cleanBase64);
           const wavBlob = createWavBlob(pcmData, 24000); 
           const url = blobToUrl(wavBlob);
           setAudioUrl(url);
           return () => URL.revokeObjectURL(url);
       } catch (err) {
           console.error("Error processing audio data:", err);
           setErrorMsg("Failed to process generated audio.");
       }
    }
  }, [generatedAudio]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(10);
    setGeneratedAudio(null);
    setAudioUrl(null);
    setErrorMsg(null);
    setIsPlayingPreview(false);

    try {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 2;
        });
      }, 500);

      const base64 = await generateVoiceOver(script, selectedVoice, selectedSpeed, selectedAccent);
      
      clearInterval(interval);
      setProgress(100);
      
      setTimeout(() => {
        setIsGenerating(false);
        setGeneratedAudio(base64);
      }, 500);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "Failed to generate voiceover. Please try again.");
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleConfirm = () => {
    if (generatedAudio) {
        onAudioGenerated(generatedAudio);
    } else {
        setErrorMsg("No audio generated to confirm.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-6xl mx-auto space-y-6 md:space-y-8"
    >
      <div className="flex items-center justify-between px-1">
        <div>
           <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Voice Generation</h2>
           <p className="text-zinc-400 text-xs md:text-sm mt-1">Configure AI voice model & style.</p>
        </div>
        <Button variant="ghost" onClick={onBack} disabled={isGenerating} className="text-zinc-400 hover:text-white px-0 md:px-4">Back</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* Configuration Panel */}
        <div className="lg:col-span-12 space-y-6">
            
            {/* Voice Model Selection */}
            <div>
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                    <h3 className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Voice Model</h3>
                 </div>

                 <div className="relative z-50">
                    <button 
                        onClick={() => !isGenerating && setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl flex items-center justify-between hover:bg-zinc-800/80 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                                <Mic2 className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <p className="text-xs text-zinc-500 font-medium mb-0.5">Selected Model</p>
                                <h4 className="text-white font-semibold text-lg">{selectedVoice.name} <span className="text-zinc-500 font-normal text-sm ml-2">• {selectedVoice.gender}, {selectedVoice.style}</span></h4>
                            </div>
                        </div>
                        {isDropdownOpen ? <ChevronUp className="text-zinc-400" /> : <ChevronDown className="text-zinc-400" />}
                    </button>

                    <AnimatePresence>
                        {isDropdownOpen && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[60]"
                            >
                                {AVAILABLE_VOICES.map((voice) => (
                                    <div 
                                        key={voice.id}
                                        onClick={() => {
                                            setSelectedVoice(voice);
                                            setIsDropdownOpen(false);
                                        }}
                                        className={`p-4 flex items-center justify-between cursor-pointer transition-colors border-b border-white/5 last:border-0 ${
                                            selectedVoice.id === voice.id ? 'bg-primary/10' : 'hover:bg-zinc-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                                selectedVoice.id === voice.id ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-500'
                                            }`}>
                                                {voice.name[0]}
                                            </div>
                                            <div>
                                                <div className={`font-medium ${selectedVoice.id === voice.id ? 'text-primary' : 'text-zinc-200'}`}>
                                                    {voice.name}
                                                </div>
                                                <div className="text-xs text-zinc-500">{voice.gender} • {voice.style}</div>
                                            </div>
                                        </div>
                                        {selectedVoice.id === voice.id && <CheckCircle2 className="w-5 h-5 text-primary" />}
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Split Row: Pace & Accent */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Speaking Pace */}
                <div>
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <Gauge className="w-3.5 h-3.5 text-zinc-500" />
                        <h3 className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest">Speaking Pace</h3>
                    </div>
                    
                    <div className="bg-zinc-900/50 p-1.5 rounded-xl border border-white/5 inline-flex gap-1 w-full overflow-x-auto">
                        {['Slow', 'Normal', 'Fast'].map((speed) => (
                        <button
                            key={speed}
                            onClick={() => setSelectedSpeed(speed)}
                            disabled={isGenerating}
                            className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                            selectedSpeed === speed 
                                ? 'bg-zinc-700 text-white shadow-lg ring-1 ring-white/10' 
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {speed}
                        </button>
                        ))}
                    </div>
                </div>

                {/* Accent Selection */}
                <div className="relative">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <Globe2 className="w-3.5 h-3.5 text-zinc-500" />
                        <h3 className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest">Accent / Dialect</h3>
                    </div>

                    <div className="relative z-40">
                         <button 
                            onClick={() => !isGenerating && setIsAccentDropdownOpen(!isAccentDropdownOpen)}
                            className="w-full bg-zinc-900/50 border border-white/5 p-3 rounded-xl flex items-center justify-between hover:bg-zinc-800/50 transition-all text-sm h-[54px]" // Height matches pace buttons approx
                        >
                            <span className="text-white font-medium pl-2">{selectedAccent}</span>
                            {isAccentDropdownOpen ? <ChevronUp className="w-4 h-4 text-zinc-400 mr-2" /> : <ChevronDown className="w-4 h-4 text-zinc-400 mr-2" />}
                        </button>

                        <AnimatePresence>
                             {isAccentDropdownOpen && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[200px] overflow-y-auto custom-scrollbar"
                                >
                                    {SUPPORTED_ACCENTS.map((accent) => (
                                        <div 
                                            key={accent}
                                            onClick={() => {
                                                setSelectedAccent(accent);
                                                setIsAccentDropdownOpen(false);
                                            }}
                                            className={`p-3 px-4 flex items-center justify-between cursor-pointer transition-colors border-b border-white/5 last:border-0 ${
                                                selectedAccent === accent ? 'bg-primary/10 text-primary' : 'hover:bg-zinc-800 text-zinc-300'
                                            }`}
                                        >
                                            <span className="text-sm font-medium">{accent}</span>
                                            {selectedAccent === accent && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                        </div>
                                    ))}
                                </motion.div>
                             )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

        </div>

        {/* Preview & Generate Area */}
        <div className="lg:col-span-12 flex flex-col">
           <div className="bg-zinc-900/40 backdrop-blur-2xl rounded-3xl p-5 md:p-8 flex-1 flex flex-col shadow-2xl ring-1 ring-white/5 relative z-10">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                 <h3 className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest">Preview</h3>
                 {generatedAudio && <span className="text-[10px] md:text-xs text-green-400 font-medium flex items-center gap-1"><Sparkles className="w-3 h-3"/> Ready</span>}
              </div>
              
              {/* Script Viewer */}
              <div className="flex-1 bg-black/40 rounded-2xl ring-1 ring-white/5 p-4 md:p-6 mb-6 relative overflow-hidden flex flex-col min-h-[150px] max-h-[300px]">
                <div className="absolute top-4 right-4 z-10 opacity-50">
                   <Quote className="w-6 h-6 text-zinc-800 fill-zinc-800" />
                </div>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                   <ScriptDisplay text={script} />
                </div>
              </div>
              
              {/* New Player */}
              {audioUrl && (
                  <motion.div 
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="mb-6"
                  >
                    <WaveformPlayer 
                        src={audioUrl} 
                        isPlaying={isPlayingPreview} 
                        onToggle={() => setIsPlayingPreview(!isPlayingPreview)} 
                    />
                  </motion.div>
              )}

              {errorMsg && (
                 <div className="mb-4 p-3 bg-red-500/10 ring-1 ring-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorMsg}
                 </div>
              )}

              {isGenerating ? (
                <div className="space-y-3 py-2">
                  <ProgressBar progress={progress} label="Synthesizing Voice..." />
                  <p className="text-[10px] text-center text-zinc-500 animate-pulse font-mono">Applying neural prosody & style</p>
                </div>
              ) : generatedAudio ? (
                <div className="flex flex-col md:flex-row gap-3">
                  <Button 
                    variant="ghost" 
                    onClick={() => { setGeneratedAudio(null); setProgress(0); setAudioUrl(null); setIsPlayingPreview(false); }} 
                    leftIcon={<RotateCcw className="w-4 h-4" />}
                    className="w-full md:w-auto text-zinc-400 hover:text-white"
                  >
                    Regenerate
                  </Button>
                  <Button 
                    className="w-full md:flex-1 py-3.5 text-base shadow-xl shadow-primary/20"
                    onClick={handleConfirm} 
                    leftIcon={<ArrowRight className="w-5 h-5" />}
                  >
                    Confirm & Merge
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={handleGenerate} 
                  className="w-full py-4 text-base md:text-lg font-semibold shadow-[0_0_30px_rgba(99,102,241,0.2)]"
                  leftIcon={<Sparkles className="w-5 h-5 mr-1" />}
                >
                  Generate Voiceover
                </Button>
              )}
           </div>
        </div>
      </div>
    </motion.div>
  );
};