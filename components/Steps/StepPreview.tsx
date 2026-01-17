import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download, RefreshCw, Volume2, Film, Loader2, Upload } from 'lucide-react';
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
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');

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

  const togglePlay = () => {
    if (videoRef.current && audioRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        audioRef.current.pause();
      } else {
        // Reset to start if finished
        if (videoRef.current.ended) {
            videoRef.current.currentTime = 0;
            audioRef.current.currentTime = 0;
        }
        videoRef.current.play().catch(e => console.warn("Video play error:", e));
        audioRef.current.play().catch(e => console.warn("Audio play error:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const handleSeek = () => {
     if (videoRef.current && audioRef.current) {
         // Sync audio to video time
         if (Math.abs(videoRef.current.currentTime - audioRef.current.currentTime) > 0.3) {
             audioRef.current.currentTime = videoRef.current.currentTime;
         }
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

    try {
        const videoElement = videoRef.current;
        const audioElement = audioRef.current;

        // Reset to start
        videoElement.currentTime = 0;
        audioElement.currentTime = 0;

        // Simple Stream Capture (Note: A true server-side merge is better for quality, 
        // but this client-side hack works for demos)
        const videoStream = (videoElement as any).captureStream ? (videoElement as any).captureStream() : 
                            (videoElement as any).mozCaptureStream ? (videoElement as any).mozCaptureStream() : null;
        
        if (!videoStream) {
            alert("Export not supported in this browser. Please use Chrome/Firefox or download the audio file.");
            setIsExporting(false);
            return;
        }

        // Create a new AudioContext to capture the audio element output
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = ctx.createMediaElementSource(audioElement);
        const dest = ctx.createMediaStreamDestination();
        source.connect(dest);
        
        // Combine video track with new audio track
        const combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);

        const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
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
            
            source.disconnect();
            ctx.close();
            setIsExporting(false);
            setIsPlaying(false);
        };

        recorder.start();
        
        // Play both to record
        await videoElement.play();
        await audioElement.play();

        videoElement.onended = () => {
             recorder.stop();
             videoElement.onended = handleEnded; // reset handler
        };

    } catch (e) {
        console.error("Export failed:", e);
        alert("Export failed. Please try downloading audio only.");
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
        <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Studio Preview</h2>
        <p className="text-zinc-400 text-sm md:text-lg font-light">Review the final result and export.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Preview Player */}
        <div className="lg:col-span-2">
            <div className="bg-black rounded-3xl overflow-hidden relative shadow-2xl group min-h-[300px] md:min-h-[450px] flex items-center justify-center ring-1 ring-white/5 aspect-video">
            {isExporting && (
                <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                    <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                    <h3 className="text-xl font-bold text-white">Rendering Video...</h3>
                    <p className="text-zinc-400 text-sm">Recording real-time playback...</p>
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
                        onTimeUpdate={handleSeek}
                        onClick={togglePlay}
                    />
                    <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" />

                    {/* Overlay Controls */}
                    <div className={`absolute inset-0 bg-black/40 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px] ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
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
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-6">
           <div className="bg-zinc-900/40 backdrop-blur-2xl ring-1 ring-white/5 rounded-3xl p-8 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                Export Options
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
                    {isExporting ? 'Recording...' : 'Export Video'}
                </Button>
              </div>
           </div>

           <div className="bg-black/20 ring-1 ring-white/5 rounded-3xl p-6">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Project Status</h3>
              <ul className="space-y-4 text-sm">
                 <li className="flex justify-between text-zinc-300">
                    <span className="text-zinc-500">Source</span>
                    <span className="font-medium bg-zinc-800 px-2 py-0.5 rounded">{videoFile ? 'Video File' : 'Pending'}</span>
                 </li>
                 <li className="flex justify-between text-zinc-300">
                    <span className="text-zinc-500">Audio Status</span>
                    <span className="text-primary font-medium">{audioBase64 ? 'Generated' : 'Pending'}</span>
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