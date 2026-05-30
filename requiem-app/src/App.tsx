import { useState, useEffect, useRef, useCallback } from "react";
import {
  sequences,
  NoteSequence,
} from "@magenta/music";
import type { INoteSequence } from "@magenta/music";
import { useMetronome } from "./hooks/useMetronome";
import { usePitchDetector } from "./hooks/usePitchDetector";
import { useStringEngine } from "./hooks/useStringEngine";
import type { DetectedNote } from "./hooks/usePitchDetector";
import { Sidebar } from "./components/Sidebar";
import { RecordControls } from "./components/RecordControls";
import { DynamicRing } from "./components/DynamicRing";
import { StudioView } from "./components/StudioView";
import type { AppTab } from "./components/BottomNav";
import { generateProgression, HARMONY_GRAPH } from "./engine/HarmonyEngine";
import {
  normalizeNotes,
  transposeProgression,
} from "./engine/TonalityAdapter";

// ─────────────────────────────────────────────────────────
//  Máquina de Estados do fluxo principal
// ─────────────────────────────────────────────────────────
export type AppState =
  | "IDLE"
  | "COUNT_IN"
  | "RECORDING"
  | "REVIEW_RECORDING"
  | "PROCESSING";

export interface ChordSegment {
  id: string;
  chord: string;
  durationBeats: number;
}

// ── Interface para armazenar blocos de composição ──
export interface CompositionBlock {
  id: string;
  name: string;
  notes: DetectedNote[];
  progression: ChordSegment[];
  noteSequence?: INoteSequence;
}

// ── Stale-closure-safe label map ────────────────────────
const STATE_LABELS: Record<AppState, string> = {
  IDLE: "Iniciar Captura",
  COUNT_IN: "Contagem...",
  RECORDING: "Gravando · Clique para parar",
  REVIEW_RECORDING: "Analisar áudio gravado?",
  PROCESSING: "Transcrevendo áudio e gerando harmonia...",
};

// ─────────────────────────────────────────────────────────
//  Utilidades de conversão
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
//  Pré-processamento de notas detectadas
// ─────────────────────────────────────────────────────────

/**
 * Pré-processa as notas vindas do Basic Pitch.
 *
 * 1. Ordena por startTime (Basic Pitch pode retornar fora de ordem).
 * 2. Filtra notas muito curtas (< 80ms — ruído da rede neural).
 * 3. Para notas de MESMO pitch (exatamente), cola fragmentos
 *    separados por gaps < 0.25s (vibrato/tremolo).
 *
 * ⚠ NÃO funde notas de pitches diferentes (Basic Pitch é polifônico,
 *   notas simultâneas em pitches distintos são legítimas).
 */
function glueNotes(rawNotes: DetectedNote[]): DetectedNote[] {
  if (rawNotes.length === 0) return [];

  // 1. Ordenar por startTime, depois por pitch
  const sorted = [...rawNotes].sort((a, b) =>
    a.startTime !== b.startTime
      ? a.startTime - b.startTime
      : a.pitch - b.pitch,
  );

  // 2. Filtrar notas muito curtas
  const solidNotes = sorted.filter(n => (n.endTime - n.startTime) > 0.08);
  if (solidNotes.length === 0) return [];

  // 3. Agrupar por pitch e colar fragmentos do MESMO pitch
  const byPitch = new Map<number, DetectedNote[]>();
  for (const note of solidNotes) {
    if (!byPitch.has(note.pitch)) byPitch.set(note.pitch, []);
    byPitch.get(note.pitch)!.push({ ...note });
  }

  const result: DetectedNote[] = [];

  for (const [, notes] of byPitch) {
    // Notas já estão ordenadas por startTime (herdam do sorted)
    const merged: DetectedNote[] = [{ ...notes[0] }];

    for (let i = 1; i < notes.length; i++) {
      const current = notes[i];
      const last = merged[merged.length - 1];
      const gap = current.startTime - last.endTime;

      if (gap < 0.25) {
        // Mesmo pitch, gap pequeno → colar
        last.endTime = Math.max(last.endTime, current.endTime);
      } else {
        merged.push({ ...current });
      }
    }

    result.push(...merged);
  }

  // Reordenar o resultado final por startTime
  result.sort((a, b) => a.startTime - b.startTime);
  return result;
}

