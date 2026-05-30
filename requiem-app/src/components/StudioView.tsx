import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { INoteSequence } from "@magenta/music";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Square,
  Sparkles,
  ShieldCheck,
  Mic,
  Metronome,
  ZoomIn,
  ZoomOut,
  Trash2,
  Plus,
} from "lucide-react";
import { PianoRoll } from "./PianoRoll";
import { ChordRoll } from "./ChordRoll";
import { HARMONY_GRAPH, transitionMatrix } from "../engine/HarmonyEngine";

// ─────────────────────────────────────────────────────────
//  Constantes do Piano Roll
// ─────────────────────────────────────────────────────────
const RULER_HEIGHT = 28;

import type { CompositionBlock, ChordSegment } from "../App";

// ─────────────────────────────────────────────────────────
//  Tipos
// ─────────────────────────────────────────────────────────
interface StudioViewProps {
  blocks: CompositionBlock[];
  activeBlockId: string;
  onActiveBlockChange: (id: string) => void;
  onAddBlock: () => void;
  onRemoveBlock: (id: string) => void;
  onRenameBlock: (id: string, newName: string) => void;
  appState: string;
  currentFrequency: number;
  onStopRecording: () => void;
  noteSequence?: INoteSequence;
  progression: ChordSegment[];
  onUpdateProgression: (progression: ChordSegment[]) => void;
  bpm: number;
  setBpm: (v: number) => void;
  qtValue: number;
  setQtValue: (v: number) => void;
  utValue: number;
  setUtValue: (v: number) => void;
  isPlaying: boolean;
  onPlay: (time?: number) => void;
  onStop: () => void;
  onRecordAgain?: () => void;
}

