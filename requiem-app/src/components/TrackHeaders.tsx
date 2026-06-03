import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Keyboard, Music, Radio, ChevronDown, Dices, Sparkles } from "lucide-react";
import type { InstrumentType } from "../App";

export interface TrackHeadersProps {
  rulerHeight: number;
  melodyInstrument: InstrumentType;
  setMelodyInstrument: (v: InstrumentType) => void;
  chordsInstrument: InstrumentType;
  setChordsInstrument: (v: InstrumentType) => void;
  melodyVolume: number;
  setMelodyVolume: (v: number) => void;
  melodyMuted: boolean;
  setMelodyMuted: (v: boolean) => void;
  chordsVolume: number;
  setChordsVolume: (v: number) => void;
  chordsMuted: boolean;
  setChordsMuted: (v: boolean) => void;
  onReroll?: () => void;
}

const INSTRUMENT_OPTIONS: { value: InstrumentType; label: string; icon: React.ReactNode }[] = [
  { value: "piano", label: "Acoustic Piano", icon: <Keyboard size={14} /> },
  { value: "strings", label: "Strings", icon: <Music size={14} /> },
  { value: "pad", label: "Ethereal Pad", icon: <Radio size={14} /> },
];

function InstrumentSelector({ 
  value, 
  onChange 
}: { 
  value: InstrumentType; 
  onChange: (v: InstrumentType) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption = INSTRUMENT_OPTIONS.find(o => o.value === value) || INSTRUMENT_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 bg-black/40 hover:bg-black/60 border border-white/5 hover:border-white/20 rounded-md transition-colors"
        title="Trocar Timbre"
      >
        <span className="text-white/70">{currentOption.icon}</span>
        <ChevronDown size={10} className="text-white/40" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-40 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 animate-fade-in">
          {INSTRUMENT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
                value === opt.value 
                  ? "bg-emerald-500/10 text-emerald-400" 
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TrackHeaders({ 
  rulerHeight,
  melodyInstrument,
  setMelodyInstrument,
  chordsInstrument,
  setChordsInstrument,
  melodyVolume,
  setMelodyVolume,
  melodyMuted,
  setMelodyMuted,
  chordsVolume,
  setChordsVolume,
  chordsMuted,
  setChordsMuted,
  onReroll,
}: TrackHeadersProps) {

  return (
    <div className="w-[220px] flex flex-col shrink-0 bg-[#131313] z-20 border-r border-white/5">
      <div style={{ height: `${rulerHeight}px` }} className="bg-[#1e1e1e] border-b border-white/5" />
      
      {/* ── TRACK 1: LEAD MELODY ── */}
      <div className="h-40 flex-none flex flex-col bg-[#181818] border-b border-white/5">
        <div className="flex items-start justify-between px-3 py-3 opacity-90 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2">
            <div className="w-1 h-8 bg-white/80 rounded-full" />
            <div>
              <div className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Track 1</div>
              <div className="text-xs sm:text-sm font-semibold tracking-wide text-white/90">LEAD MELODY</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-3 pb-3 mt-auto">
          {/* Instrument Selector */}
          <InstrumentSelector value={melodyInstrument} onChange={setMelodyInstrument} />

          {/* Volume/Mute Controls */}
          <div className="flex items-center gap-2">
            <input 
              type="range" 
              min="0" max="1" step="0.05"
              value={melodyVolume}
              onChange={(e) => setMelodyVolume(parseFloat(e.target.value))}
              className="w-16 h-1 bg-white/20 rounded-full appearance-none outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
            />
            <button 
              onClick={() => setMelodyMuted(!melodyMuted)}
              className={`p-1.5 rounded-md transition-colors ${melodyMuted ? 'text-red-400 bg-red-400/10' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}
            >
              {melodyMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>
        </div>
      </div>

      <div className="h-[96px] flex-none flex flex-col justify-center bg-[#121212] border-b border-white/5 relative px-3">
        <div className="flex items-start justify-between opacity-90 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2">
            <div className="w-1 h-8 bg-white/50 rounded-full" />
            <div>
              <div className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Track 2</div>
              <div className="flex items-center gap-2">
                <div className="text-xs sm:text-sm font-semibold tracking-wide text-white/90">CHORDS</div>
                <InstrumentSelector value={chordsInstrument} onChange={setChordsInstrument} />
              </div>
            </div>
          </div>
          
          {/* Botão Reroll */}
          {onReroll && (
            <button
              onClick={onReroll}
              className="group flex items-center justify-center p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
              title="Gerar nova progressão"
            >
              <div className="relative">
                <Dices size={14} className="text-white/70 group-hover:text-emerald-400 transition-colors" />
                <Sparkles size={8} className="absolute -top-1 -right-1 text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          )}
        </div>

        {/* Volume/Mute Controls */}
        <div className="flex items-center justify-end gap-2 mt-1 px-1 opacity-60 hover:opacity-100 transition-opacity">
          <input 
            type="range" 
            min="0" max="1" step="0.05"
            value={chordsVolume}
            onChange={(e) => setChordsVolume(parseFloat(e.target.value))}
            className="w-16 h-1 bg-white/20 rounded-full appearance-none outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
          />
          <button 
            onClick={() => setChordsMuted(!chordsMuted)}
            className={`p-1 rounded-md transition-colors ${chordsMuted ? 'text-red-400 bg-red-400/10' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}
          >
            {chordsMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
        </div>
      </div>

    </div>
  );
}