// ─────────────────────────────────────────────────────────
//  Conversão: Progressão de acordes → NoteSequence
// ─────────────────────────────────────────────────────────

/**
 * Constrói a melodia original como NoteSequence quantizado.
 */
function buildMelodySequence(
  notes: DetectedNote[],
  bpm: number,
): NoteSequence {
  const gluedNotes = glueNotes(notes);
  const ns = sequences.createQuantizedNoteSequence(4, bpm);
  const stepsPerSecond = sequences.stepsPerQuarterToStepsPerSecond(4, bpm);

  for (const note of gluedNotes) {
    const qStart = sequences.quantizeToStep(note.startTime, stepsPerSecond);
    const qEnd = sequences.quantizeToStep(note.endTime, stepsPerSecond);

    if (qEnd > qStart) {
      ns.notes!.push(
        NoteSequence.Note.create({
          pitch: note.pitch,
          startTime: note.startTime,
          endTime: note.endTime,
          quantizedStartStep: qStart,
          quantizedEndStep: qEnd,
          instrument: 0,
          program: 0,
        }),
      );
    }
  }

  if (ns.notes!.length > 0) {
    ns.totalQuantizedSteps = Math.max(
      ...ns.notes!.map(n => n.quantizedEndStep ?? 0),
    );
  }

  ns.tempos = [{ time: 0, qpm: bpm }];

  return ns;
}

/**
 * Sintetiza a progressão de acordes em notas de harmonia
 * e as mescla com a melodia original em um NoteSequence.
 *
 * Cada acorde da progressão ocupa um compasso inteiro.
 * As notas do acorde são distribuídas numa oitava
 * confortável (MIDI 48–60 → C3–C4) como um bloco
 * sustentado (whole-note / semibreve por compasso).
 */
function progressionToNoteSequence(
  progression: ChordSegment[],
  melodyNotes: DetectedNote[],
  bpm: number,
  timeSignatureDenominator: number,
): NoteSequence {
  // 1) Montar a melodia quantizada
  const ns = buildMelodySequence(melodyNotes, bpm);
  const stepsPerSecond = sequences.stepsPerQuarterToStepsPerSecond(4, bpm);
  const secondsPerBeat = (4 / timeSignatureDenominator) * (60 / bpm);

  let currentStartTime = 0;

  // 2) Para cada segmento de acorde, adicionar as notas correspondentes
  for (const seg of progression) {
    const chordNode = HARMONY_GRAPH[seg.chord];
    if (!chordNode) {
      currentStartTime += seg.durationBeats * secondsPerBeat;
      continue;
    }

    const durationSeconds = seg.durationBeats * secondsPerBeat;
    const measureStartTime = currentStartTime;
    const measureEndTime = measureStartTime + durationSeconds;
    
    const qStart = sequences.quantizeToStep(measureStartTime, stepsPerSecond);
    const stepsPerChord = Math.round(durationSeconds * stepsPerSecond);
    const qEnd = Math.max(qStart + 1, qStart + stepsPerChord);

    // Distribuir pitch classes na oitava C3 (MIDI 48+)
    for (const pc of chordNode.notes) {
      const midiPitch = 48 + pc; // C3 base
      ns.notes!.push(
        NoteSequence.Note.create({
          pitch: midiPitch,
          startTime: measureStartTime,
          endTime: measureEndTime,
          quantizedStartStep: qStart,
          quantizedEndStep: qEnd,
          instrument: 1, // voz 1 = harmonia
          program: 0,
        }),
      );
    }
    
    currentStartTime = measureEndTime;
  }

  // 3) Recalcular totalQuantizedSteps
  if (ns.notes!.length > 0) {
    ns.totalQuantizedSteps = Math.max(
      ...ns.notes!.map(n => n.quantizedEndStep ?? 0),
    );
  }

  return ns;
}

// ─────────────────────────────────────────────────────────
//  App Component
// ─────────────────────────────────────────────────────────

