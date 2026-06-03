import { useState, useEffect, useRef } from "react";
import {
  Mic,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Square,
  Metronome,
  PanelRight,
  Settings2,
  Activity,
  Music,
} from "lucide-react";
import { ALL_TONALITIES } from "../engine/TonalityAdapter";
import type { TimeSignature } from "./TimeSignatureSelector"; // assuming it exists or define inline

export interface TopBarProps {
  onStartRecording?: () => void;
  isPlaying: boolean;
  time: number;
  onPlay: (time?: number) => void;
  onStop: () => void;
  handleSkipBack: () => void;
  handleSkipForward: () => void;
  bpm: number;
  setBpm: (v: number) => void;
  qtValue: number;
  setQtValue: (v: number) => void;
  utValue: number;
  setUtValue: (v: number) => void;
  tonality: string;
  setTonality: (v: string) => void;
  isSceneBarOpen: boolean;
  toggleSceneBar: () => void;
  isRecorded: boolean;
  preRecordBpm: number | "AUTO";
  setPreRecordBpm: (val: number | "AUTO") => void;
  preRecordTonality: string;
  setPreRecordTonality: (val: string) => void;
  preRecordTimeSignature: TimeSignature;
  setPreRecordTimeSignature: (val: TimeSignature) => void;
}

const COMMON_BPMS = [80, 90, 100, 120, 140, 160];
const NUMERATOR_OPTIONS = [2, 3, 4, 6, 9];
const DENOMINATOR_OPTIONS = [4, 8];

