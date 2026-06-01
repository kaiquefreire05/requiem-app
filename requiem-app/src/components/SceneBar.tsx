import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { CompositionBlock } from "../App";

export interface SceneBarProps {
  blocks: CompositionBlock[];
  activeBlockId: string;
  onActiveBlockChange: (id: string) => void;
  onAddBlock: () => void;
  onRemoveBlock: (id: string) => void;
  onRenameBlock: (id: string, newName: string) => void;
  appState: string;
  currentFrequency: number;
  onStopRecording: () => void;
}

export function SceneBar({
  blocks,
  activeBlockId,
  onActiveBlockChange,
  onAddBlock,
  onRemoveBlock,
  onRenameBlock,
  appState,
  currentFrequency,
  onStopRecording,
}: SceneBarProps) {
  const [renamingBlockId, setRenamingBlockId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  return (
    <div className="w-full h-14 bg-[#141414] flex items-center px-4 overflow-x-auto gap-3 shrink-0 z-50 relative pointer-events-auto">
      {blocks.map(block => {
        const isThisActive = block.id === activeBlockId;
        const isThisRecording = isThisActive && (appState === "RECORDING" || appState === "COUNT_IN" || appState === "PROCESSING");
        
        const normalizedFreq = Math.min(Math.max((currentFrequency - 100) / 900, 0), 1);
        const baseHue = 240 - (normalizedFreq * 260); // 240 to -20
        const hasFreq = currentFrequency > 0;
        
        let dynamicStyle = {};
        if (isThisRecording && hasFreq) {
          dynamicStyle = {
             backgroundColor: `hsl(${baseHue}, 80%, 40%)`,
             boxShadow: `0 0 15px hsl(${baseHue}, 80%, 50%)`,
          };
        } else if (isThisRecording) {
          dynamicStyle = {
             backgroundColor: `#ec4899`,
             boxShadow: `0 0 10px rgba(236, 72, 153, 0.5)`,
          };
        }

        let buttonText = block.name;
        if (isThisActive) {
          if (appState === "COUNT_IN") buttonText = "Contagem...";
          if (appState === "RECORDING") buttonText = "Gravando...";
          if (appState === "PROCESSING") buttonText = "Processando...";
        }

        const isRenaming = renamingBlockId === block.id;

        return (
          <div key={block.id} className="relative group flex items-center">
            {isRenaming ? (
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => {
                  if (editName.trim()) onRenameBlock(block.id, editName.trim());
                  setRenamingBlockId(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (editName.trim()) onRenameBlock(block.id, editName.trim());
                    setRenamingBlockId(null);
                  } else if (e.key === 'Escape') {
                    setRenamingBlockId(null);
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bg-white/10 text-white outline-none w-28 text-center"
              />
            ) : (
              <button
                onDoubleClick={() => {
                  if (!isThisRecording) {
                    setEditName(block.name);
                    setRenamingBlockId(block.id);
                  }
                }}
                onClick={() => {
                  if (isThisRecording && appState === "RECORDING") {
                    onStopRecording();
                  } else if (appState === "IDLE") {
                    onActiveBlockChange(block.id);
                  }
                }}
                style={dynamicStyle}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-300 outline-none ${
                  isThisRecording
                    ? 'text-white'
                    : isThisActive 
                      ? 'bg-white text-black' 
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {buttonText}
              </button>
            )}
            
            {!isThisRecording && !isRenaming && (
              <button 
                onClick={(e) => { e.stopPropagation(); onRemoveBlock(block.id); }}
                className="absolute -top-1.5 -right-1.5 p-1 bg-white hover:bg-gray-200 text-black rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md scale-90 hover:scale-100"
                title="Excluir Seção"
              >
                <Trash2 size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>
        );
      })}
      
      <button
        onClick={appState === "IDLE" ? onAddBlock : undefined}
        className={`px-4 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors outline-none ${
          appState === "IDLE" 
            ? 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white' 
            : 'bg-white/[0.02] text-white/20 cursor-not-allowed'
        }`}
      >
        + Adicionar Nova Seção
      </button>
    </div>
  );
}