// ─────────────────────────────────────────────────────────
//  Componente: BPM Input (Controlled)
// ─────────────────────────────────────────────────────────
function BpmInput({ bpm, setBpm }: { bpm: number; setBpm: (v: number) => void }) {
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
//  Componente Principal: StudioView
// ─────────────────────────────────────────────────────────
export function StudioView({
  blocks,
  activeBlockId,
  onActiveBlockChange,
  onAddBlock,
  onRemoveBlock,
  onRenameBlock,
  appState,
  currentFrequency,
  onStopRecording,
  noteSequence,
  progression,
  bpm,
  setBpm,
  qtValue,
  setQtValue,
  utValue,
  setUtValue,
  isPlaying,
  onPlay,
  onStop,
  onUpdateProgression,
  onRecordAgain,
}: StudioViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [renamingBlockId, setRenamingBlockId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // ── Controle de Zoom ──
  const [pxPerSecond, setPxPerSecond] = useState(100);

  // ── Controle de Playhead (Tempo Real) ──
  const [time, setTime] = useState(0);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    if (!isPlaying) {
      setTime(0);
      return;
    }
    
    lastUpdateRef.current = Date.now();
    let frameId: number;

    const tick = () => {
      const now = Date.now();
      const delta = (now - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = now;
      setTime((prev) => prev + delta);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    const ms = Math.floor((secs % 1) * 10).toString();
    return `${m}:${s}.${ms}`;
  };

  // ── Derive data from NoteSequence ──
  const { melodyNotes, totalSongSeconds } = useMemo(() => {
    const allNotes = noteSequence?.notes || [];
    let tMax = 0;
    const mNotes: typeof allNotes = [];
    const hNotes: typeof allNotes = [];

    for (const n of allNotes) {
      if (n.endTime != null && n.endTime > tMax) tMax = n.endTime;
      if (n.instrument === 0) mNotes.push(n);
      else if (n.instrument === 1) hNotes.push(n);
    }
    return { melodyNotes: mNotes, totalSongSeconds: Math.max(tMax, 4) };
  }, [noteSequence]);

  const handleSkipBack = useCallback(() => {
    setTime(0);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, []);

  const handleSkipForward = useCallback(() => {
    setTime(totalSongSeconds);
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [totalSongSeconds]);

  // Autoscroll playhead
  useEffect(() => {
    if (isPlaying && scrollRef.current) {
      const scrollEl = scrollRef.current;
      const playheadX = time * pxPerSecond;
      const viewWidth = scrollEl.clientWidth;
      const scrollX = scrollEl.scrollLeft;
      
      // Keep playhead in view
      if (playheadX > scrollX + viewWidth * 0.8) {
        scrollEl.scrollLeft = playheadX - viewWidth * 0.2;
      }
    }
  }, [time, isPlaying, pxPerSecond]);

  // Handle Ruler Dragging
  const handleRulerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    let finalTime = time;

    const updateTime = (clientX: number) => {
      if (!scrollRef.current || !scrollRef.current.firstElementChild) return;
      const rect = scrollRef.current.firstElementChild.getBoundingClientRect();
      const x = clientX - rect.left;
      let newT = Math.max(0, x / pxPerSecond);

      // Snap to measure
      const measureDuration = (4 / utValue) * (60 / bpm) * qtValue;
      const snapT = Math.round(newT / measureDuration) * measureDuration;
      
      // se estiver muito próximo do compasso (ex: 15 pixels), snap
      if (Math.abs(snapT * pxPerSecond - x) < 15) {
        newT = snapT;
      }
      
      finalTime = newT;
      setTime(newT);
    };
    updateTime(e.clientX);
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      updateTime(moveEvent.clientX);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      
      // Retrigger playback se estava tocando
      if (isPlaying) {
        onPlay(finalTime);
      }
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [pxPerSecond, utValue, bpm, qtValue, isPlaying, onPlay, time]);

  // Grid / Measure logic
  const secondsPerBeat = (4 / utValue) * (60 / bpm);
  const secondsPerMeasure = secondsPerBeat * qtValue;
  
  // Assegurar que a malha ocupe toda a tela calculando compassos o suficiente (ex: mínimo de ~4000px)
  const minCanvasWidth = 4000;
  const minMeasures = Math.ceil(minCanvasWidth / (secondsPerMeasure * pxPerSecond));
  const requiredMeasuresForSong = Math.ceil(totalSongSeconds / secondsPerMeasure);
  const measureCount = Math.max(minMeasures, requiredMeasuresForSong + 4);
  const canvasWidth = measureCount * secondsPerMeasure * pxPerSecond;

  const [localProgression, setLocalProgression] = useState<typeof progression | null>(null);
  const displayProgression = localProgression || progression;

  const handleResizeStart = useCallback((e: React.MouseEvent, dir: "left" | "right", index: number) => {
    e.stopPropagation();
    const startX = e.clientX;
    const currentProg = localProgression || progression;
    const initialDurationBeats = currentProg[index].durationBeats;
    const prevInitialDurationBeats = index > 0 ? currentProg[index - 1].durationBeats : 0;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const pxPerBeat = secondsPerBeat * pxPerSecond;
      const deltaBeats = Math.round(deltaX / pxPerBeat); // Snap aos compassos/tempos
      
      const newProg = [...currentProg];
      
      if (dir === "right") {
        const newDur = Math.max(1, initialDurationBeats + deltaBeats); // Mínimo 1 tempo
        newProg[index] = { ...newProg[index], durationBeats: newDur };
      } else if (dir === "left" && index > 0) {
        // Ao redimensionar pela esquerda, afeta o acorde anterior
        const newDur = Math.max(1, initialDurationBeats - deltaBeats);
        const newPrevDur = Math.max(1, prevInitialDurationBeats + deltaBeats);
        newProg[index] = { ...newProg[index], durationBeats: newDur };
        newProg[index - 1] = { ...newProg[index - 1], durationBeats: newPrevDur };
      }
      
      setLocalProgression(newProg);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setLocalProgression(curr => {
        if (curr) onUpdateProgression(curr);
        return null;
      });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [localProgression, progression, secondsPerBeat, pxPerSecond, onUpdateProgression]);

  // Drag and Drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const handleDragStart = (i: number) => setDraggedIndex(i);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    const newProg = [...progression];
    const [item] = newProg.splice(draggedIndex, 1);
    newProg.splice(dropIndex, 0, item);
    onUpdateProgression(newProg);
    setDraggedIndex(null);
  };


  return (
    <div className="flex flex-col h-full bg-[#141414] text-white overflow-hidden animate-fade-in font-sans relative">
      
      {/* ── Top Bar ── */}
      <div className="w-full h-[52px] bg-[#1a1a1a] border-b border-[#000] flex items-center justify-between px-4 shrink-0 shadow-sm z-50 relative">
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
          <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-lg p-1 border border-white/5">
            <button onClick={handleSkipBack} className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"><SkipBack size={16} /></button>
            <button onClick={isPlaying ? onStop : () => onPlay(time)} className={`p-1.5 rounded-md transition-colors ${isPlaying ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20" : "text-white hover:bg-white/5"}`}>{isPlaying ? <Pause size={16} /> : <Play size={16} />}</button>
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
          
          <div className="flex-1" />
          
          {/* Marcador de Tempo */}
          <div className="flex items-center ml-4 px-3 py-1 bg-black/40 rounded-md border border-white/5 shadow-inner">
            <span className="font-mono text-sm tracking-wider text-sky-400/90 w-16 text-center">{formatTime(time)}</span>
          </div>
        </div>

        <div className="flex-1 flex justify-end items-center gap-2 pr-2"></div>
      </div>

      {/* ── Scene Bar ── */}
      <div className="w-full h-14 bg-[#141414] border-b border-[#000] flex items-center px-4 overflow-x-auto gap-3 shrink-0 z-50 relative pointer-events-auto">
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
                  className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-white/10 text-white outline-none w-28 text-center border border-sky-400"
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
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 border outline-none ${
                    isThisRecording
                      ? 'text-white border-transparent'
                      : isThisActive 
                        ? 'bg-sky-500 text-white border-sky-400' 
                        : 'bg-white/5 text-white/60 border-transparent hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {buttonText}
                </button>
              )}
              
              {!isThisRecording && !isRenaming && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onRemoveBlock(block.id); }}
                  className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 hover:bg-red-400 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md scale-90 hover:scale-100"
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
          className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
            appState === "IDLE" 
              ? 'border-white/20 text-white/50 hover:bg-white/5 hover:text-white' 
              : 'border-white/5 text-white/20 cursor-not-allowed'
          }`}
        >
          + Adicionar Nova Seção
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Track Headers (Left Column) ── */}
        <div className="w-[200px] flex flex-col shrink-0 border-r border-[#000] bg-[#1a1a1a] z-20">
          <div style={{ height: `${RULER_HEIGHT}px` }} className="border-b border-[#000] bg-[#1a1a1a]" />
          
          <div className="h-40 flex-none flex flex-col border-b border-[#000]">
            <div className="flex items-center gap-2 px-4 py-3 opacity-90 hover:opacity-100 transition-opacity flex-1">
              <div className="w-1 h-full bg-[#a855f7] rounded-full" />
              <div>
                <div className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Track 1</div>
                <div className="text-sm font-semibold tracking-wide text-white/90">LEAD MELODY</div>
              </div>
            </div>
          </div>

          <div className="h-40 flex-none flex flex-col border-b border-[#000]">
            <div className="flex items-center gap-2 px-4 py-3 opacity-90 hover:opacity-100 transition-opacity flex-1">
              <div className="w-1 h-full bg-[#ec4899] rounded-full" />
              <div>
                <div className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Track 2</div>
                <div className="text-sm font-semibold tracking-wide text-white/90">CHORDS</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Timeline Area (Right Column) ── */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#111]">
          
          {/* Zoom Controls Overlay */}
          <div className="absolute top-0 right-0 h-[28px] z-50 flex items-center pr-4 pl-12 bg-gradient-to-l from-[#111] via-[#111]/80 to-transparent pointer-events-none">
            <div className="flex items-center gap-1 bg-[#2a2a2a] border border-white/10 rounded-md shadow-lg px-1 py-0.5 pointer-events-auto">
              <button onClick={() => setPxPerSecond(p => Math.max(20, p - 20))} className="p-1 hover:bg-white/10 rounded text-white/80 transition-colors"><ZoomOut size={12} /></button>
              <button onClick={() => setPxPerSecond(p => Math.min(400, p + 20))} className="p-1 hover:bg-white/10 rounded text-white/80 transition-colors"><ZoomIn size={12} /></button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div style={{ width: `${canvasWidth}px` }} className="h-full flex flex-col relative">
              
              {/* Ruler */}
              <div 
                style={{ height: `${RULER_HEIGHT}px` }} 
                className="relative border-b border-black/50 bg-[#222] text-white/80 shrink-0 sticky top-0 z-40 cursor-pointer"
                onMouseDown={handleRulerMouseDown}
              >
                {Array.from({ length: measureCount }).map((_, i) => {
                  const left = i * secondsPerMeasure * pxPerSecond;
                  return (
                    <div key={i} className="absolute bottom-0 flex flex-col items-start" style={{ left: `${left}px` }}>
                      <span className="text-[10px] font-bold text-white/40 ml-1 mb-0.5">{i + 1}</span>
                      <div className="w-px h-2 bg-white/20" />
                    </div>
                  );
                })}
              </div>

            {/* Grid Overlay */}
            <div className="absolute top-[28px] bottom-0 left-0 right-0 pointer-events-none z-0">
              {Array.from({ length: measureCount * qtValue }).map((_, i) => {
                const left = i * secondsPerBeat * pxPerSecond;
                const isMeasure = i % qtValue === 0;
                return (
                  <div key={i} className={`absolute top-0 bottom-0 w-px ${isMeasure ? 'bg-white/10' : 'bg-white/[0.03]'}`} style={{ left: `${left}px` }} />
                );
              })}
            </div>

            {/* Playhead Marker */}
            <div 
              className="absolute top-[28px] bottom-0 w-px bg-sky-400 z-30 shadow-[0_0_8px_#38bdf8] pointer-events-none"
              style={{ left: `${time * pxPerSecond}px`, display: time > 0 ? 'block' : 'none' }}
            >
              <div className="absolute -top-[28px] -left-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-sky-400" />
            </div>

            {/* Tracks Container */}
            <div className="flex-1 flex flex-col relative z-10">
              
              {/* Melody Lane */}
              <div className="h-40 flex-none relative border-b border-[#000]">
                {melodyNotes.length > 0 && (() => {
                  const firstNote = melodyNotes.reduce((min, n) => (n.startTime! < min.startTime! ? n : min), melodyNotes[0]);
                  const lastNote = melodyNotes.reduce((max, n) => (n.endTime! > max.endTime! ? n : max), melodyNotes[0]);
                  const left = firstNote.startTime! * pxPerSecond;
                  const width = (lastNote.endTime! - firstNote.startTime!) * pxPerSecond;
                  return (
                    <div className="absolute top-2 bottom-2 rounded-md overflow-hidden" style={{ left: `${left}px`, width: `${width}px` }}>
                      <PianoRoll notes={melodyNotes} laneColorClass="bg-[#a855f7]/80" pxPerSecond={pxPerSecond} />
                      <div className="absolute top-1 left-2 text-[9px] font-bold text-white/80 tracking-widest pointer-events-none drop-shadow-md">MELODY CLIP</div>
                    </div>
                  );
                })()}
              </div>

              {/* Harmony Lane */}
              <div className="h-40 flex-none relative border-b border-[#000]">
                {(() => {
                  const pxPerBeat = secondsPerBeat * pxPerSecond;
                  let currentBeats = 0;
                  
                  const elements = displayProgression.map((chordObj, i) => {
                    const left = currentBeats * pxPerBeat;
                    const width = chordObj.durationBeats * pxPerBeat;
                    currentBeats += chordObj.durationBeats;
                    
                    return (
                      <ChordBlock
                        key={chordObj.id}
                        chord={chordObj.chord}
                        left={left}
                        width={width}
                        prevChord={i > 0 ? displayProgression[i - 1].chord : "C"}
                        onReplace={(newChord) => {
                          const newProg = [...displayProgression];
                          newProg[i] = { ...newProg[i], chord: newChord };
                          onUpdateProgression(newProg);
                        }}
                        onResizeStart={(e, dir) => handleResizeStart(e, dir, i)}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, i)}
                        onRemove={() => {
                          const newProg = [...displayProgression];
                          newProg.splice(i, 1);
                          onUpdateProgression(newProg);
                        }}
                      />
                    );
                  });

                  // Botão Adicionar Acorde (Fundo Cinza)
                  const totalLeft = currentBeats * pxPerBeat;
                  const defaultWidth = qtValue * pxPerBeat;
                  elements.push(
                    <div 
                      key="add-chord"
                      className="absolute top-2 bottom-2 rounded-[14px] bg-[#333] hover:bg-[#444] transition-colors flex items-center justify-center cursor-pointer shadow-md text-white/50 hover:text-white"
                      style={{ left: `${totalLeft + 2}px`, width: `${defaultWidth - 4}px` }}
                      onClick={() => {
                         const newProg = [...progression, {
                           id: Date.now().toString(),
                           chord: "C",
                           durationBeats: qtValue
                         }];
                         onUpdateProgression(newProg);
                      }}
                    >
                      <Plus size={24} />
                    </div>
                  );
                  
                  return elements;
                })()}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  Componente: Chord Block com Smart Menu
// ─────────────────────────────────────────────────────────
function ChordBlock({
  chord, left, width, prevChord, onReplace, onResizeStart,
  draggable, onDragStart, onDragOver, onDrop, onRemove
}: {
  chord: string; left: number; width: number; prevChord: string; 
  onReplace: (c: string) => void; onResizeStart: (e: React.MouseEvent, dir: "left" | "right") => void;
  draggable?: boolean; onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void; onDrop?: (e: React.DragEvent) => void;
  onRemove: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Lógica da Encruzilhada (Math vs Dataset)
  const { mathChords, dataChords } = useMemo(() => {
    const node = HARMONY_GRAPH[prevChord] || HARMONY_GRAPH["C"];
    const transitions = node.allowedTransitions || [];
    const probs = transitionMatrix[prevChord] || {};
    
    // Dataset Chords: acordes que aparecem nas músicas e têm probabilidade > 0
    const dataList = Object.entries(probs)
      .filter(([c, p]) => p > 0 && c !== chord)
      .sort((a, b) => b[1] - a[1])
      .map(([c, p]) => ({ chord: c, prob: p }));

    // Math Chords: acordes teóricos válidos pelo grafo que não apareceram no dataset
    const dataSet = new Set(dataList.map(x => x.chord));
    const mathList = transitions.filter(c => c !== chord && !dataSet.has(c));

    return { mathChords: mathList, dataChords: dataList };
  }, [chord, prevChord]);

  // Handle click ensuring the event is properly captured
  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelect = (e: React.MouseEvent, c: string) => {
    e.stopPropagation();
    onReplace(c);
    setIsOpen(false);
  };

  return (
    <div 
      className="absolute top-2 bottom-2 transition-all cursor-pointer group" 
      style={{ left: `${left + 2}px`, width: `${width - 4}px` }} 
      onClick={toggleMenu}
      draggable={draggable && !isOpen}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ChordRoll 
         chord={chord}
         width={width - 4}
         isSelected={isOpen}
         onResizeStart={(e, dir) => { e.stopPropagation(); onResizeStart(e, dir); }}
      />

      {!isOpen && (
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 hover:bg-red-400 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md scale-90 hover:scale-100 z-[60]"
          title="Excluir Acorde"
        >
          <Trash2 size={12} strokeWidth={2.5} />
        </button>
      )}

      {/* Smart Menu Hover / Popover */}
      {isOpen && (
        <div ref={menuRef} className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 animate-fade-in cursor-default max-h-80 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/30" onClick={e => e.stopPropagation()}>
          
          {/* Section 1: Math Alternatives */}
          {mathChords.length > 0 && (
            <div className="p-2 border-b border-white/5">
              <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest px-2 pb-1.5 mb-1 border-b border-white/5 flex items-center gap-1.5">
                <ShieldCheck size={12} /> Alternativas Teóricas
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                {mathChords.map((c, i) => (
                  <button
                    key={`math-${i}`}
                    onClick={(e) => handleSelect(e, c)}
                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-md text-xs font-mono font-medium text-white/70 hover:text-white transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Dataset (✨) */}
          {dataChords.length > 0 && (
            <div className="p-2 bg-zinc-950/50 rounded-b-xl">
              <div className="text-[10px] font-mono text-amber-400/80 uppercase tracking-widest px-2 pb-1.5 mb-1 border-b border-white/5 flex items-center gap-1.5">
                <Sparkles size={12} /> Dataset Patterns
              </div>
              <div className="mt-1">
                {dataChords.map((s, i) => (
                  <button
                    key={`data-${i}`}
                    onClick={(e) => handleSelect(e, s.chord)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-white/5 rounded text-xs font-mono font-bold text-white/90 group-hover:bg-amber-500/20 group-hover:text-amber-400">
                        ✨ {s.chord}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/40 font-mono">{(s.prob * 100).toFixed(0)}% peso</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
