import React, { useState } from 'react';
import { AppStep } from './types';
import { StepUpload } from './components/Steps/StepUpload';
import { StepScript } from './components/Steps/StepScript';
import { StepVoice } from './components/Steps/StepVoice';
import { StepPreview } from './components/Steps/StepPreview';
import { Layers } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { DarkVeil } from './components/Backgrounds/DarkVeil';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.UPLOAD);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<string>('English (US)');
  const [script, setScript] = useState<string>('');
  const [audioBase64, setAudioBase64] = useState<string>('');

  const handleFileSelect = (file: File, lang: string) => {
    setVideoFile(file);
    setVideoUrl('');
    setTargetLanguage(lang);
    setCurrentStep(AppStep.SCRIPT_ANALYSIS);
  };

  const handleUrlSelect = (url: string, lang: string) => {
    setVideoUrl(url);
    setVideoFile(null);
    setTargetLanguage(lang);
    setCurrentStep(AppStep.SCRIPT_ANALYSIS);
  };

  const handleScriptConfirm = (finalScript: string) => {
    setScript(finalScript);
    setCurrentStep(AppStep.VOICE_GENERATION);
  };

  const handleAudioGenerated = (audio: string) => {
    setAudioBase64(audio);
    setCurrentStep(AppStep.PREVIEW_EXPORT);
  };

  const handleFinalVideoUpload = (file: File) => {
    setVideoFile(file);
  };

  const handleReset = () => {
    setVideoFile(null);
    setVideoUrl('');
    setScript('');
    setAudioBase64('');
    setCurrentStep(AppStep.UPLOAD);
  };

  return (
    <div className="min-h-screen bg-background text-zinc-100 flex flex-col font-sans selection:bg-primary/30 overflow-x-hidden relative">
      {/* Dark Veil Background */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-black">
         <DarkVeil
            hueShift={8}
            noiseIntensity={0.07}
            scanlineIntensity={0}
            speed={2.5}
            scanlineFrequency={1.4}
            warpAmount={0}
            resolutionScale={1}
         />
      </div>

      {/* Header */}
      <header className="border-b border-white/5 bg-black/10 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              <Layers className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div>
               <h1 className="text-lg md:text-xl font-bold tracking-tight text-white leading-none">VoxForge</h1>
               <p className="hidden md:block text-[10px] md:text-xs text-zinc-500 font-medium tracking-wide">AI DUBBING STUDIO</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] md:text-xs font-medium text-zinc-400 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                <span className="hidden sm:inline">System Operational</span>
                <span className="sm:hidden">Online</span>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-start pt-6 md:pt-12 pb-20 px-3 md:px-6 relative z-10 w-full">
        
        <div className="w-full max-w-7xl">
          {/* Progress Stepper */}
          <div className="flex justify-center mb-8 md:mb-16">
             <div className="flex items-center gap-2 md:gap-4 bg-black/20 backdrop-blur-xl p-1.5 md:p-2 rounded-full ring-1 ring-white/5">
                {[0, 1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <motion.div 
                      className={`w-3 h-3 md:w-4 md:h-4 rounded-full transition-all duration-500 ease-out flex items-center justify-center ${
                        currentStep >= step 
                          ? 'bg-primary shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-110' 
                          : 'bg-zinc-800'
                      }`} 
                    >
                        {currentStep === step && <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-white rounded-full" />}
                    </motion.div>
                    {step < 3 && <div className={`w-8 md:w-16 h-0.5 mx-2 md:mx-3 rounded-full transition-colors duration-500 ${currentStep > step ? 'bg-primary/50' : 'bg-zinc-800'}`} />}
                  </div>
                ))}
             </div>
          </div>

          <AnimatePresence mode="wait">
            {currentStep === AppStep.UPLOAD && (
              <StepUpload key="upload" onFileSelect={handleFileSelect} onUrlSelect={handleUrlSelect} />
            )}

            {currentStep === AppStep.SCRIPT_ANALYSIS && (
              <StepScript 
                key="script"
                videoFile={videoFile}
                videoUrl={videoUrl}
                targetLanguage={targetLanguage}
                onConfirmScript={handleScriptConfirm}
                onBack={() => setCurrentStep(AppStep.UPLOAD)}
              />
            )}

            {currentStep === AppStep.VOICE_GENERATION && (
              <StepVoice 
                key="voice"
                script={script} 
                onAudioGenerated={handleAudioGenerated}
                onBack={() => setCurrentStep(AppStep.SCRIPT_ANALYSIS)}
              />
            )}

            {currentStep === AppStep.PREVIEW_EXPORT && (
              <StepPreview 
                key="preview"
                videoFile={videoFile} 
                audioBase64={audioBase64}
                onReset={handleReset}
                onVideoUpload={handleFinalVideoUpload}
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-[10px] md:text-xs text-zinc-600 bg-black/10 backdrop-blur-xl relative z-10">
        <p>Powered by Google Gemini 2.5 Flash & TTS</p>
      </footer>
    </div>
  );
};

export default App;