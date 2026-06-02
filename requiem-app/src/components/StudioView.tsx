import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { INoteSequence } from "@magenta/music";
import { ZoomIn, ZoomOut, Plus, Trash2, ChevronRight, ChevronLeft, Play } from "lucide-react";
import { PianoRoll } from "./PianoRoll";
import { TopBar } from "./TopBar";
import { TrackHeaders } from "./TrackHeaders";
import { ChordBlock } from "./ChordBlock";
import type { TimeSignature } from "./TimeSignatureSelector";

// ─────────────────────────────────────────────────────────
//  Constantes do Piano Roll
// ─────────────────────────────────────────────────────────
const RULER_HEIGHT = 28;

import type { CompositionBlock, ChordSegment, InstrumentType } from "../App";

// ─────────────────────────────────────────────────────────
//  Tipos
// ─────────────────────────────────────────────────────────
interface StudioViewProps {
  compositionName: string;
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
  tonality: string;
  setTonality: (v: string) => void;
  isPlaying: boolean;
  onPlay: (time?: number) => void;
  onStop: () => void;
  onStartRecording?: () => void;
  onReorderBlocks: (newBlocks: CompositionBlock[]) => void;
  onPlayArrangement: () => void;
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
  isRecorded: boolean;
  preRecordBpm: number | "AUTO";
  setPreRecordBpm: (val: number | "AUTO") => void;
  preRecordTonality: string;
  setPreRecordTonality: (val: string) => void;
  preRecordTimeSignature: TimeSignature;
  setPreRecordTimeSignature: (val: TimeSignature) => void;
}

