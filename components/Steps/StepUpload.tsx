import React, { useState, useRef } from 'react';
import { Upload, Youtube, FileVideo, ArrowRight, Link, Globe } from 'lucide-react';
import { Button } from '../ui/Button';
import { motion } from 'framer-motion';
import { SUPPORTED_LANGUAGES } from '../../types';

interface StepUploadProps {
  onFileSelect: (file: File, lang: string) => void;
  onUrlSelect: (url: string, lang: string) => void;
}

export const StepUpload: React.FC<StepUploadProps> = ({ onFileSelect, onUrlSelect }) => {
  const [activeTab, setActiveTab] = useState<'youtube' | 'upload'>('youtube');
  const [urlInput, setUrlInput] = useState('');
  const [selectedLang, setSelectedLang] = useState('en');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type.startsWith('video/')) {
      onFileSelect(file, selectedLang);
    } else {
      alert("Please upload a valid video file.");
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim().length > 0) {
      onUrlSelect(urlInput, selectedLang);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-2xl mx-auto space-y-6 md:space-y-10"
    >
      <div className="text-center space-y-2 md:space-y-3 px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow-xl">Import Source</h2>
        <p className="text-zinc-400 text-sm md:text-lg font-light leading-relaxed">Start your dubbing project by pasting a link or uploading a video.</p>
      </div>

      <div className="bg-zinc-900/40 backdrop-blur-2xl rounded-3xl p-4 md:p-8 shadow-2xl ring-1 ring-white/5">
        
        {/* Language Selector */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl bg-black/20 ring-1 ring-white/5">
            <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-xl">
                <Globe className="w-5 h-5 text-primary" />
            </div>
            <div>
                <p className="text-sm font-medium text-white">Target Language</p>
                <p className="text-xs text-zinc-500">Output language for dubbing</p>
            </div>
            </div>
            <div className="relative w-full md:w-auto">
            <select 
                value={selectedLang} 
                onChange={(e) => setSelectedLang(e.target.value)}
                className="w-full md:w-[200px] appearance-none bg-zinc-800/50 hover:bg-zinc-800 transition-colors text-white text-sm rounded-xl focus:ring-1 focus:ring-primary block py-3 px-4 pr-10 cursor-pointer outline-none border-none"
            >
                {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.name} className="bg-zinc-900">{lang.name}</option>
                ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </div>
            </div>
        </div>

        {/* Tabs */}
        <div className="bg-black/20 rounded-xl p-1 flex mb-6 md:mb-8">
            <button
            onClick={() => setActiveTab('youtube')}
            className={`flex-1 py-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                activeTab === 'youtube' 
                ? 'bg-zinc-800 text-white shadow-lg' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
            >
            <Youtube className="w-4 h-4" />
            Link
            </button>
            <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                activeTab === 'upload' 
                ? 'bg-zinc-800 text-white shadow-lg' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
            >
            <FileVideo className="w-4 h-4" />
            Upload
            </button>
        </div>

        {/* Content Area */}
        <div className="min-h-[250px] md:min-h-[300px] relative">
            {activeTab === 'youtube' ? (
            <motion.div 
                key="youtube"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl p-6 md:p-10 text-center h-full min-h-[250px] flex flex-col items-center justify-center bg-transparent"
            >
                <div className="w-16 h-16 md:w-20 md:h-20 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-white/5">
                   <Link className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-white mb-6">Paste Video Link</h3>
                <div className="w-full flex flex-col md:flex-row gap-3">
                    <input 
                        type="text" 
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://youtube.com/..." 
                        className="flex-1 bg-black/40 ring-1 ring-white/10 rounded-xl px-4 py-3.5 text-base text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                    <Button onClick={handleUrlSubmit} disabled={!urlInput} className="w-full md:w-auto px-6 py-3.5" leftIcon={<ArrowRight className="w-5 h-5"/>}>
                        Analyze
                    </Button>
                </div>
            </motion.div>
            ) : (
            <motion.div 
                key="upload"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className={`border-2 border-dashed rounded-2xl p-6 md:p-10 text-center h-full min-h-[250px] flex flex-col items-center justify-center transition-all duration-300 ${
                dragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-zinc-800 hover:border-zinc-700 bg-transparent'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <div className="w-16 h-16 md:w-20 md:h-20 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-6 ring-1 ring-white/5">
                   <Upload className="w-6 h-6 md:w-8 md:h-8 text-zinc-400" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-white mb-2">Drag & drop video</h3>
                <p className="text-xs md:text-sm text-zinc-500 mb-6 font-light">MP4, MOV, WebM • Max 100MB</p>
                <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="video/*" 
                onChange={handleChange} 
                />
                <Button onClick={() => fileInputRef.current?.click()} variant="primary" className="shadow-lg shadow-primary/20 w-full md:w-auto">
                   Browse Files
                </Button>
            </motion.div>
            )}
        </div>
      </div>
    </motion.div>
  );
};