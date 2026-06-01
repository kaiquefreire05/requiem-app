import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Keyboard, Music, Radio, ChevronDown } from "lucide-react";
import type { InstrumentType } from "../App";

export interface TrackHeadersProps {
  rulerHeight: number;
  melodyInstrument: InstrumentType;
  setMelodyInstrument: (v: InstrumentType) => void;
  chordsInstrument: InstrumentType;
  setChordsInstrument: (v: InstrumentType) => void;
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
  setChordsInstrument
}: TrackHeadersProps) {
  // Dummy states for visual completeness
  const [melodyMuted, setMelodyMuted] = useState(false);
  const [chordsMuted, setChordsMuted] = useState(false);

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
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setMelodyMuted(!melodyMuted)}
              className={`p-1.5 rounded-md transition-colors ${melodyMuted ? 'text-red-400 bg-red-400/10' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}
            >
              {melodyMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── TRACK 2: CHORDS ── */}
      <div className="h-40 flex-none flex flex-col bg-[#121212] border-b border-white/5">
        <div className="flex items-start justify-between px-3 py-3 opacity-90 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2">
            <div className="w-1 h-8 bg-white/50 rounded-full" />
            <div>
              <div className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Track 2</div>
              <div className="text-xs sm:text-sm font-semibold tracking-wide text-white/90">CHORDS</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-3 pb-3 mt-auto">
          {/* Instrument Selector */}
          <InstrumentSelector value={chordsInstrument} onChange={setChordsInstrument} />

          {/* Volume/Mute Controls */}
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setChordsMuted(!chordsMuted)}
              className={`p-1.5 rounded-md transition-colors ${chordsMuted ? 'text-red-400 bg-red-400/10' : 'text-white/50 hover:bg-white/10 hover:text-white'}`}
            >
              {chordsMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
