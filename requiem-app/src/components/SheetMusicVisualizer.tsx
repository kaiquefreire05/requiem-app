import { useEffect, useRef, memo } from "react";
import type { INoteSequence } from "@magenta/music";
import { StaffSVGVisualizer, sequences } from "@magenta/music";
import type { StaffSVGVisualizerConfig } from "@magenta/music/esm/core/visualizer";
import "./SheetMusicVisualizer.css";

// ─────────────────────────────────────────────────────────
//  SheetMusicVisualizer
// ─────────────────────────────────────────────────────────
//  Renderiza uma partitura tradicional (pautas, claves,
//  notas com hastes) usando StaffSVGVisualizer do Magenta.
//
//  • Recebe um NoteSequence (melodia + harmonia mescladas).
//  • Cores invertidas via CSS para funcionar em bg-black.
//  • Recria o visualizador quando a prop muda.
// ─────────────────────────────────────────────────────────

export interface SheetMusicVisualizerProps {
  /** NoteSequence completo (melodia + harmonia) */
  noteSequence: INoteSequence | null;
  /** Configuração opcional do StaffSVGVisualizer */
  config?: StaffSVGVisualizerConfig;
}

/** Config padrão — exibe todas as vozes/instruments */
const DEFAULT_CONFIG: StaffSVGVisualizerConfig = {
  noteHeight: 6,
  noteSpacing: 1,
  pixelsPerTimeStep: 80,
  noteRGB: "255, 255, 255",        // branco para notas inativas
  activeNoteRGB: "220, 80, 80",    // carmesim para nota ativa
};

function SheetMusicVisualizerInner({
  noteSequence,
  config,
}: SheetMusicVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<StaffSVGVisualizer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Limpar conteúdo anterior
    while (container.firstChild) container.removeChild(container.firstChild);
    vizRef.current = null;

    // Sem sequence ou sem notas → nada a desenhar
    if (
      !noteSequence ||
      !noteSequence.notes ||
      noteSequence.notes.length === 0
    ) {
      return;
    }

    // Mesclar config
    const mergedConfig: StaffSVGVisualizerConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // O construtor do StaffSVGVisualizer recebe um <div> e
    // internamente cria o <svg> com a partitura dentro dele.
    
    // A partitura desenha com base em startTime/endTime em segundos.
    // Desquantizamos aqui para não afetar o Player (que usa o original quantizado).
    const seqToDraw = sequences.unquantizeSequence(noteSequence);

    vizRef.current = new StaffSVGVisualizer(
      seqToDraw,
      container,
      mergedConfig
    );

    vizRef.current.redraw();

    return () => {
      if (container) {
        while (container.firstChild) container.removeChild(container.firstChild);
      }
      vizRef.current = null;
    };
  }, [noteSequence, config]);

  return (
    <div
      ref={containerRef}
      className="sheet-music-visualizer"
    />
  );
}

const SheetMusicVisualizer = memo(SheetMusicVisualizerInner);
SheetMusicVisualizer.displayName = "SheetMusicVisualizer";
export default SheetMusicVisualizer;