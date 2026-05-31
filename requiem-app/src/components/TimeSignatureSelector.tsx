import { useState, useRef, useEffect } from "react";

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

interface Props {
  value: TimeSignature;
  onChange: (val: TimeSignature) => void;
  disabled?: boolean;
}

const NUMERATOR_OPTIONS = [2, 3, 4, 6, 9];
const DENOMINATOR_OPTIONS = [4, 8];

export function TimeSignatureSelector({ value, onChange, disabled }: Props) {
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
      {/* Gatilho (Botão com estética de partitura) */}
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
        <span className="text-xl font-bold font-sans text-white leading-none tracking-tighter">
          {value.numerator}
        </span>
        <div className="w-6 h-px bg-white/20 my-[2px]" />
        <span className="text-xl font-bold font-sans text-white leading-none tracking-tighter">
          {value.denominator}
        </span>
      </button>

      {/* Popover Minimalista */}
      {isOpen && !disabled && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full left-0 mt-3 p-3 bg-neutral-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex gap-4 animate-fade-in origin-top"
        >
          
          {/* Numerador */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 mb-1">QTD</span>
            <div className="flex flex-col gap-1 h-auto rounded-lg border border-white/5 bg-black/50 p-1">
              {NUMERATOR_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => onChange({ ...value, numerator: n })}
                  className={`w-10 py-1.5 snap-center rounded-md text-sm font-medium transition-colors ${
                    value.numerator === n
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px bg-white/10 my-2" />

          {/* Denominador */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 mb-1">UND</span>
            <div className="flex flex-col gap-1 h-auto rounded-lg border border-white/5 bg-black/50 p-1">
              {DENOMINATOR_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    onChange({ ...value, denominator: d });
                    setIsOpen(false); // Auto-close on denominator click for UX
                  }}
                  className={`w-10 py-1.5 snap-center rounded-md text-sm font-medium transition-colors ${
                    value.denominator === d
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
