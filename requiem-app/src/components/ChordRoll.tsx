import { memo } from "react";

interface ChordRollProps {
  chord: string;
  width: number;
  isSelected?: boolean;
  onResizeStart?: (e: React.MouseEvent, direction: "left" | "right") => void;
  onClick?: (e: React.MouseEvent) => void;
}

export const ChordRoll = memo(function ChordRoll({
  chord,
  width,
  isSelected,
  onResizeStart,
  onClick
}: ChordRollProps) {
  // Escolher uma cor baseada no acorde para dar variedade, 
  // mas usar o estilo da imagem (amarelo/verde limão) como base
  // A imagem mostra um bg-[#dfff1a] ou algo similar, com texto mais escuro.
  
  return (
    <div 
      className={`relative h-full flex items-center justify-center rounded-[5px] transition-all shadow-md overflow-hidden ${
        isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-[#111] z-20 bg-[#e0ff24]' : 'bg-[#d0f014] hover:bg-[#d8f81c]'
      }`}
      style={{ width: `${width}px` }}
      onClick={onClick}
    >
      <span className="text-[#8b990f] font-semibold text-xl tracking-tight select-none">
        {chord}
      </span>
      
      {isSelected && onResizeStart && (
        <>
          <div 
            className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-white/40 flex items-center justify-center"
            onMouseDown={(e) => onResizeStart(e, "left")}
          >
            <div className="w-0.5 h-4 bg-white/60 rounded-full" />
          </div>
          <div 
            className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-white/40 flex items-center justify-center"
            onMouseDown={(e) => onResizeStart(e, "right")}
          >
            <div className="w-0.5 h-4 bg-white/60 rounded-full" />
          </div>
        </>
      )}
    </div>
  );
});
