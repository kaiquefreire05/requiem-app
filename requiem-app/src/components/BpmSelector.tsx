import { useState, useRef, useEffect } from "react";
import { Activity } from "lucide-react";

interface Props {
  value: number | "AUTO";
  onChange: (val: number | "AUTO") => void;
  disabled?: boolean;
}

const COMMON_BPMS = [80, 90, 100, 120, 140, 160];

export function BpmSelector({ value, onChange, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative z-50" ref={containerRef}>
      {/* Gatilho */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex flex-col items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-neutral-900 border border-white/10 rounded-xl transition-all duration-300
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-neutral-800 hover:border-white/20 hover:scale-105 cursor-pointer"}
          ${isOpen ? "ring-2 ring-emerald-500/50 border-emerald-500/30 bg-neutral-800" : ""}
        `}
      >
        <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/50 mb-0.5" />
        <span className="text-[10px] sm:text-xs font-bold font-sans text-white leading-none tracking-tighter">
          {value === "AUTO" ? "AUTO" : value}
        </span>
      </button>

      {/* Popover */}
      {isOpen && !disabled && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full left-0 mt-3 p-3 bg-neutral-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col gap-2 animate-fade-in origin-top w-40"
        >
          <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 mb-1 text-center">Batidas por Min.</span>
          
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => {
                onChange("AUTO");
                setIsOpen(false);
              }}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                value === "AUTO"
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "border-white/5 text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              AUTO IA
            </button>
          </div>

          <div className="w-full h-px bg-white/10 my-1" />

          <div className="grid grid-cols-3 gap-1">
            {COMMON_BPMS.map((b) => (
              <button
                key={b}
                onClick={() => {
                  onChange(b);
                  setIsOpen(false);
                }}
                className={`py-1.5 rounded-md text-sm font-medium transition-colors ${
                  value === b
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
            <input 
              type="number"
              min="40"
              max="240"
              placeholder="Custom"
              value={value === "AUTO" ? "" : value}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) onChange(val);
              }}
              className="w-full bg-black/50 border border-white/10 rounded-md py-1 px-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>

        </div>
      )}
    </div>
  );
}
