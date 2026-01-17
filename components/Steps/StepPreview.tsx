import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download, RefreshCw, Volume2, VolumeX, Upload, Film, Loader2, Settings2, Zap, Clock, Scissors } from 'lucide-react';
import { Button } from '../ui/Button';
import { base64ToUint8Array, createWavBlob, blobToUrl } from '../../services/utils';
import { motion } from 'framer-motion';

interface StepPreviewProps {
  videoFile: File | null;
  audioBase64: string;
  onReset: () => void;
  onVideoUpload: (file: File) => void;
}

export const StepPreview: React.FC<StepPreviewProps> = ({ videoFile, audioBase64, onReset, onVideoUpload }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Audio Graph Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');

  // Audio Editor State
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [audioDelay, setAudioDelay] = useState(0); // seconds
  const [volume, setVolume] = useState(1.0);

  // Initialize Media URLs
  useEffect(() => {
    let vUrl = '';
    if (videoFile) {
        vUrl = URL.createObjectURL(videoFile);
        setVideoUrl(vUrl);
    }
    
    // Create WAV blob from raw PCM
    const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
    const pcmData = base64ToUint8Array(cleanBase64);
    const wavBlob = createWavBlob(pcmData, 24000);
    const aUrl = blobToUrl(wavBlob);
    setAudioUrl(aUrl);

    return () => {
      if (vUrl) URL.revokeObjectURL(vUrl);
      if (aUrl) URL.revokeObjectURL(aUrl);
    };
  }, [videoFile, audioBase64]);

  // Initialize Audio Context (Fix for "already associated" error)
  useEffect(() => {
    // Only initialize if we have the audio element in the DOM (videoFile exists)
    if (videoFile && audioRef.current && !audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;
        
        try {
            // Create source only once
            const source = ctx.createMediaElementSource(audioRef.current);
            audioSourceNodeRef.current = source;
            // Connect to speakers so user can hear preview normally
            source.connect(ctx.destination);
        } catch (e) {
            console.error("Audio Graph Setup Error:", e);
        }
    }

    // Cleanup on unmount
    return () => {
        if (audioContextRef.current) {
            if (audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
            audioContextRef.current = null;
            audioSourceNodeRef.current = null;
        }
        if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    };
  }, [videoFile]);

  // Apply settings whenever they change
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.volume = volume;
    }
  }, [playbackRate, volume]);

  const togglePlay = async () => {
    if (videoRef.current && audioRef.current) {
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      if (isPlaying) {
        videoRef.current.pause();
        audioRef.current.pause();
        if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      } else {
        // Handle Playback with Delay
        videoRef.current.play().catch(e => console.warn("Video play error:", e));
        
        // Ensure settings are applied before play
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.volume = volume;
        
        // Sync Logic:
        // Since we can't easily "shift" the audio start time negatively without seeking,
        // we'll implement Positive Delay (Audio starts after Video).
        // If users want negative delay, they usually just trim the start, which is a different tool.
        // For simplicity, Audio Delay here is 0 to 5s.
        
        const delayMs = Math.max(0, audioDelay * 1000);
        
        playTimeoutRef.current = setTimeout(() => {
            if (audioRef.current) {
                 // Resync check: set audio time to match video time minus delay (if playing from middle)
                 // This is complex, so we assume "Play" usually starts from current pause point.
                 // Simple approach: Just play.
                 audioRef.current.play().catch(e => console.warn("Audio play error:", e));
            }
        }, delayMs);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
  };

  const handleSeek = () => {
     if (videoRef.current && audioRef.current) {
         // When user seeks video, sync audio to that spot
         // Current Video Time - Delay = Audio Time
         const targetAudioTime = Math.max(0, videoRef.current.currentTime - audioDelay);
         audioRef.current.currentTime = targetAudioTime;
     }
  };

  const handleDownloadAudio = () => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = 'generated-voiceover.wav';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportMerge = async () => {
    if (!videoRef.current || !audioRef.current) return;
    setIsExporting(true);
    setIsPlaying(false);
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);

    // Pause everything first
    videoRef.current.pause();
    audioRef.current.pause();

    let recorder: MediaRecorder | null = null;
    let dest: MediaStreamAudioDestinationNode | null = null;

    try {
        const videoElement = videoRef.current;
        const audioElement = audioRef.current;

        if (!audioContextRef.current || !audioSourceNodeRef.current) {
            throw new Error("Audio Context not initialized");
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        // Apply export settings
        audioElement.playbackRate = playbackRate;
        audioElement.volume = volume;

        // Create Mix Destination
        dest = ctx.createMediaStreamDestination();
        audioSourceNodeRef.current.connect(dest);
        
        // Capture Video
        const videoElAny = videoElement as any;
        const videoStream = videoElAny.captureStream ? videoElAny.captureStream() : 
                            videoElAny.mozCaptureStream ? videoElAny.mozCaptureStream() : null;
        
        if (!videoStream) {
            alert("Browser not supported for capture. Use Chrome/Firefox.");
            setIsExporting(false);
            if (dest) audioSourceNodeRef.current.disconnect(dest);
            return;
        }

        const combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);

        recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'voxforge-dubbed.webm';
            a.click();
            URL.revokeObjectURL(url);
            
            // Cleanup
            if (dest && audioSourceNodeRef.current) {
                audioSourceNodeRef.current.disconnect(dest);
            }
            setIsExporting(false);
        };

        // Reset to start
        videoElement.currentTime = 0;
        audioElement.currentTime = 0;
        
        recorder.start();
        videoElement.play();

        // Apply Delay Logic during export
        const delayMs = Math.max(0, audioDelay * 1000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        audioElement.play();

        // Wait for video end
        videoElement.onended = () => {
             if (recorder && recorder.state !== 'inactive') {
                 recorder.stop();
             }
             videoElement.onended = handleEnded; 
        };

    } catch (e) {
        console.error("Export failed:", e);
        alert("Export failed. Please try downloading audio only.");
        if (dest && audioSourceNodeRef.current) {
            try { audioSourceNodeRef.current.disconnect(dest); } catch (err) {}
        }
        setIsExporting(false);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        onVideoUpload(e.target.files[0]);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-6xl mx-auto space-y-6"
    >
      <div className="text-center space-y-2">
        <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Studio Mixer</h2>
        <p className="text-zinc-400 text-sm md:text-lg font-light">Preview, edit timing, and export.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Preview Player */}
        <div className="lg:col-span-2 space-y-4">
            <div className="bg-black rounded-3xl overflow-hidden relative shadow-2xl group min-h-[300px] md:min-h-[450px] flex items-center justify-center ring-1 ring-white/5">
            {isExporting && (
                <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                    <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                    <h3 className="text-xl font-bold text-white">Rendering Video...</h3>
                    <p className="text-zinc-400 text-sm">Merging Audio & Video with adjustments...</p>
                </div>
            )}

            {!videoFile ? (
                <div className="text-center p-8">
                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-6 mx-auto shadow-xl ring-1 ring-white/5">
                        <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Sync Original Video</h3>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="video/*" 
                        onChange={handleVideoUpload} 
                    />
                    <Button onClick={() => fileInputRef.current?.click()} variant="primary" className="shadow-lg shadow-primary/20">
                        Select Video File
                    </Button>
                </div>
            ) : (
                <>
                    <video 
                        ref={videoRef}
                        src={videoUrl}
                        className="w-full h-full object-contain bg-black"
                        muted // Mute original video
                        playsInline
                        crossOrigin="anonymous"
                        onEnded={handleEnded}
                        onSeeked={handleSeek}
                        onPlay={() => {
                            if (!isPlaying && !isExporting) togglePlay();
                        }}
                        onPause={() => {
                            if (isPlaying && !isExporting) togglePlay();
                        }}
                    />
                    <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" />

                    {/* Overlay Controls */}
                    <div className={`absolute inset-0 bg-black/40 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px] ${isPlaying ? 'opacity-0 group-hover:opacity-100 pointer-events-none' : 'opacity-100'}`}>
                        <button 
                            onClick={togglePlay}
                            disabled={isExporting}
                            className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center pointer-events-auto hover:bg-white/20 transition-all ring-1 ring-white/30 text-white shadow-2xl scale-95 group-active:scale-90"
                        >
                            {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                        </button>
                    </div>
                </>
            )}
            </div>
            
            {/* Audio Editor / Mixer Panel */}
            {videoFile && (
                <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <Settings2 className="w-5 h-5 text-primary" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Audio Mixer</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Speed Control */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                                    <Zap className="w-3.5 h-3.5" /> Speed
                                </label>
                                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{playbackRate.toFixed(2)}x</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.5" 
                                max="1.5" 
                                step="0.05"
                                value={playbackRate}
                                onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                                className="w-full accent-primary h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <p className="text-[10px] text-zinc-500">Adjust if audio is too short/long.</p>
                        </div>

                        {/* Delay Control */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5" /> Start Delay
                                </label>
                                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">+{audioDelay.toFixed(2)}s</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="5" 
                                step="0.1"
                                value={audioDelay}
                                onChange={(e) => setAudioDelay(parseFloat(e.target.value))}
                                className="w-full accent-primary h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <p className="text-[10px] text-zinc-500">Sync lip movement.</p>
                        </div>

                        {/* Volume Control */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                                    <Volume2 className="w-3.5 h-3.5" /> Volume
                                </label>
                                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{Math.round(volume * 100)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.05"
                                value={volume}
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                className="w-full accent-primary h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                            />
                             <p className="text-[10px] text-zinc-500">AI Voice volume.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-6">
           <div className="bg-zinc-900/40 backdrop-blur-2xl ring-1 ring-white/5 rounded-3xl p-8 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                Export
              </h3>
              
              <div className="space-y-3">
                <Button 
                    onClick={handleDownloadAudio} 
                    className="w-full py-3.5"
                    variant="secondary"
                    leftIcon={<Volume2 className="w-5 h-5" />}
                    disabled={isExporting}
                >
                    Download Audio
                </Button>
                <Button 
                    variant="primary" 
                    onClick={handleExportMerge}
                    disabled={!videoFile || isExporting}
                    className={`w-full py-3.5 text-base ${!videoFile ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Film className="w-5 h-5 mr-2" />
                    {isExporting ? 'Rendering...' : 'Export Video'}
                </Button>
              </div>
           </div>

           <div className="bg-black/20 ring-1 ring-white/5 rounded-3xl p-6">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Project Stats</h3>
              <ul className="space-y-4 text-sm">
                 <li className="flex justify-between text-zinc-300">
                    <span className="text-zinc-500">Source</span>
                    <span className="font-medium bg-zinc-800 px-2 py-0.5 rounded">{videoFile ? 'Video File' : 'Pending'}</span>
                 </li>
                 <li className="flex justify-between text-zinc-300">
                    <span className="text-zinc-500">Voice Speed</span>
                    <span className="text-primary font-medium">{playbackRate}x</span>
                 </li>
                 <li className="flex justify-between text-zinc-300">
                    <span className="text-zinc-500">Sync Offset</span>
                    <span className="text-primary font-medium">+{audioDelay}s</span>
                 </li>
              </ul>
           </div>

           <Button variant="ghost" onClick={onReset} disabled={isExporting} className="w-full text-zinc-500 hover:text-white" leftIcon={<RefreshCw className="w-4 h-4"/>}>
              New Project
           </Button>
        </div>
      </div>
    </motion.div>
  );
};