import { useState, useEffect } from "react";
import {
  Mic,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Square,
  Metronome,
} from "lucide-react";
import { ALL_TONALITIES } from "../engine/TonalityAdapter";

// ─────────────────────────────────────────────────────────
//  Componente: BPM Input (Controlled)
// ─────────────────────────────────────────────────────────
export function BpmInput({ bpm, setBpm }: { bpm: number; setBpm: (v: number) => void }) {
  const [localBpm, setLocalBpm] = useState(bpm.toString());
  useEffect(() => { setLocalBpm(bpm.toString()); }, [bpm]);

  const commit = () => {
    let num = parseInt(localBpm, 10);
    if (isNaN(num)) num = 120;
    num = Math.max(30, Math.min(300, num));
    setBpm(num);
    setLocalBpm(num.toString());
  };

  return (
    <input
      type="number"
      min={30}
      max={300}
      value={localBpm}
      onChange={e => setLocalBpm(e.target.value)}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && commit()}
      className="w-12 bg-transparent border-none text-sm font-mono text-white text-center focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

// ─────────────────────────────────────────────────────────
//  Props & Componente: TopBar
// ─────────────────────────────────────────────────────────
export interface TopBarProps {
  onRecordAgain?: () => void;
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
}

export function TopBar({
  onRecordAgain,
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
}: TopBarProps) {
  
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    const ms = Math.floor((secs % 1) * 10).toString();
    return `${m}:${s}.${ms}`;
  };

  return (
    <div className="w-full h-[52px] bg-[#1a1a1a] flex items-center justify-between px-4 shrink-0 shadow-md z-50 relative">
      <div className="flex-1 flex justify-start">
        <button 
          onClick={onRecordAgain}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Mic size={14} />
          <span>Gravar novamente</span>
        </button>
      </div>

      <div className="flex items-center justify-center gap-1">
        {/* Transport Controls */}
        <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1">
          <button onClick={handleSkipBack} className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"><SkipBack size={16} /></button>
          <button onClick={isPlaying ? onStop : () => onPlay(time)} className={`p-1.5 rounded-md transition-colors ${isPlaying ? "text-black bg-white hover:bg-gray-200" : "text-white hover:bg-white/5"}`}>{isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
          <button onClick={onStop} className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"><Square size={14} /></button>
          <button onClick={handleSkipForward} className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"><SkipForward size={16} /></button>
        </div>

        <div className="w-px h-6 bg-white/10 mx-3" />

        {/* BPM */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/40 font-mono">
            <Metronome size={12} />
            BPM
          </span>
          <BpmInput bpm={bpm} setBpm={setBpm} />
        </div>

        {/* Time Signature */}
        <div className="flex items-center gap-1 ml-3 text-sm font-mono text-white">
          <select value={qtValue} onChange={(e) => setQtValue(Number(e.target.value))} className="bg-transparent focus:outline-none appearance-none cursor-pointer"><option value={4}>4</option><option value={3}>3</option></select>
          <span className="text-white/30">/</span>
          <select value={utValue} onChange={(e) => setUtValue(Number(e.target.value))} className="bg-transparent focus:outline-none appearance-none cursor-pointer"><option value={4}>4</option><option value={8}>8</option></select>
        </div>

        <div className="w-px h-6 bg-white/10 mx-3" />

        {/* Tonality */}
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-[10px] uppercase tracking-widest font-mono">TOM</span>
          <select value={tonality} onChange={(e) => setTonality(e.target.value)} className="bg-transparent focus:outline-none appearance-none cursor-pointer text-sm font-mono text-white">
            {ALL_TONALITIES.map(t => <option key={t.value} value={t.value} className="bg-zinc-900">{t.value}</option>)}
          </select>
        </div>
        
        <div className="flex-1" />
        
        {/* Marcador de Tempo */}
        <div className="flex items-center ml-4 px-3 py-1 bg-black/40 rounded-md shadow-inner">
          <span className="font-mono text-sm tracking-wider text-white w-16 text-center">{formatTime(time)}</span>
        </div>
      </div>

      <div className="flex-1 flex justify-end items-center gap-2 pr-2"></div>
    </div>
  );
}