export function TopBar({
  onStartRecording,
  isPlaying,
  time,
  onPlay,
  onStop,
  handleSkipBack,
  handleSkipForward,
  bpm,
  setBpm,
  qtValue,
  setQtValue,
  utValue,
  setUtValue,
  tonality,
  setTonality,
  isSceneBarOpen,
  toggleSceneBar,
  isRecorded,
  preRecordBpm,
  setPreRecordBpm,
  preRecordTonality,
  setPreRecordTonality,
  preRecordTimeSignature,
  setPreRecordTimeSignature,
}: TopBarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [customBpmStr, setCustomBpmStr] = useState<string>("");

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
  
  const currentBpm = isRecorded ? bpm : preRecordBpm;

  // Sincroniza o valor do BPM com o campo de texto local para permitir que o usuário apague tudo ao digitar
  useEffect(() => {
    if (currentBpm === "AUTO") {
      setCustomBpmStr("");
    } else {
      setCustomBpmStr(currentBpm.toString());
    }
  }, [currentBpm, isSettingsOpen]);

  const setAnyBpm = (val: number | "AUTO") => isRecorded ? setBpm(val as number) : setPreRecordBpm(val);
  const currentTimeSig = isRecorded ? { numerator: qtValue, denominator: utValue } : preRecordTimeSignature;
  const setAnyTimeSig = (val: TimeSignature) => isRecorded ? (setQtValue(val.numerator), setUtValue(val.denominator)) : setPreRecordTimeSignature(val);
  const currentTonality = isRecorded ? tonality : preRecordTonality;
  const setAnyTonality = (val: string) => isRecorded ? setTonality(val) : setPreRecordTonality(val);
  
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    const ms = Math.floor((secs % 1) * 10).toString();
    return `${m}:${s}.${ms}`;
  };

  return (
    <div className="w-full h-[52px] bg-[#1a1a1a] flex items-center justify-between px-4 shrink-0 shadow-md z-50 relative">
      <div className="flex-1 flex justify-start">
        {/* Espaço reservado à esquerda para manter o centro alinhado */}
      </div>

      <div className="flex items-center justify-center gap-2">
        {/* Record Button */}
        <div className="bg-black/20 rounded-lg p-1 flex items-center justify-center">
          <button 
            onClick={onStartRecording}
            className="p-1.5 rounded-md hover:bg-white/5 transition-colors flex items-center justify-center"
            title="Gravar"
          >
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse-subtle" />
          </button>
        </div>
        {/* Transport Controls */}
        <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1">
          <button onClick={handleSkipBack} className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"><SkipBack size={16} /></button>
          <button onClick={isPlaying ? onStop : () => onPlay(time)} className={`p-1.5 rounded-md transition-colors ${isPlaying ? "text-black bg-white hover:bg-gray-200" : "text-white hover:bg-white/5"}`}>{isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
          <button onClick={onStop} className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"><Square size={14} /></button>
          <button onClick={handleSkipForward} className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"><SkipForward size={16} /></button>
        </div>

        {/* Unified Settings Button & Pills */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`flex items-center justify-center p-1.5 border rounded-lg transition-all duration-300 ${isSettingsOpen ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-black/40 border-white/10 text-white/70 hover:bg-white/5 hover:text-white'}`}
          >
            <Settings2 size={16} />
          </button>
          
          {/* Pills to show current configuration */}
          <div className="flex items-center gap-1.5 ml-2 hidden sm:flex">
            {(currentTimeSig.numerator !== 4 || currentTimeSig.denominator !== 4) && (
              <span className="px-2 py-1 rounded-md bg-white border border-white text-[10px] font-mono font-semibold text-black">
                {currentTimeSig.numerator}/{currentTimeSig.denominator}
              </span>
            )}
            {currentBpm !== "AUTO" && (
              <span className="px-2 py-1 rounded-md bg-white border border-white text-[10px] font-mono font-semibold text-black">
                {currentBpm} BPM
              </span>
            )}
            {currentTonality !== "AUTO" && (
              <span className="px-2 py-1 rounded-md bg-white border border-white text-[10px] font-mono font-semibold text-black">
                Tom: {currentTonality}
              </span>
            )}
            {(!isRecorded && (currentBpm === "AUTO" || currentTonality === "AUTO")) && (
              <span className="px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400/80">
                Detecção Automática Ativa
              </span>
            )}
          </div>

          {/* Settings Popup (Below the topbar) */}
          {isSettingsOpen && (
            <div 
              ref={settingsRef}
              className="absolute top-full mt-3 left-0 w-[480px] backdrop-blur-sm p-4 flex flex-col sm:flex-row gap-6 animate-fade-in origin-top z-50 shadow-2xl"
              style={{
                borderRadius: '20px',
                border: '1px solid transparent',
                backgroundImage: 'linear-gradient(90deg, rgba(10, 10, 10, 0.95) 0%), linear-gradient(135deg, rgba(32, 32, 32, 0.98) 0%, transparent 40%)',
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
                        onClick={() => setAnyTimeSig({ ...currentTimeSig, numerator: n })}
                        className={`py-1 text-xs font-medium rounded transition-colors ${currentTimeSig.numerator === n ? "bg-emerald-500/20 text-emerald-400" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="text-white/20 text-lg font-light">/</span>
                  <div className="flex flex-col gap-1 w-full bg-black/40 rounded-lg p-1.5 border border-white/5">
                    {DENOMINATOR_OPTIONS.map((d) => (
                      <button
                        key={`den-${d}`}
                        onClick={() => setAnyTimeSig({ ...currentTimeSig, denominator: d })}
                        className={`py-1 text-xs font-medium rounded transition-colors ${currentTimeSig.denominator === d ? "bg-emerald-500/20 text-emerald-400" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
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
                  <Activity size={12} /> Velocidade
                </span>
                {!isRecorded && (
                  <button
                    onClick={() => setAnyBpm("AUTO")}
                    className={`mt-2 w-full py-2 rounded-lg text-xs font-medium transition-colors border ${currentBpm === "AUTO" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-black/40 border-white/5 text-white/60 hover:bg-white/5 hover:text-white"}`}
                  >
                    Auto-detectar
                  </button>
                )}
                <div className="mt-2">
                  <input 
                    type="number"
                    min="40"
                    max="300"
                    placeholder="Digite o BPM (ex: 120)"
                    value={customBpmStr}
                    onChange={(e) => {
                      setCustomBpmStr(e.target.value);
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        setAnyBpm(val);
                      }
                    }}
                    onBlur={() => {
                      if (customBpmStr === "" && currentBpm !== "AUTO") {
                        setCustomBpmStr("120");
                        setAnyBpm(120);
                      } else if (currentBpm === "AUTO") {
                        setCustomBpmStr("");
                      }
                    }}
                    className="w-full bg-black/40 border border-white/5 rounded-lg py-2 px-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* Tonality */}
              <div className="flex-1 flex flex-col gap-2">
                <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 flex items-center gap-1.5">
                  <Music size={12} /> Tonalidade
                </span>
                {!isRecorded && (
                  <button
                    onClick={() => setAnyTonality("AUTO")}
                    className={`mt-2 w-full py-2 rounded-lg text-xs font-medium transition-colors border ${currentTonality === "AUTO" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-black/40 border-white/5 text-white/60 hover:bg-white/5 hover:text-white"}`}
                  >
                    Auto-detectar
                  </button>
                )}
                <select
                  value={currentTonality}
                  onChange={(e) => setAnyTonality(e.target.value)}
                  className={`mt-2 w-full bg-black/40 border rounded-lg py-2 px-3 text-xs font-medium focus:outline-none appearance-none cursor-pointer transition-colors ${currentTonality !== "AUTO" ? "border-emerald-500/50 text-emerald-400" : "border-white/5 text-white/60 hover:border-white/20"}`}
                >
                  {(!isRecorded && currentTonality === "AUTO") && <option value="AUTO" disabled>Selecionar...</option>}
                  {ALL_TONALITIES.map(t => (
                    <option key={t.value} value={t.value} className="bg-zinc-900 text-white">{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex-1" />
        
        {/* Marcador de Tempo */}
        <div className="flex items-center ml-4 px-3 py-1 bg-black/40 rounded-md shadow-inner">
          <span className="font-mono text-sm tracking-wider text-white w-16 text-center">{formatTime(time)}</span>
        </div>
      </div>

      <div className="flex-1 flex justify-end items-center gap-2 pr-2">
        <button 
          onClick={toggleSceneBar}
          className={`p-2 rounded-md transition-colors ${isSceneBarOpen ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}
          title={isSceneBarOpen ? "Recolher SceneBar" : "Expandir SceneBar"}
        >
          <PanelRight size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