// ─────────────────────────────────────────────────────────
//  Componente Principal: StudioView
// ─────────────────────────────────────────────────────────
export function StudioView({
  compositionName,
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
  tonality,
  setTonality,
  onUpdateProgression,
  onStartRecording,
  onReorderBlocks,
  onPlayArrangement,
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
  isRecorded,
  preRecordBpm,
  setPreRecordBpm,
  preRecordTonality,
  setPreRecordTonality,
  preRecordTimeSignature,
  setPreRecordTimeSignature,
}: StudioViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // ── States for Sidebar ──
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
    <div className="flex flex-row h-full w-full bg-[#141414] text-white overflow-hidden animate-fade-in font-sans relative">
      
      {/* ── Central Area (Session) ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <TopBar 
          onStartRecording={onStartRecording}
          isPlaying={isPlaying}
          time={time}
          onPlay={onPlay}
          onStop={onStop}
          handleSkipBack={handleSkipBack}
          handleSkipForward={handleSkipForward}
          bpm={bpm}
          setBpm={setBpm}
          qtValue={qtValue}
          setQtValue={setQtValue}
          utValue={utValue}
          setUtValue={setUtValue}
          tonality={tonality}
          setTonality={setTonality}
          isSceneBarOpen={isSidebarOpen}
          toggleSceneBar={() => setIsSidebarOpen(!isSidebarOpen)}
          isRecorded={isRecorded}
          preRecordBpm={preRecordBpm}
          setPreRecordBpm={setPreRecordBpm}
          preRecordTonality={preRecordTonality}
          setPreRecordTonality={setPreRecordTonality}
          preRecordTimeSignature={preRecordTimeSignature}
          setPreRecordTimeSignature={setPreRecordTimeSignature}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* ── Track Headers (Left Column) ── */}
          <TrackHeaders 
            rulerHeight={RULER_HEIGHT} 
            melodyInstrument={melodyInstrument}
            setMelodyInstrument={setMelodyInstrument}
            chordsInstrument={chordsInstrument}
            setChordsInstrument={setChordsInstrument}
            melodyVolume={melodyVolume}
            setMelodyVolume={setMelodyVolume}
            melodyMuted={melodyMuted}
            setMelodyMuted={setMelodyMuted}
            chordsVolume={chordsVolume}
            setChordsVolume={setChordsVolume}
            chordsMuted={chordsMuted}
            setChordsMuted={setChordsMuted}
          />

          {/* ── Timeline Area (Right Column) ── */}
          <div className="flex-1 flex flex-col relative overflow-hidden bg-[#121212]">
            {/* Zoom Controls Overlay */}
            <div 
              className="absolute top-0 right-0 h-[28px] z-50 flex items-center pr-2 pl-12 bg-[#1a1a1a] backdrop-blur-[3px] pointer-events-none"
              style={{
                maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)',
                WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)',
              }}
            >
              <div className="flex items-center gap-0.5 pointer-events-auto">
                <button 
                  onClick={() => setPxPerSecond(p => Math.max(20, p - 20))} 
                  className="p-1 hover:bg-white/10 rounded text-white/80 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <button 
                  onClick={() => setPxPerSecond(p => Math.min(400, p + 20))} 
                  className="p-1 hover:bg-white/10 rounded text-white/80 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div style={{ width: `${canvasWidth}px` }} className="h-full flex flex-col relative">
                
                {/* Ruler */}
                <div 
                  style={{ height: `${RULER_HEIGHT}px` }} 
                  className="relative bg-[#1e1e1e] text-white/80 shrink-0 sticky top-0 z-40 cursor-pointer"
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
                className="absolute top-[28px] bottom-0 w-px bg-white z-30 shadow-[0_0_8px_rgba(255,255,255,0.8)] pointer-events-none"
                style={{ left: `${time * pxPerSecond}px`, display: time > 0 ? 'block' : 'none' }}
              >
                <div className="absolute -top-[28px] -left-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-white" />
              </div>

              {/* Tracks Container */}
              <div className="flex-1 flex flex-col relative z-10">
                
                {/* Melody Lane */}
                <div className="h-40 flex-none relative bg-[#181818]">
                  {melodyNotes.length > 0 && (() => {
                    const firstNote = melodyNotes.reduce((min, n) => (n.startTime! < min.startTime! ? n : min), melodyNotes[0]);
                    const lastNote = melodyNotes.reduce((max, n) => (n.endTime! > max.endTime! ? n : max), melodyNotes[0]);
                    const left = firstNote.startTime! * pxPerSecond;
                    const width = (lastNote.endTime! - firstNote.startTime!) * pxPerSecond;
                    return (
                      <div className="absolute top-2 bottom-2 rounded-md overflow-hidden" style={{ left: `${left}px`, width: `${width}px` }}>
                        <PianoRoll notes={melodyNotes} laneColorClass="bg-white" pxPerSecond={pxPerSecond} />
                        <div className="absolute top-1 left-2 text-[9px] font-bold text-black tracking-widest pointer-events-none">MELODY CLIP</div>
                      </div>
                    );
                  })()}
                </div>

                {/* Harmony Lane */}
                <div className="h-40 flex-none relative bg-[#121212]">
                  {(() => {
                    const pxPerBeat = secondsPerBeat * pxPerSecond;
                    let currentBeats = 0;
                    
                    const elements = displayProgression.map((chordObj, i) => {
                      const currentLeft = currentBeats * pxPerBeat;
                      const width = chordObj.durationBeats * pxPerBeat;
                      const activeBlock = blocks.find(b => b.id === activeBlockId);
                      const isNewlyGenerated = activeBlock?.newlyGenerated;
                      currentBeats += chordObj.durationBeats;
                      
                      return (
                        <div 
                          key={`${chordObj.id}-${i}`}
                          className={`absolute h-[60px] top-4 shrink-0 transition-all ${isNewlyGenerated ? 'animate-chord-pulse' : ''}`}
                          style={{ 
                            left: `${currentLeft}px`,
                            animationDelay: isNewlyGenerated ? `${i * 0.05}s` : '0s'
                          }}
                        >
                          <ChordBlock
                            chord={chordObj.chord}
                            width={width}
                            tonality={tonality}
                            prevChord={i > 0 ? displayProgression[i - 1].chord : tonality}
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
                        </div>
                      );
                    });

                    // Botão Adicionar Acorde (Fundo Cinza)
                    const totalLeft = currentBeats * pxPerBeat;
                    const defaultWidth = qtValue * pxPerBeat;
                    elements.push(
                      <div 
                        key="add-chord"
                        className="absolute top-2 bottom-2 rounded-[5px] bg-[#333] hover:bg-[#444] transition-colors flex items-center justify-center cursor-pointer shadow-md text-white/50 hover:text-white"
                        style={{ left: `${totalLeft + 2}px`, width: `${defaultWidth - 4}px` }}
                        onClick={() => {
                           const newProg = [...progression, {
                             id: Date.now().toString(),
                             chord: "C",
                             durationBeats: qtValue,
                             velocity: 0.7
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

      {/* ── Sidebar Direita (Arrangement Macro) ── */}
      <div className={`shrink-0 bg-neutral-900/50 flex flex-col overflow-y-auto relative z-20 transition-all duration-300 ${
        isSidebarOpen ? 'w-80' : 'w-0 border-transparent opacity-0'
      }`}>
        
        {/* Capa do Álbum */}
        <div className="relative w-full aspect-square shrink-0">
          <img 
            src={`https://image.pollinations.ai/prompt/${encodeURIComponent(compositionName)}?width=512&height=512&nologo=true&seed=42`}
            alt="Album Cover" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          <h2 className="absolute bottom-4 left-4 right-4 text-xl font-bold tracking-tight text-white drop-shadow-md">
            {compositionName}
          </h2>
        </div>

        {/* Lista de Sessões */}
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Arrangement</h3>
            <div className="flex items-center gap-1">
              <button 
                onClick={onPlayArrangement}
                className="p-1 rounded transition-colors text-white/60 hover:text-white hover:bg-white/10"
                title="Tocar Música Inteira"
              >
                <Play size={16} />
              </button>
              <button 
                onClick={appState === "IDLE" ? onAddBlock : undefined}
                className={`p-1 rounded transition-colors ${appState === "IDLE" ? "text-white/60 hover:text-white hover:bg-white/10" : "text-white/20 cursor-not-allowed"}`}
                title="Nova Seção"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {blocks.map(block => {
            const isThisActive = block.id === activeBlockId;
            const isThisRecording = isThisActive && (appState === "RECORDING" || appState === "COUNT_IN" || appState === "PROCESSING");
            const isRenaming = renamingBlockId === block.id;

            return (
              <div 
                key={block.id}
                onClick={() => {
                  if (isThisRecording && appState === "RECORDING") {
                    onStopRecording();
                  } else if (appState === "IDLE") {
                    onActiveBlockChange(block.id);
                  }
                }}
                onDoubleClick={() => {
                  if (!isThisRecording) {
                    setEditName(block.name);
                    setRenamingBlockId(block.id);
                  }
                }}
                className={`relative group flex flex-col p-3 transition-all cursor-pointer border ${
                  isThisRecording 
                    ? "bg-pink-500/20 border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.3)]"
                    : isThisActive 
                      ? "bg-white/10 border-white/20 shadow-md" 
                      : "bg-white/5 border-transparent hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
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
                      className="px-2 py-1 rounded-sm bg-black/50 text-sm font-semibold text-white outline-none w-full mr-2"
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="text-sm font-semibold text-white/90">
                      {isThisRecording && appState === "RECORDING" ? "Gravando..." : block.name}
                    </span>
                  )}

                  {!isThisRecording && !isRenaming && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRemoveBlock(block.id); }}
                      className="p-1.5 bg-white/10 hover:bg-red-500/80 text-white/60 hover:text-white rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200"
                      title="Excluir Seção"
                    >
                      <Trash2 size={12} strokeWidth={2.5} />
                    </button>
                  )}
                </div>

                {/* Chord Previews */}
                {block.progression.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1 pointer-events-none">
                    {block.progression.slice(0, 5).map((p, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-black/40 rounded-sm text-[10px] text-white/70 font-mono border border-white/5">
                        {p.chord}
                      </span>
                    ))}
                    {block.progression.length > 5 && (
                      <span className="px-2 py-0.5 bg-black/20 rounded-sm text-[10px] text-white/40 font-mono border border-transparent">
                        ...
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
}
