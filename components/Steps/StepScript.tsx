import React, { useEffect, useState } from 'react';
import { Wand2, Edit3, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { extractScriptFromVideo, extractScriptFromUrl } from '../../services/gemini';
import { fileToBase64 } from '../../services/utils';
import { motion } from 'framer-motion';

interface StepScriptProps {
  videoFile: File | null;
  videoUrl?: string;
  targetLanguage: string;
  onConfirmScript: (script: string) => void;
  onBack: () => void;
}

export const StepScript: React.FC<StepScriptProps> = ({ videoFile, videoUrl, targetLanguage, onConfirmScript, onBack }) => {
  const [script, setScript] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const processContent = async () => {
      try {
        setLoading(true);
        if (videoFile) {
            const base64 = await fileToBase64(videoFile);
            const extracted = await extractScriptFromVideo(base64, videoFile.type, targetLanguage);
            setScript(extracted);
        } else if (videoUrl) {
            const extracted = await extractScriptFromUrl(videoUrl, targetLanguage);
            setScript(extracted);
        }
      } catch (error) {
        console.error("Script extraction failed", error);
        setScript("Error extracting script. Please try again or type manually.");
      } finally {
        setLoading(false);
      }
    };

    if (!script) {
        processContent();
    } else {
        setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoFile, videoUrl]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-5xl mx-auto space-y-4 md:space-y-6"
    >
      <div className="flex items-center justify-between px-1">
        <div>
           <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Script Analysis</h2>
           <p className="text-zinc-400 text-xs md:text-sm mt-1">Optimized for {targetLanguage}.</p>
        </div>
        <Button variant="ghost" onClick={onBack} className="text-zinc-400 hover:text-white px-0 md:px-4">Back</Button>
      </div>

      <motion.div 
        className="bg-zinc-900/40 backdrop-blur-2xl rounded-3xl p-1 md:p-1 relative shadow-2xl ring-1 ring-white/5 overflow-hidden"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {loading ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-6 bg-black/20 rounded-3xl p-8">
             <div className="relative w-16 h-16 md:w-20 md:h-20">
               <div className="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(99,102,241,0.5)]"></div>
             </div>
             <p className="text-zinc-300 font-medium animate-pulse text-sm md:text-lg text-center">
                {videoFile ? "Analyzing video content..." : `Searching & Optimizing for ${targetLanguage}...`}
             </p>
          </div>
        ) : (
          <div className="flex flex-col h-full bg-black/20 rounded-3xl">
            {/* Header / Toolbar */}
            <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary bg-primary/10 px-3 py-1.5 rounded-full ring-1 ring-primary/20">
                    <Wand2 className="w-3.5 h-3.5" />
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Gemini 2.5 AI</span>
                </div>
                <div className="text-xs text-zinc-500 flex items-center gap-1">
                    <Edit3 className="w-3 h-3" />
                    <span>Editable</span>
                </div>
            </div>
            
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="w-full flex-1 bg-transparent p-4 md:p-8 text-zinc-200 font-sans text-base leading-relaxed focus:outline-none resize-none min-h-[50vh] md:min-h-[450px]"
              spellCheck={false}
              placeholder="Script will appear here..."
            />
            
            <div className="p-4 md:p-6 border-t border-white/5 bg-zinc-900/50 backdrop-blur-md rounded-b-3xl">
               <Button onClick={() => onConfirmScript(script)} leftIcon={<ArrowRight className="w-4 h-4"/>} className="w-full md:w-auto md:px-8 py-3.5 text-base shadow-lg shadow-primary/20">
                 Generate Voiceover
               </Button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};