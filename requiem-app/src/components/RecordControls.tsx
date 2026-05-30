import {
  MAJOR_TONALITIES,
  MINOR_TONALITIES,
  UT_OPTIONS,
  QT_OPTIONS,
} from "../engine/TonalityAdapter";
import { Metronome } from "lucide-react";

interface RecordControlsProps {
  isActive: boolean;
  tonality: string;
  setTonality: (val: string) => void;
  qtValue: number;
  setQtValue: (val: number) => void;
  utValue: number;
  setUtValue: (val: number) => void;
  bpm: number;
  setBpm: (val: number) => void;
  appState: string;
  isRecording: boolean;
  isProcessing: boolean;
  currentBeat: number;
  currentFrequency: number;
  currentNote: string;
  isButtonDisabled: boolean;
  handleMainButtonClick: () => void;
  stateLabels: Record<string, string>;
}

export function RecordControls({
  isActive,
  tonality,
  setTonality,
  qtValue,
  setQtValue,
  utValue,
  setUtValue,
  bpm,
  setBpm,
  appState,
  isRecording,
  isProcessing,
  currentBeat,
  currentFrequency,
  currentNote,
  isButtonDisabled,
  handleMainButtonClick,
}: RecordControlsProps) {
  const isInputDisabled = isButtonDisabled && appState !== "RECORDING";

  return (
    <div className="w-full max-w-2xl px-4 flex flex-col items-center transition-all duration-500 mb-8 z-20">
      {/* Input Bar Container */}
      <div className="w-full max-w-xl flex flex-col gap-2">
        {/* Top small indicators */}
        <div className="flex justify-between items-center px-4 mb-2">
          <span className="text-[10px] text-white/40 flex items-center gap-1.5 font-mono uppercase tracking-wider">
            <svg className="w-3 h-3 text-white/30" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Requiem Engine Ativo
          </span>
          <span className="text-[10px] text-white/40 flex items-center gap-1.5 font-mono uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            Modelo Pronto
          </span>
        </div>

        {/* Main Input Bar */}
        <div 
          onClick={!isInputDisabled ? handleMainButtonClick : undefined}
          className={`
            relative group flex items-center w-full bg-[#161616]/80 backdrop-blur-xl border border-white/10
            rounded-2xl p-2 sm:p-2.5 transition-all duration-300
            ${!isInputDisabled ? 'cursor-pointer hover:bg-[#1a1a1a]/90 hover:border-white/20 hover:shadow-[0_4px_30px_rgba(255,255,255,0.05)]' : 'opacity-70 cursor-not-allowed'}
            ${isRecording ? 'border-red-500/30 shadow-[0_4px_30px_rgba(220,38,38,0.15)] bg-red-950/10' : ''}
          `}
        >
          {/* left + icon or recording indicator */}
          <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center text-white/30">
            {isRecording ? (
               <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            ) : isProcessing ? (
               <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : appState === "COUNT_IN" ? (
               <span className="text-sm font-mono text-white/80">{currentBeat + 1}</span>
            ) : (
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4"/></svg>
            )}
          </div>

          <div className="flex-1 flex items-center px-2">
            <span className={`text-sm sm:text-base font-light transition-colors ${isRecording ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`}>
              {isRecording 
                ? (currentNote ? `${currentNote} (${currentFrequency}Hz)` : 'Gravando sinal...') 
                : isProcessing 
                ? 'Processando Harmonia...' 
                : appState === "COUNT_IN" 
                ? 'Contagem...' 
                : 'Iniciar captura de áudio...'}
            </span>
          </div>

          <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${isRecording ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white/80'}`}>
            {isRecording ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            )}
          </div>
        </div>

        {/* Pill Buttons Container */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          
          {/* Tonalidade */}
          <div className="relative group">
            <select
              value={tonality}
              onChange={(e) => setTonality(e.target.value)}
              disabled={isActive}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
            >
              <optgroup label="Maiores">
                {MAJOR_TONALITIES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </optgroup>
              <optgroup label="Menores">
                {MINOR_TONALITIES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </optgroup>
            </select>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border bg-[#111111]/80 text-xs font-light tracking-wide transition-all ${isActive ? 'opacity-50 border-white/5 text-white/30' : 'border-white/10 text-white/60 group-hover:border-white/20 group-hover:text-white/80 group-hover:bg-white/5'}`}>
              <svg className="w-4 h-4 text-current opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
              {tonality}
            </div>
          </div>

          {/* Compasso */}
          <div className="relative group flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border bg-[#111111]/80 text-xs font-light tracking-wide transition-all ${isActive ? 'opacity-50 border-white/5 text-white/30' : 'border-white/10 text-white/60 group-hover:border-white/20 group-hover:text-white/80 group-hover:bg-white/5'}`}>
              <svg className="w-4 h-4 text-current opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <select value={qtValue} onChange={(e) => setQtValue(Number(e.target.value))} disabled={isActive} className="bg-transparent outline-none cursor-pointer appearance-none text-center">
                {QT_OPTIONS.map(n => <option key={n} value={n} className="bg-black text-white">{n}</option>)}
              </select>
              <span className="opacity-50">/</span>
              <select value={utValue} onChange={(e) => setUtValue(Number(e.target.value))} disabled={isActive} className="bg-transparent outline-none cursor-pointer appearance-none text-center">
                {UT_OPTIONS.map(n => <option key={n} value={n} className="bg-black text-white">{n}</option>)}
              </select>
            </div>
          </div>

          {/* BPM */}
          <div className="relative group">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border bg-[#111111]/80 text-xs font-light tracking-wide transition-all ${isActive ? 'opacity-50 border-white/5 text-white/30' : 'border-white/10 text-white/60 group-hover:border-white/20 group-hover:text-white/80 group-hover:bg-white/5'}`}>
               <Metronome className="w-4 h-4 text-current opacity-70" />
               {bpm} BPM
            </div>
            <input 
              type="range" min="60" max="180" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} disabled={isActive}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
            />
          </div>

        </div>
      </div>
    </div>
  );
}