export default function App() {
  // ── UI state ──────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [qtValue, setQtValue] = useState(4);
  const [utValue, setUtValue] = useState(4);
  const [tonality, setTonality] = useState("C");
  const timeSignature = `${qtValue}/${utValue}`;
  const [appState, setAppState] = useState<AppState>("IDLE");
  
  const [blocks, setBlocks] = useState<CompositionBlock[]>([
    { id: "1", name: "Verso 1", notes: [], progression: [] }
  ]);
  const [activeBlockId, setActiveBlockId] = useState<string>("1");
  const activeBlock = blocks.find(b => b.id === activeBlockId);

  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("vibe");

  // ── Refs ──────────────────────────────────────────────
  const appStateRef = useRef<AppState>("IDLE");
  const playingIndexRef = useRef<number | null>(null);
  const recordedBpmRef = useRef<number>(120);

  // Manter ref sincronizado com state (para closures)
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  // ── Hooks personalizados ──────────────────────────────
  const metronome = useMetronome({ bpm, timeSignature });
  const pitchDetector = usePitchDetector();
  const stringEngine = useStringEngine();

  // ── Reagir ao isReady do metrônomo (count-in → recording) ─
  useEffect(() => {
    if (metronome.isReady && appStateRef.current === "COUNT_IN") {
      setAppState("RECORDING");
      pitchDetector.startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metronome.isReady]);

  // ── Cleanup ao desmontar ──────────────────────────────
  useEffect(() => {
    return () => {
      metronome.stop();
      if (pitchDetector.isListening) pitchDetector.stopListening();
      stringEngine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Controle de Playback por item ─────────────────────
  const playSequence = useCallback(async (index: number, seq: INoteSequence, offset: number = 0) => {
    try {
      if (playingIndexRef.current === index) {
        stringEngine.stop();
        setPlayingIndex(null);
        playingIndexRef.current = null;
        return;
      }

      // Parar qualquer som anterior
      stringEngine.stop();

      setPlayingIndex(index);
      playingIndexRef.current = index;

      await stringEngine.playSequence(seq, offset);

      // Calcular a duração aproximada para liberar o botão
      const totalDuration = seq.notes?.reduce((max, note) => Math.max(max, note.endTime || 0), 0) || 0;
      setTimeout(() => {
        if (playingIndexRef.current === index) {
          setPlayingIndex(null);
          playingIndexRef.current = null;
        }
      }, (totalDuration + 0.5) * 1000);

    } catch (err) {
      console.error("Erro no playback:", err);
      setPlayingIndex(null);
      playingIndexRef.current = null;
    }
  }, [stringEngine]);

  // ── Ring Click (Cancelar ou Iniciar) ──────────────────
  const handleRingClick = useCallback(async () => {
    if (appState === "RECORDING") {
      metronome.stop();
      await pitchDetector.pauseListening();
      setAppState("REVIEW_RECORDING");
    } else if (appState === "COUNT_IN" || appState === "PROCESSING" || appState === "REVIEW_RECORDING") {
      metronome.stop();
      pitchDetector.cancelListening();
      setAppState("IDLE");
    } else if (appState === "IDLE") {
      // Iniciar pelo anel também é válido
      // Mas para manter as regras de UI, usaremos o handleMainButtonClick
    }
  }, [appState, metronome, pitchDetector]);

  // ── Handler principal do botão ────────────────────────
  const handleMainButtonClick = useCallback(async () => {
    const current = appStateRef.current;
    setErrorMsg(null);

    switch (current) {
      // ── IDLE → COUNT_IN ───────────────────────────────
      case "IDLE": {
        setAppState("COUNT_IN");
        await pitchDetector.prepareListening(); // Prepara mic (pede permissão) ANTES de iniciar contagem
        await metronome.start();
        break;
      }

      // ── RECORDING → (agora é capturado pelo anel, mas deixamos vazio por segurança)
      case "RECORDING":
        break;

      // ── REVIEW_RECORDING → PROCESSING → PLAYING_AND_SHOWING ─
      case "REVIEW_RECORDING": {
        await processRecording();
        break;
      }

      // COUNT_IN e PROCESSING: não fazem nada no clique
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, qtValue, utValue, tonality, activeBlockId, playSequence]);

  const processRecording = async () => {
        setAppState("PROCESSING");

        // 2) A rede neural do Basic Pitch avalia o áudio (demora alguns segundos)
        const detectedNotes = await pitchDetector.processPausedAudio();

        if (detectedNotes.length === 0) {
          setErrorMsg("Nenhuma nota detectada. Tente novamente.");
          setAppState("IDLE");
          return;
        }

        try {
          // 3) Pré-processar notas
          const gluedNotes = glueNotes(detectedNotes);
          recordedBpmRef.current = bpm;

          console.log(`[Pipeline] Notas brutas: ${detectedNotes.length} → Após glue: ${gluedNotes.length}`);
          if (gluedNotes.length > 0) {
            const tMin = Math.min(...gluedNotes.map(n => n.startTime));
            const tMax = Math.max(...gluedNotes.map(n => n.endTime));
            console.log(`[Pipeline] Range temporal: ${tMin.toFixed(3)}s → ${tMax.toFixed(3)}s (${(tMax - tMin).toFixed(3)}s)`);
          }

          // 4) Normalizar notas para C Major (Local Space)
          const normalizedNotes = normalizeNotes(gluedNotes, tonality);

          // 5) Gerar progressão via HarmonyEngine (opera em C Major)
          const rawProgression = generateProgression(
            normalizedNotes,
            bpm,
            qtValue, // 1 acorde por compasso (duration = qtValue)
            qtValue,
            utValue,
            "C",
          );

          console.log(`[Pipeline] Progressão bruta (C): [${rawProgression.join(", ")}]`);

          // 6) Transpor progressão de volta para a tonalidade do usuário
          const progressionString = transposeProgression(rawProgression, tonality);
          
          const progression: ChordSegment[] = progressionString.map(chord => ({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            chord,
            durationBeats: qtValue
          }));

          console.log(`[Pipeline] Progressão final (${tonality}): [${progressionString.join(", ")}]`);

          // 7) Sintetizar em NoteSequence (melodia + acordes)
          const noteSequence = progressionToNoteSequence(
            progression,
            gluedNotes,
            bpm,
            utValue,
          );

          // 8) Adicionar resultado
          setBlocks(prev => prev.map(b => 
            b.id === activeBlockId 
              ? { ...b, notes: gluedNotes, progression, noteSequence } 
              : b
          ));
          setAppState("IDLE");

        } catch (err) {
          console.error("Erro ao gerar harmonia:", err);
          setErrorMsg(
            "Erro ao gerar harmonia. Tente novamente."
          );
          setAppState("IDLE");
        }
  };

  const handleStopAndProcess = async () => {
    metronome.stop();
    await pitchDetector.pauseListening();
    await processRecording();
  };

  // ── Atualizar Progressão ───────────────────────────────
  const handleUpdateProgression = useCallback((newProgression: ChordSegment[]) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== activeBlockId || b.notes.length === 0) return b;
      try {
        const noteSequence = progressionToNoteSequence(
          newProgression,
          b.notes,
          bpm,
          utValue,
        );
        return { ...b, progression: newProgression, noteSequence };
      } catch (err) {
        console.error("Erro ao atualizar progressão:", err);
        return b;
      }
    }));
    
    // Reiniciar player se estiver tocando
    if (playingIndexRef.current === 0) {
       stringEngine.stop();
       setPlayingIndex(null);
       playingIndexRef.current = null;
    }
  }, [bpm, utValue, activeBlockId, stringEngine]);

  // ── Alterar Velocidade de Execução (BPM) ──────────────
  useEffect(() => {
    if (appState !== "IDLE") return;
    if (recordedBpmRef.current === bpm) return;

    const ratio = recordedBpmRef.current / bpm;
    
    setBlocks(prev => prev.map(b => {
      if (b.notes.length === 0) return b;
      
      const scaledNotes = b.notes.map(n => ({
        ...n,
        startTime: n.startTime * ratio,
        endTime: n.endTime * ratio
      }));
      
      try {
        const noteSequence = progressionToNoteSequence(
          b.progression,
          scaledNotes,
          bpm,
          utValue,
        );
        return { ...b, notes: scaledNotes, noteSequence };
      } catch (err) {
        return b;
      }
    }));
    
    recordedBpmRef.current = bpm;

    if (playingIndexRef.current === 0) {
       stringEngine.stop();
       setPlayingIndex(null);
       playingIndexRef.current = null;
    }
  }, [bpm, appState, qtValue, utValue, stringEngine]);


  // ── Derivações visuais ────────────────────────────────
  const isActive = appState !== "IDLE";
  const isRecording = appState === "RECORDING";
  const isProcessing = appState === "PROCESSING";
  const isButtonDisabled = appState === "COUNT_IN" || isProcessing || !stringEngine.isLoaded;

  const recentMelodies = [
    "Invenção a 2 Vozes - Dó Maior",
    "Estudo de Contraponto #1",
    "Rascunho de Harmonia 01",
    "Teste de Microfone",
  ];

  // Auto-switch to Studio when result is generated
  useEffect(() => {
    if (activeBlock?.noteSequence && activeTab === "vibe") {
      setActiveTab("studio");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock?.noteSequence]);

  const handleRecordAgain = useCallback(() => {
    // Apaga apenas o bloco ativo
    setBlocks(prev => prev.map(b => 
      b.id === activeBlockId ? { ...b, notes: [], progression: [], noteSequence: undefined } : b
    ));
    setActiveTab("vibe");
    setAppState("IDLE");
  }, [activeBlockId]);

  const handleAddBlock = useCallback(async () => {
    const id = Date.now().toString();
    const newBlock: CompositionBlock = {
      id,
      name: `Seção ${blocks.length + 1}`,
      notes: [],
      progression: []
    };
    setBlocks(prev => [...prev, newBlock]);
    setActiveBlockId(id);
    
    // Inicia gravação In-Place
    if (appStateRef.current === "IDLE") {
      setAppState("COUNT_IN");
      await pitchDetector.prepareListening();
      await metronome.start();
    }
  }, [blocks.length, pitchDetector, metronome]);

  const handleRemoveBlock = useCallback((idToRemove: string) => {
    setBlocks(prev => {
      const next = prev.filter(b => b.id !== idToRemove);
      // Se apagar o ativo, ativa o primeiro disponível (se houver)
      if (idToRemove === activeBlockId && next.length > 0) {
        setActiveBlockId(next[0].id);
      }
      return next.length > 0 ? next : [{ id: Date.now().toString(), name: "Seção 1", notes: [], progression: [] }];
    });
  }, [activeBlockId]);

  const handleRenameBlock = useCallback((id: string, newName: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, name: newName } : b));
  }, []);

  return (
    <div className="flex h-screen w-full bg-black text-white overflow-hidden font-sans antialiased">

      {/* ─── SIDEBAR (Present on all views) ─── */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        recentMelodies={recentMelodies}
      />

      {/* ─── VIBE VIEW ─── */}
      {activeTab === "vibe" && (
        <main className="relative flex-1 flex flex-col justify-between p-8 overflow-hidden bg-black">

          {/* Corpo Central */}
          <div className="relative z-10 flex flex-col flex-1 items-center justify-center text-center overflow-hidden">
            <div className="w-full max-w-4xl px-4 flex flex-col items-center transition-all duration-500 ease-in-out">

              <DynamicRing 
                isActive={isActive} 
                currentFrequency={pitchDetector.currentFrequency}
                currentNote={pitchDetector.currentNote}
                onClick={handleRingClick}
              />

              <div className={`w-full flex flex-col items-center transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isActive ? 'opacity-0 h-0 scale-90 pointer-events-none' : 'opacity-100 h-auto scale-100'}`}>
                <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-white/90 mb-10 drop-shadow-md">
                  Olá! O que iremos compor hoje?
                </h1>

                <RecordControls
                  isActive={false} // It is hidden when active, so it never shows disabled states

                tonality={tonality}
                setTonality={setTonality}
                qtValue={qtValue}
                setQtValue={setQtValue}
                utValue={utValue}
                setUtValue={setUtValue}
                bpm={bpm}
                setBpm={setBpm}
                appState={appState}
                isRecording={isRecording}
                isProcessing={isProcessing}
                currentBeat={metronome.currentBeat}
                currentFrequency={pitchDetector.currentFrequency}
                currentNote={pitchDetector.currentNote}
                isButtonDisabled={isButtonDisabled}
                handleMainButtonClick={handleMainButtonClick}
                stateLabels={STATE_LABELS}
              />
            </div>
            
            {appState === "REVIEW_RECORDING" && (
              <div className="flex gap-4 mt-8 animate-fade-in z-20">
                <button 
                  onClick={() => {
                    pitchDetector.cancelListening();
                    setAppState("IDLE");
                  }}
                  className="px-6 py-2.5 rounded-full border border-white/20 text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                >
                  Descartar
                </button>
                <button 
                  onClick={handleMainButtonClick}
                  className="px-6 py-2.5 rounded-full bg-white text-black font-medium hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                >
                  Gerar Harmonia
                </button>
              </div>
            )}

            {appState === "PROCESSING" && <ProcessingText />}

              {/* MENSAGEM DE ERRO */}
              {errorMsg && (
                <div className="mt-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono animate-fade-in">
                  {errorMsg}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <footer className="relative z-10 w-full text-center text-[10px] font-mono tracking-[0.2em] text-white/30 max-w-5xl mx-auto">
            &copy; {new Date().getFullYear()} REQUIEM LABS &bull; HARMONY ENGINE v1.0
          </footer>
        </main>
      )}

      {/* ─── STUDIO VIEW ─── */}
      {activeTab === "studio" && activeBlock && (
        <main className="flex-1 flex flex-col overflow-hidden">
          <StudioView
            blocks={blocks}
            activeBlockId={activeBlockId}
            onActiveBlockChange={setActiveBlockId}
            onAddBlock={handleAddBlock}
            onRemoveBlock={handleRemoveBlock}
            onRenameBlock={handleRenameBlock}
            appState={appState}
            currentFrequency={pitchDetector.currentFrequency}
            onStopRecording={handleStopAndProcess}
            noteSequence={activeBlock.noteSequence!}
            progression={activeBlock.progression}
            bpm={bpm}
            setBpm={setBpm}
            qtValue={qtValue}
            setQtValue={setQtValue}
            utValue={utValue}
            setUtValue={setUtValue}
            isPlaying={playingIndex === 0}
            onPlay={(timeOffset) => {
              if (activeBlock.noteSequence) playSequence(0, activeBlock.noteSequence, timeOffset);
            }}
            onStop={() => {
              stringEngine.stop();
              setPlayingIndex(null);
              playingIndexRef.current = null;
            }}
            onUpdateProgression={handleUpdateProgression}
            onRecordAgain={handleRecordAgain}
          />
        </main>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Componente de Processamento (Terminal Log)
// ─────────────────────────────────────────────────────────
const PROCESSING_MESSAGES = [
  "Preparando áudio gravado...",
  "Ouvindo as notas e detectando o tom...",
  "Analisando padrões harmônicos...",
  "Consultando banco de músicas para referências...",
  "Pensando nos melhores acordes...",
  "Mapeando a estrutura no Piano Roll..."
];

function ProcessingText() {
  const [msgIndex, setMsgIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(prev => prev + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const visibleLogs = PROCESSING_MESSAGES.slice(0, msgIndex + 1);
  
  return (
    <div className="mt-12 flex flex-col items-start w-full max-w-md font-mono text-xs sm:text-sm text-white/70 min-h-[8rem] text-left transition-all">
      {visibleLogs.map((log, i) => (
        <div key={i} className="animate-fade-in flex items-start gap-3 mb-1.5 opacity-90">
          <span className="text-white/30 select-none">{`>`}</span>
          <span className="leading-tight">{log}</span>
        </div>
      ))}
      
      {/* Blinking cursor */}
      {visibleLogs.length < PROCESSING_MESSAGES.length && (
        <div className="animate-pulse flex items-start gap-3 mt-1">
          <span className="text-white/30 select-none">{`>`}</span>
          <span className="w-2 h-3.5 bg-white/50 mt-0.5" />
        </div>
      )}
    </div>
  );
}