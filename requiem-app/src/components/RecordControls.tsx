import { useState, useRef, useEffect } from "react";
import type { TimeSignature } from "./TimeSignatureSelector";
import { ALL_TONALITIES } from "../engine/TonalityAdapter";
import { Plus, Settings2, Activity, Music } from "lucide-react";

interface RecordControlsProps {
  appState: string;
  isRecording: boolean;
  isProcessing: boolean;
  currentFrequency: number;
  currentNote: string;
  isButtonDisabled: boolean;
  handleMainButtonClick: () => void;
  stateLabels: Record<string, string>;
  preRecordTimeSignature: TimeSignature;
  setPreRecordTimeSignature: (val: TimeSignature) => void;
  preRecordBpm: number | "AUTO";
  setPreRecordBpm: (val: number | "AUTO") => void;
  preRecordTonality: string;
  setPreRecordTonality: (val: string) => void;
}

const COMMON_BPMS = [80, 90, 100, 120, 140, 160];
const NUMERATOR_OPTIONS = [2, 3, 4, 6, 9];
const DENOMINATOR_OPTIONS = [4, 8];

export function RecordControls({
  appState,
  isRecording,
  isProcessing,
  currentFrequency,
  currentNote,
  isButtonDisabled,
  handleMainButtonClick,
  preRecordTimeSignature,
  setPreRecordTimeSignature,
  preRecordBpm,
  setPreRecordBpm,
  preRecordTonality,
  setPreRecordTonality,
}: RecordControlsProps) {
  const isInputDisabled = isButtonDisabled && appState !== "RECORDING";
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSettingsOpen]);

  return (
    <div className="w-full max-w-3xl px-4 flex flex-col items-center transition-all duration-500 mb-8 z-20">
      <div className="w-full max-w-2xl flex flex-col gap-2 relative">
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

        {/* Settings Popup (Above the button) */}
        {isSettingsOpen && !isInputDisabled && !isRecording && !isProcessing && (
          <div 
            ref={settingsRef}
            className="absolute bottom-full mb-3 left-0 w-full backdrop-blur-sm p-4 flex flex-col sm:flex-row gap-6 animate-fade-in origin-bottom z-50 shadow-2xl"
            style={{
              borderRadius: '20px',
              border: '1px solid transparent',
              backgroundImage: 'linear-gradient(90deg, rgba(10, 10, 10, 0.84) 0%), linear-gradient(135deg, rgba(62, 62, 62, 0.88) 0%, transparent 40%)',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              boxShadow: 'inset 0px 0px 5px -2px rgba(242,242,242,0.16)',
            }}
          >
            {/* Time Signature */}
            <div className="flex-1 flex flex-col gap-2 border-b sm:border-b-0 sm:border-r border-white/10 pb-4 sm:pb-0 sm:pr-6">
              <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 flex items-center gap-1.5">
                <Settings2 size={12} /> Fórmula de Compasso
              </span>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex flex-col gap-1 w-full bg-black/40 rounded-lg p-1.5 border border-white/5">
                  {NUMERATOR_OPTIONS.map((n) => (
                    <button
                      key={`num-${n}`}
                      onClick={() => setPreRecordTimeSignature({ ...preRecordTimeSignature, numerator: n })}
                      className={`py-1.5 text-xs font-medium rounded transition-colors ${preRecordTimeSignature.numerator === n ? "bg-emerald-500/20 text-emerald-400" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <span className="text-white/20 text-xl font-light">/</span>
                <div className="flex flex-col gap-1 w-full bg-black/40 rounded-lg p-1.5 border border-white/5">
                  {DENOMINATOR_OPTIONS.map((d) => (
                    <button
                      key={`den-${d}`}
                      onClick={() => setPreRecordTimeSignature({ ...preRecordTimeSignature, denominator: d })}
                      className={`py-1.5 text-xs font-medium rounded transition-colors ${preRecordTimeSignature.denominator === d ? "bg-emerald-500/20 text-emerald-400" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* BPM */}
            <div className="flex-1 flex flex-col gap-2 border-b sm:border-b-0 sm:border-r border-white/10 pb-4 sm:pb-0 sm:pr-6">
              <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 flex items-center gap-1.5">
                <Activity size={12} /> Velocidade (BPM)
              </span>
              <button
                onClick={() => setPreRecordBpm("AUTO")}
                className={`mt-2 w-full py-2 rounded-lg text-xs font-medium transition-colors border ${preRecordBpm === "AUTO" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-black/40 border-white/5 text-white/60 hover:bg-white/5 hover:text-white"}`}
              >
                Detectar automaticamente
              </button>
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {COMMON_BPMS.map((b) => (
                  <button
                    key={`bpm-${b}`}
                    onClick={() => setPreRecordBpm(b)}
                    className={`py-1.5 rounded text-xs font-medium transition-colors ${preRecordBpm === b ? "bg-emerald-500/20 text-emerald-400" : "bg-black/40 text-white/60 hover:bg-white/5 hover:text-white"}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Tonality */}
            <div className="flex-1 flex flex-col gap-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 flex items-center gap-1.5">
                <Music size={12} /> Tonalidade
              </span>
              <button
                onClick={() => setPreRecordTonality("AUTO")}
                className={`mt-2 w-full py-2 rounded-lg text-xs font-medium transition-colors border ${preRecordTonality === "AUTO" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-black/40 border-white/5 text-white/60 hover:bg-white/5 hover:text-white"}`}
              >
                Detectar automaticamente
              </button>
              <select
                value={preRecordTonality}
                onChange={(e) => setPreRecordTonality(e.target.value)}
                className={`mt-2 w-full bg-black/40 border rounded-lg py-2 px-3 text-xs font-medium focus:outline-none appearance-none cursor-pointer transition-colors ${preRecordTonality !== "AUTO" ? "border-emerald-500/50 text-emerald-400" : "border-white/5 text-white/60 hover:border-white/20"}`}
              >
                <option value="AUTO" disabled>Selecionar tom manual...</option>
                {ALL_TONALITIES.map(t => (
                  <option key={t.value} value={t.value} className="bg-zinc-900 text-white">{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Main Input Bar */}
        <div 
          onClick={!isInputDisabled && !isSettingsOpen ? handleMainButtonClick : undefined}
          className={`
            relative group flex items-center w-full backdrop-blur-sm
            py-2 px-3 sm:py-2.5 sm:px-4 transition-all duration-300
            ${!isInputDisabled ? 'cursor-pointer hover:brightness-110 hover:shadow-[0_4px_30px_rgba(255,255,255,0.05)]' : 'opacity-70 cursor-not-allowed'}
            ${isRecording ? 'shadow-[0_4px_30px_rgba(220,38,38,0.15)]' : ''}
          `}
          style={{
            borderRadius: '20px',
            border: '1px solid transparent',
            backgroundImage: isRecording 
              ? 'linear-gradient(90deg, rgba(220,38,38,0.15) 0%, rgba(153,27,27,0.42) 100%), linear-gradient(135deg, rgba(220,38,38,0.62) 0%, transparent 40%)'
              : 'linear-gradient(90deg, rgba(10, 10, 10, 0.61) 0%), linear-gradient(135deg, rgba(62, 62, 62, 0.57) 0%, transparent 40%)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            boxShadow: 'inset 0px 0px 5px -2px rgba(242,242,242,0.16)',
          }}
        >
          {/* left settings button & indicators */}
          <div className="flex-shrink-0 flex items-center gap-2 mr-3 z-30">
            {isRecording ? (
               <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" /></div>
            ) : isProcessing ? (
               <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center"><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>
            ) : (
               <button
                 type="button"
                 disabled={isInputDisabled}
                 onClick={(e) => {
                   e.stopPropagation();
                   setIsSettingsOpen(!isSettingsOpen);
                 }}
                 className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-neutral-900 border border-white/10 rounded-xl transition-all duration-300 ${isSettingsOpen ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'hover:bg-neutral-800 text-white/70 hover:text-white'}`}
               >
                 <Plus className={`w-5 h-5 transition-transform duration-300 ${isSettingsOpen ? 'rotate-45' : ''}`} />
               </button>
            )}

            {/* Custom Pills */}
            {!isRecording && !isProcessing && (
              <div className="flex items-center gap-1.5 hidden sm:flex">
                {(preRecordTimeSignature.numerator !== 4 || preRecordTimeSignature.denominator !== 4) && (
                  <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-white/60">
                    {preRecordTimeSignature.numerator}/{preRecordTimeSignature.denominator}
                  </span>
                )}
                {preRecordBpm !== "AUTO" && (
                  <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-white/60">
                    {preRecordBpm} BPM
                  </span>
                )}
                {preRecordTonality !== "AUTO" && (
                  <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-white/60">
                    Tom: {preRecordTonality}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 flex items-center px-2">
            <span className={`text-sm sm:text-base font-light transition-colors ${isRecording ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`}>
              {isRecording 
                ? (currentNote ? `${currentNote} (${currentFrequency}Hz)` : 'Gravando sinal...') 
                : isProcessing 
                ? 'Processando Harmonia...' 
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

      </div>
    </div>
  );
}

