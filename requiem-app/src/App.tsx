import { useState, useEffect, useRef, useCallback } from "react";
import {
  sequences,
  Player,
  NoteSequence,
} from "@magenta/music";
import type { INoteSequence } from "@magenta/music";
import { useMetronome } from "./hooks/useMetronome";
import { usePitchDetector } from "./hooks/usePitchDetector";
import { useStringEngine } from "./hooks/useStringEngine";
import type { DetectedNote } from "./hooks/usePitchDetector";
import SheetMusicVisualizer from "./components/SheetMusicVisualizer";
import { Sidebar } from "./components/Sidebar";
import { RecordControls } from "./components/RecordControls";
import { DynamicRing } from "./components/DynamicRing";
import * as Tone from "tone";
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
  | "PROCESSING";

// ── Interface para armazenar resultado da harmonização ──
interface HarmonyResult {
  /** Progressão de acordes gerada (um por compasso) */
  readonly progression: readonly string[];
  /** NoteSequence sintetizado para playback e visualização */
  readonly noteSequence: INoteSequence;
}

// ── Stale-closure-safe label map ────────────────────────
const STATE_LABELS: Record<AppState, string> = {
  IDLE: "Iniciar Captura",
  COUNT_IN: "Contagem...",
  RECORDING: "Gravando · Clique para parar",
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
  progression: readonly string[],
  melodyNotes: DetectedNote[],
  bpm: number,
  harmonicRhythmBeats: number,
): NoteSequence {
  // 1) Montar a melodia quantizada
  const ns = buildMelodySequence(melodyNotes, bpm);
  const stepsPerSecond = sequences.stepsPerQuarterToStepsPerSecond(4, bpm);
  const secondsPerBeat = 60 / bpm;
  const secondsPerChord = secondsPerBeat * harmonicRhythmBeats;
  const stepsPerChord = Math.round(secondsPerChord * stepsPerSecond);

  // Offset temporal = início das notas gravadas
  const melodyStart = melodyNotes.length > 0
    ? Math.min(...melodyNotes.map(n => n.startTime))
    : 0;

  // 2) Para cada acorde na progressão, adicionar as notas correspondentes
  for (let m = 0; m < progression.length; m++) {
    const chordName = progression[m];
    const chordNode = HARMONY_GRAPH[chordName];
    if (!chordNode) continue;

    const measureStartTime = melodyStart + m * secondsPerChord;
    const measureEndTime = measureStartTime + secondsPerChord;
    const qStart = sequences.quantizeToStep(measureStartTime, stepsPerSecond);
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
  const [harmonicRhythm, setHarmonicRhythm] = useState<number>(2);
  const [currentResult, setCurrentResult] = useState<HarmonyResult | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Refs ──────────────────────────────────────────────
  const appStateRef = useRef<AppState>("IDLE");
  const playingIndexRef = useRef<number | null>(null);
  const lastGluedNotesRef = useRef<DetectedNote[]>([]);

  // Manter ref sincronizado com state (para closures)
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  // ── Hooks personalizados ──────────────────────────────
  const metronome = useMetronome({ bpm, timeSignature });
  const pitchDetector = usePitchDetector();
  const stringEngine = useStringEngine();

  // ── beatsPerMeasure derivado diretamente do QT ────────
  const beatsPerMeasure = qtValue;

  // ── Reagir ao isReady do metrônomo (count-in → recording) ─
  useEffect(() => {
    if (metronome.isReady && appStateRef.current === "COUNT_IN") {
      setAppState("RECORDING");
      pitchDetector.startListening();
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
  const playSequence = useCallback(async (index: number, seq: INoteSequence) => {
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

      await stringEngine.playSequence(seq);

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

  // ── Handler principal do botão ────────────────────────
  const handleMainButtonClick = useCallback(async () => {
    const current = appStateRef.current;
    setErrorMsg(null);

    switch (current) {
      // ── IDLE → COUNT_IN ───────────────────────────────
      case "IDLE": {
        setAppState("COUNT_IN");
        await metronome.start();
        break;
      }

      // ── RECORDING → PROCESSING → PLAYING_AND_SHOWING ─
      case "RECORDING": {
        // 1) Parar metrônomo e ativar loading Imediatamente
        metronome.stop();
        setAppState("PROCESSING");

        // 2) A rede neural do Basic Pitch avalia o áudio (demora alguns segundos)
        const detectedNotes = await pitchDetector.stopListening();

        if (detectedNotes.length === 0) {
          setErrorMsg("Nenhuma nota detectada. Tente novamente.");
          setAppState("IDLE");
          return;
        }

        try {
          // 3) Pré-processar notas
          const gluedNotes = glueNotes(detectedNotes);
          lastGluedNotesRef.current = gluedNotes;

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
            harmonicRhythm,
            "C",
          );

          console.log(`[Pipeline] Progressão bruta (C): [${rawProgression.join(", ")}]`);

          // 6) Transpor progressão de volta para a tonalidade do usuário
          const progression = transposeProgression(rawProgression, tonality);

          console.log(`[Pipeline] Progressão final (${tonality}): [${progression.join(", ")}]`);

          // 7) Sintetizar em NoteSequence (melodia + acordes)
          const noteSequence = progressionToNoteSequence(
            progression,
            gluedNotes,
            bpm,
            harmonicRhythm,
          );

          // 8) Adicionar resultado
          setCurrentResult({ progression, noteSequence });
          setAppState("IDLE");

        } catch (err) {
          console.error("Erro ao gerar harmonia:", err);
          setErrorMsg(
            "Erro ao gerar harmonia. Tente novamente."
          );
          setAppState("IDLE");
        }
        break;
      }

      // COUNT_IN e PROCESSING: não fazem nada no clique
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, harmonicRhythm, tonality, currentResult, playSequence]);

  // ── Atualizar Ritmo Harmônico dinamicamente ───────────
  const handleRhythmChange = useCallback((newRhythm: number) => {
    setHarmonicRhythm(newRhythm);

    const gluedNotes = lastGluedNotesRef.current;
    if (gluedNotes.length > 0) {
      try {
        const normalizedNotes = normalizeNotes(gluedNotes, tonality);
        const rawProgression = generateProgression(
          normalizedNotes,
          bpm,
          newRhythm,
          "C",
        );
        const progression = transposeProgression(rawProgression, tonality);
        const noteSequence = progressionToNoteSequence(
          progression,
          gluedNotes,
          bpm,
          newRhythm,
        );
        setCurrentResult({ progression, noteSequence });
        // Reiniciar player se estiver tocando
        if (playingIndexRef.current === 0) {
           stringEngine.stop();
           setPlayingIndex(null);
           playingIndexRef.current = null;
        }
      } catch (err) {
        console.error("Erro ao regenerar harmonia:", err);
      }
    }
  }, [bpm, tonality]);

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

  return (
    // Fundo PRETO PURO
    <div className="flex h-screen w-full bg-black text-white overflow-hidden font-sans antialiased">

      {/* ─── SIDEBAR ─── */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        recentMelodies={recentMelodies}
      />

      {/* ─── ÁREA PRINCIPAL ─── */}
      <main className="relative flex-1 flex flex-col justify-between p-8 overflow-hidden bg-black">

        {/* Camada da Aurora (Cores do Logo: Carmesim, Roxo Profundo) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 mix-blend-screen">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-red-800/20 blur-[130px] animate-aurora-slow" />
          <div className="absolute top-[20%] right-[-10%] w-[550px] h-[550px] rounded-full bg-rose-900/15 blur-[120px] animate-aurora-delayed" />
          <div className="absolute bottom-[-15%] left-[10%] w-[500px] h-[500px] rounded-full bg-purple-900/20 blur-[140px] animate-aurora-slow" />
        </div>

        {/* Corpo Central / Layout Flex */}
        <div className="relative z-10 flex flex-col flex-1 items-center justify-center text-center overflow-hidden">
          
          {/* Main Container */}
          <div className="w-full max-w-4xl px-4 flex flex-col items-center transition-all duration-500 ease-in-out">

            {!currentResult ? (
              <>
                <DynamicRing isActive={isActive} currentFrequency={pitchDetector.currentFrequency} />

                <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-white/90 mb-3 drop-shadow-md">
                  Transforme melodia em <span className="font-medium bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-rose-400 to-purple-500">harmonia</span>.
                </h1>

                <p className="text-xs sm:text-sm font-light text-white/50 tracking-wide mb-10 max-w-sm mx-auto leading-relaxed">
                  Toque uma nota contínua. A IA cuidará do contraponto em tempo real baseado nos seus parâmetros.
                </p>
                
                <RecordControls
                  isActive={isActive}
                  tonality={tonality}
                  setTonality={setTonality}
                  qtValue={qtValue}
                  setQtValue={setQtValue}
                  utValue={utValue}
                  setUtValue={setUtValue}
                  bpm={bpm}
                  setBpm={setBpm}
                  harmonicRhythm={harmonicRhythm}
                  setHarmonicRhythm={handleRhythmChange}
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
              </>
            ) : (
              <div className="w-full flex flex-col gap-6 animate-fade-in items-center">
                <div className="w-full relative flex flex-col items-center bg-[#111111]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
                  <div className="flex justify-between items-center w-full mb-6">
                    <h2 className="text-sm font-mono tracking-[0.2em] text-white/60 uppercase">
                      Harmonia Gerada
                    </h2>

                    <button
                      onClick={() => playSequence(0, currentResult.noteSequence)}
                      className={`p-3 rounded-full transition-colors flex items-center justify-center ${playingIndex === 0 ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-white/5 text-white/80 hover:bg-white/10'
                        }`}
                    >
                      {playingIndex === 0 ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Progressão de acordes */}
                  <div className="flex flex-wrap gap-2 w-full mb-6 justify-center">
                    {currentResult.progression.map((chord, ci) => (
                      <span
                        key={ci}
                        className="inline-flex items-center px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-mono text-white/90 tracking-wide"
                      >
                        <span className="text-[10px] text-white/30 mr-2">{ci + 1}.</span>
                        {chord}
                      </span>
                    ))}
                  </div>

                  <div className="w-full bg-black/50 rounded-xl p-4 border border-white/5 overflow-x-auto">
                    <SheetMusicVisualizer noteSequence={currentResult.noteSequence} />
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setCurrentResult(null);
                    setPlayingIndex(null);
                    stringEngine.stop();
                  }}
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all text-sm tracking-wide font-light flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                  Gravar Novamente
                </button>
              </div>
            )}

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

    </div>
  );
}