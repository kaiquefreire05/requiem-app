import { Play } from "lucide-react";
import type { CompositionBlock } from "../App";

export interface ArrangementTimelineProps {
  blocks: CompositionBlock[];
  onPlayArrangement: () => void;
  handleDragStartArrangement: (i: number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDropArrangement: (e: React.DragEvent, dropIndex: number) => void;
}

export function ArrangementTimeline({
  blocks,
  onPlayArrangement,
  handleDragStartArrangement,
  handleDragOver,
  handleDropArrangement,
}: ArrangementTimelineProps) {
  return (
    <div className="flex-1 flex flex-col p-8 bg-[#111] overflow-y-auto">
      <div className="flex items-center justify-between mb-8 max-w-6xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-white/90 tracking-tight">Timeline do Arranjo</h2>
        <button
          onClick={onPlayArrangement}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all transform hover:scale-105"
        >
          <Play size={18} fill="currentColor" />
          <span>Reproduzir Música Completa</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-4 max-w-6xl mx-auto w-full">
        {blocks.map((block, i) => (
          <div
            key={block.id}
            draggable
            onDragStart={() => handleDragStartArrangement(i)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropArrangement(e, i)}
            className="flex flex-col bg-[#1c1c1c] hover:bg-[#252525] rounded-xl p-4 w-48 cursor-grab active:cursor-grabbing transition-colors shadow-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Bloco {i + 1}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-base font-semibold text-white truncate" title={block.name}>{block.name}</div>
            <div className="flex items-center gap-2 mt-3 text-[10px] font-mono text-white/50">
              <span className="px-1.5 py-0.5 bg-black/40 rounded">{block.bpm} BPM</span>
              <span className="px-1.5 py-0.5 bg-black/40 rounded">{block.timeSignature}</span>
              <span className="px-1.5 py-0.5 bg-black/40 rounded">{block.key}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
