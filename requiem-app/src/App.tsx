import { useState, useEffect, useRef, useCallback } from "react";
import {
  Coconet,
  sequences,
  Player,
  NoteSequence,
} from "@magenta/music";
import type { INoteSequence } from "@magenta/music";
import requiemLogo from "./assets/requiem-logo-full.svg";
import { useMetronome } from "./hooks/useMetronome";
import { usePitchDetector } from "./hooks/usePitchDetector";
import type { DetectedNote } from "./hooks/usePitchDetector";
import SheetMusicVisualizer from "./components/SheetMusicVisualizer";
import * as Tone from "tone";

// ─────────────────────────────────────────────────────────
//  Máquina de Estados do fluxo principal
// ─────────────────────────────────────────────────────────
type AppState =
  | "IDLE"
  | "COUNT_IN"
  | "RECORDING"
  | "PROCESSING";

// ── Coconet model checkpoint (Google-hosted) ────────────
const COCONET_CHECKPOINT =
  "https://storage.googleapis.com/magentadata/js/checkpoints/coconet/bach";

// ── Stale-closure-safe label map ────────────────────────
const STATE_LABELS: Record<AppState, string> = {
  IDLE: "Iniciar Captura",
  COUNT_IN: "Contagem...",
  RECORDING: "Gravando · Clique para parar",
  PROCESSING: "Gerando harmonia...",
};

// ─────────────────────────────────────────────────────────
//  Utilidades de conversão
// ─────────────────────────────────────────────────────────

// Passe o array de notas retornado pelo stopListening() por aqui!
function glueNotes(rawNotes: DetectedNote[]): DetectedNote[] {
  if (rawNotes.length === 0) return [];
  
  // 1. Limpa os "fantasmas": Remove ruídos que duraram menos de 80ms
  const solidNotes = rawNotes.filter(n => (n.endTime - n.startTime) > 0.08);
  if (solidNotes.length === 0) return [];

  const merged: DetectedNote[] = [ { ...solidNotes[0] } ];

  for (let i = 1; i < solidNotes.length; i++) {
    const current = solidNotes[i];
    const last = merged[merged.length - 1];

    const timeGap = current.startTime - last.endTime;
    const pitchDiff = Math.abs(current.pitch - last.pitch);

    // 2. A MÁGICA: Se for a mesma nota (ou 1 semitom de diferença por vibrato) 
    // e a pausa entre elas for menor que 0.25 segundos (250ms), nós COLAMOS.
    if (pitchDiff <= 1 && timeGap < 0.25) {
      last.endTime = current.endTime; // Estica a duração da nota anterior
    } else {
      // Se for realmente uma nota nova ou uma pausa longa, adiciona na lista
      merged.push({ ...current });
    }
  }
  
  return merged;
}

/**
 * Converte as notas detectadas pelo usePitchDetector em um
 * NoteSequence quantizado do Magenta (voice 0 = soprano).
 */
function detectedNotesToSequence(
  notes: DetectedNote[],
  bpm: number
): NoteSequence {
  const gluedNotes = glueNotes(notes);
  const ns = sequences.createQuantizedNoteSequence(4, bpm);

  const stepsPerSecond = sequences.stepsPerQuarterToStepsPerSecond(4, bpm);

  for (const note of gluedNotes) {
    const quantizedStart = sequences.quantizeToStep(
      note.startTime,
      stepsPerSecond
    );
    const quantizedEnd = sequences.quantizeToStep(
      note.endTime,
      stepsPerSecond
    );

    if (quantizedEnd > quantizedStart) {
      ns.notes!.push(
        NoteSequence.Note.create({
          pitch: note.pitch,
          startTime: note.startTime,
          endTime: note.endTime,
          quantizedStartStep: quantizedStart,
          quantizedEndStep: quantizedEnd,
          instrument: 0, // voz 0 = melodia do usuário
          program: 0,
        })
      );
    }
  }

  // totalQuantizedSteps = último step das notas
  if (ns.notes!.length > 0) {
    ns.totalQuantizedSteps = Math.max(
      ...ns.notes!.map((n) => n.quantizedEndStep ?? 0)
    );
  }

  return ns;
}

/**
 * Mescla notas consecutivas da mesma altura e instrumento
 * que ocorrem exatamente uma após a outra (notas ligadas/tied notes).
 * Resolve o problema do Magenta (Coconet) retornar notas subdivididas
 * como múltiplas semicolcheias contíguas.
 */
function mergeTiedNotes(seq: NoteSequence): NoteSequence {
  const mergedSeq = sequences.clone(seq);
  if (!mergedSeq.notes || mergedSeq.notes.length === 0) return mergedSeq;

  const newNotes: NoteSequence.INote[] = [];
  
  // Agrupar por instrumento
  const byInstrument = new Map<number, NoteSequence.INote[]>();
  for (const note of mergedSeq.notes) {
    const inst = note.instrument || 0;
    if (!byInstrument.has(inst)) byInstrument.set(inst, []);
    byInstrument.get(inst)!.push(note);
  }
  
  for (const notes of byInstrument.values()) {
    // Ordenar notas pelo step inicial
    notes.sort((a, b) => (a.quantizedStartStep || 0) - (b.quantizedStartStep || 0));
    
    let currentNote = NoteSequence.Note.create(notes[0]);
    
    for (let i = 1; i < notes.length; i++) {
      const nextNote = notes[i];
      
      const isSamePitch = currentNote.pitch === nextNote.pitch;
      const isAdjacent = (currentNote.quantizedEndStep || 0) === (nextNote.quantizedStartStep || 0);
      const isOverlapping = (currentNote.quantizedEndStep || 0) > (nextNote.quantizedStartStep || 0);
      
      if (isSamePitch && (isAdjacent || isOverlapping)) {
        // Estender a nota atual
        currentNote.quantizedEndStep = Math.max(currentNote.quantizedEndStep || 0, nextNote.quantizedEndStep || 0);
        
        if (typeof currentNote.endTime === 'number' && typeof nextNote.endTime === 'number') {
          currentNote.endTime = Math.max(currentNote.endTime, nextNote.endTime);
        }
      } else {
        newNotes.push(currentNote);
        currentNote = NoteSequence.Note.create(nextNote);
      }
    }
    newNotes.push(currentNote);
  }
  
  mergedSeq.notes = newNotes.sort((a, b) => (a.quantizedStartStep || 0) - (b.quantizedStartStep || 0));
  return mergedSeq;
}

/**
 * Mescla melodia original + harmonia gerada em um
 * único NoteSequence usando `sequences.mergeInstruments`
 * após concatenar manualmente as notas.
 *
 * A harmonia gerada pelo Coconet vem com múltiplas vozes
 * (instruments 1–3). Combinamos tudo num único NS e depois
 * mesclamos instrumentos para playback unificado.
 */
function mergeSequences(
  melody: INoteSequence,
  harmony: INoteSequence
): NoteSequence {
  // Clone a melodia e adicione as notas da harmonia
  const merged = sequences.clone(melody);

  // Filtrar vozes da harmonia (instruments != 0) e adicionar
  const harmonyNotes = (harmony.notes ?? []).filter(
    (n) => n.instrument !== 0
  );

  for (const note of harmonyNotes) {
    merged.notes!.push(NoteSequence.Note.create(note));
  }

  // Atualizar totalQuantizedSteps
  if (merged.notes!.length > 0) {
    merged.totalQuantizedSteps = Math.max(
      ...merged.notes!.map((n) => n.quantizedEndStep ?? 0)
    );
  }

  // Corrigir notas subdivididas em todas as vozes (melodia + harmonia)
  return mergeTiedNotes(merged);
}

// ─────────────────────────────────────────────────────────
//  App Component
// ─────────────────────────────────────────────────────────

export default function App() {
  // ── UI state ──────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [timeSignature, setTimeSignature] = useState("4/4");
  const [appState, setAppState] = useState<AppState>("IDLE");
  const [sequencesList, setSequencesList] = useState<INoteSequence[]>([]);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Refs ──────────────────────────────────────────────
  const coconetRef = useRef<Coconet | null>(null);
  const playerRef = useRef<Player | null>(null);
  const appStateRef = useRef<AppState>("IDLE");
  const playingIndexRef = useRef<number | null>(null);

  // Manter ref sincronizado com state (para closures)
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  // ── Hooks personalizados ──────────────────────────────
  const metronome = useMetronome({ bpm, timeSignature });
  const pitchDetector = usePitchDetector();

  // ── Inicializar Coconet sob demanda ───────────────────
  const getCoconet = useCallback(async (): Promise<Coconet> => {
    if (coconetRef.current?.isInitialized()) {
      return coconetRef.current;
    }
    const model = new Coconet(COCONET_CHECKPOINT);
    await model.initialize();
    coconetRef.current = model;
    return model;
  }, []);

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
      playerRef.current?.stop();
      coconetRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Controle de Playback por item ─────────────────────
  const playSequence = useCallback(async (index: number, seq: INoteSequence) => {
    try {
      // Garantir que o AudioContext do Tone está rodando (exigência dos navegadores)
      await Tone.start();

      if (playingIndexRef.current === index) {
        playerRef.current?.stop();
        setPlayingIndex(null);
        playingIndexRef.current = null;
        return;
      }

      // Se havia outro tocando, para
      if (playerRef.current) {
        playerRef.current.stop();
      }

      setPlayingIndex(index);
      playingIndexRef.current = index;

      if (!playerRef.current) {
        playerRef.current = new Player(false, {
          run: () => { /* noop */ },
          stop: () => {
            // O callback de stop pode ser disparado por outra ação.
            // Só resetamos o estado visual se o player realmente parou naturalmente.
            // O Tone.Transport nos diz se ainda está rodando.
            if (Tone.getTransport().state !== "started") {
              setPlayingIndex(null);
              playingIndexRef.current = null;
            }
          },
        });
      }

      await playerRef.current.start(seq, bpm);
    } catch (err) {
      console.error("Erro no playback:", err);
      setPlayingIndex(null);
      playingIndexRef.current = null;
    }
  }, [bpm]);

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
        // 1) Parar metrônomo e detecção
        metronome.stop();
        const detectedNotes = pitchDetector.stopListening();

        if (detectedNotes.length === 0) {
          setErrorMsg("Nenhuma nota detectada. Tente novamente.");
          setAppState("IDLE");
          return;
        }

        // 2) PROCESSING
        setAppState("PROCESSING");

        try {
          // 3) Converter para NoteSequence quantizado
          const melodySeq = detectedNotesToSequence(detectedNotes, bpm);

          // 4) Gerar harmonia com Coconet
          const coconet = await getCoconet();
          const harmonySeq = await coconet.infill(melodySeq, {
            temperature: 0.99,
          });

          // 5) Mesclar melodia + harmonia
          const merged = mergeSequences(melodySeq, harmonySeq);

          // 6) Adicionar à lista
          setSequencesList((prev) => [...prev, merged]);
          setAppState("IDLE");

        } catch (err) {
          console.error("Erro ao gerar harmonia:", err);
          setErrorMsg(
            "Erro ao gerar harmonia. Verifique a conexão e tente novamente."
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
  }, [bpm, timeSignature, getCoconet, sequencesList.length, playSequence]);

  // ── Derivações visuais ────────────────────────────────
  const isActive = appState !== "IDLE";
  const isRecording = appState === "RECORDING";
  const isProcessing = appState === "PROCESSING";
  const isButtonDisabled = appState === "COUNT_IN" || isProcessing;
  const isBottomLayout = sequencesList.length > 0 || isProcessing;

  // Pulse no beat durante COUNT_IN e RECORDING
  const shouldPulse =
    metronome.isPulsing && (appState === "COUNT_IN" || isRecording);

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
      <aside
        className={`flex flex-col bg-black transition-all duration-300 ease-in-out relative z-20 border-r border-white/10 ${isSidebarOpen ? 'w-72' : 'w-[68px]'
          }`}
      >
        <div className="flex items-center h-16 px-3 pt-2">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2.5 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Alternar menu"
          >
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className={`ml-2 flex items-center overflow-hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
            }`}>
            <img src={requiemLogo} alt="Requiem Logo" className="h-7 w-auto drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
          </div>
        </div>

        <div className="px-3 mt-8">
          <button className={`flex items-center p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-all border border-white/5 ${isSidebarOpen ? 'w-full rounded-2xl' : 'w-11 justify-center'
            }`}>
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span className={`ml-3 text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'
              }`}>
              Nova Composição
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mt-8 px-3 scrollbar-hide">
          <h3 className={`text-[11px] font-semibold text-white/40 mb-3 ml-2 uppercase tracking-wider overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 h-0 mb-0'
            }`}>
            Recentes
          </h3>
          <ul className="space-y-1">
            {recentMelodies.map((melody, idx) => (
              <li key={idx}>
                <button className={`flex items-center w-full p-2.5 rounded-lg hover:bg-white/5 transition-colors ${isSidebarOpen ? 'justify-start' : 'justify-center'
                  }`}>
                  <svg className="w-4 h-4 text-white/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <span className={`ml-3 text-sm text-white/70 truncate transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'
                    }`}>
                    {melody}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ─── ÁREA PRINCIPAL ─── */}
      <main className="relative flex-1 flex flex-col justify-between p-8 overflow-hidden bg-black">

        {/* Camada da Aurora (Cores do Logo: Carmesim, Roxo Profundo) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 mix-blend-screen">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-red-800/20 blur-[130px] animate-aurora-slow" />
          <div className="absolute top-[20%] right-[-10%] w-[550px] h-[550px] rounded-full bg-rose-900/15 blur-[120px] animate-aurora-delayed" />
          <div className="absolute bottom-[-15%] left-[10%] w-[500px] h-[500px] rounded-full bg-purple-900/20 blur-[140px] animate-aurora-slow" />
        </div>

        {/* Corpo Central / Layout Flex */}
        <div className={`relative z-10 flex flex-col flex-1 ${isBottomLayout ? 'justify-between' : 'items-center justify-center'} text-center overflow-hidden`}>

          {/* Top Area: Título e Lista de Partituras */}
          <div className={`w-full max-w-4xl px-4 flex flex-col items-center transition-all duration-500 ease-in-out ${isBottomLayout ? 'flex-1 overflow-y-auto pt-4 pb-32 scrollbar-hide' : ''}`}>

            {!isBottomLayout && (
              <>
                <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight text-white mb-4 drop-shadow-md">
                  Transforme melodia em <span className="font-normal bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-rose-500 to-purple-600">harmonia</span>.
                </h1>

                <p className="text-sm sm:text-base font-light text-white/60 tracking-wide mb-12 max-w-md mx-auto leading-relaxed">
                  Toque uma nota contínua. A IA cuidará do contraponto em tempo real baseado nos seus parâmetros.
                </p>
              </>
            )}

            {/* LISTA DE PARTITURAS GERADAS */}
            {sequencesList.length > 0 && (
              <div className="w-full flex flex-col gap-8 mb-8 animate-fade-in">
                {sequencesList.map((seq, idx) => {
                  const isThisPlaying = playingIndex === idx;
                  return (
                    <div key={idx} className="w-full relative flex flex-col items-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                      <div className="flex justify-between items-center w-full mb-4 px-2">
                        <h2 className="text-xs font-mono tracking-[0.2em] text-white/60 uppercase">
                          Harmonia {idx + 1}
                        </h2>

                        <button
                          onClick={() => playSequence(idx, seq)}
                          className={`p-2 rounded-full transition-colors flex items-center justify-center ${isThisPlaying ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-white/10 text-white/80 hover:bg-white/20'
                            }`}
                        >
                          {isThisPlaying ? (
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

                      <div className="w-full overflow-x-auto scrollbar-hide">
                        <SheetMusicVisualizer noteSequence={seq} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* MENSAGEM DE ERRO */}
            {errorMsg && (
              <div className="mb-6 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono animate-fade-in">
                {errorMsg}
              </div>
            )}

          </div>

          {/* Bottom Area: Controles e Botão */}
          <div className={`w-full max-w-2xl px-4 flex flex-col items-center transition-all duration-500 ${isBottomLayout ? 'absolute bottom-0 left-1/2 -translate-x-1/2 pb-8 pt-4 bg-gradient-to-t from-black via-black/90 to-transparent' : ''}`}>

            <div className={`flex flex-wrap justify-center items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] transition-all duration-300 ${isActive ? "opacity-50 pointer-events-none" : "opacity-100"} ${isBottomLayout ? 'mb-4 scale-90' : 'mb-12'}`}>

              {/* Controle de Tonalidade */}
              <div className="flex flex-col items-start gap-1">
                <label className="text-[10px] uppercase tracking-widest text-white/50 ml-1">Tonalidade</label>
                <select
                  disabled={isActive}
                  className="bg-black/50 text-white text-sm rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-red-500/50 transition-colors appearance-none cursor-pointer"
                >
                  <option value="C">Dó Maior (C)</option>
                  <option value="G">Sol Maior (G)</option>
                  <option value="D">Ré Maior (D)</option>
                  <option value="Am">Lá Menor (Am)</option>
                  <option value="Em">Mi Menor (Em)</option>
                </select>
              </div>

              {/* Controle de Fórmula de Compasso */}
              <div className="flex flex-col items-start gap-1">
                <label className="text-[10px] uppercase tracking-widest text-white/50 ml-1">Compasso</label>
                <select
                  value={timeSignature}
                  onChange={(e) => setTimeSignature(e.target.value)}
                  disabled={isActive}
                  className="bg-black/50 text-white text-sm rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-red-500/50 transition-colors appearance-none cursor-pointer"
                >
                  <option value="4/4">4/4</option>
                  <option value="3/4">3/4</option>
                  <option value="6/8">6/8</option>
                </select>
              </div>

              {/* Controle de BPM */}
              <div className="flex flex-col items-start gap-1 min-w-[140px]">
                <label className="text-[10px] uppercase tracking-widest text-white/50 ml-1 flex justify-between w-full">
                  <span>Andamento</span>
                  <span className="text-red-400">{bpm} BPM</span>
                </label>
                <input
                  type="range"
                  min="60"
                  max="180"
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  disabled={isActive}
                  className="w-full h-2 mt-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
              </div>

            </div>

            {/* INDICADOR DE BEAT (COUNT-IN / RECORDING) */}
            {(appState === "COUNT_IN" || isRecording) && (
              <div className="flex items-center gap-3 mb-4 animate-fade-in">
                {Array.from({ length: Number(timeSignature.split("/")[0]) || 4 }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full transition-all duration-100 ${metronome.currentBeat === i
                        ? "bg-red-500 scale-125 shadow-[0_0_12px_rgba(220,38,38,0.8)]"
                        : "bg-white/20"
                        }`}
                    />
                  )
                )}
                {appState === "COUNT_IN" && (
                  <span className="ml-2 text-xs text-white/50 font-mono uppercase tracking-wider">
                    Contagem
                  </span>
                )}
                {isRecording && (
                  <span className="ml-2 text-xs text-red-400 font-mono uppercase tracking-wider animate-pulse">
                    ● REC
                  </span>
                )}
              </div>
            )}

            {/* INDICADOR DE FREQUÊNCIA (durante gravação) */}
            {isRecording && pitchDetector.currentFrequency > 0 && (
              <div className="mb-2 text-xs font-mono text-white/40 animate-fade-in">
                {pitchDetector.currentFrequency.toFixed(1)} Hz
              </div>
            )}

            {/* BOTÃO PRINCIPAL (Glassmorphism Forte) / LOADING PILL */}
            {isProcessing ? (
              <div className="inline-flex items-center justify-center gap-3 px-6 py-4 rounded-full bg-white/5 backdrop-blur-md border border-white/20 shadow-[0_0_40px_rgba(220,38,38,0.15)] animate-fade-in">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span className="text-[10px] font-mono tracking-[0.2em] text-white/70 uppercase">
                  Processando Harmonia...
                </span>
              </div>
            ) : (
              <div className="inline-flex flex-col items-center justify-center gap-2">
                <button
                  id="main-action-button"
                  onClick={handleMainButtonClick}
                  disabled={isButtonDisabled}
                  className={`
                    group relative ${isBottomLayout ? 'w-20 h-20' : 'w-28 h-28'} rounded-full
                    bg-white/5 backdrop-blur-md border
                    flex items-center justify-center
                    transition-all duration-200 ease-out
                    shadow-[0_0_40px_rgba(220,38,38,0.15)]
                    ${isButtonDisabled
                      ? "opacity-50 cursor-not-allowed border-white/10"
                      : "cursor-pointer hover:bg-white/10 hover:border-red-500/50 hover:scale-105 active:scale-95"
                    }
                    ${isRecording
                      ? "border-red-500/60 bg-red-500/10"
                      : "border-white/20"
                    }
                    ${shouldPulse
                      ? "scale-110 border-red-400 shadow-[0_0_60px_rgba(220,38,38,0.4)]"
                      : ""
                    }
                  `}
                >
                  <div className={`absolute inset-0 rounded-full blur-xl transition-opacity duration-500 ${isRecording
                    ? "bg-gradient-to-tr from-red-600/30 to-rose-600/30 opacity-100"
                    : "bg-gradient-to-tr from-red-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100"
                    }`} />

                  {isRecording ? (
                    <svg className={`${isBottomLayout ? 'w-6 h-6' : 'w-8 h-8'} text-red-400 relative z-10`} fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg className={`${isBottomLayout ? 'w-6 h-6' : 'w-8 h-8'} text-white/80 group-hover:text-white transition-colors relative z-10`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>

                {!isBottomLayout && (
                  <span className="text-[10px] font-mono tracking-[0.3em] text-white/40 uppercase mt-2">
                    {STATE_LABELS[appState]}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="relative z-10 w-full text-center text-[10px] font-mono tracking-[0.2em] text-white/30 max-w-5xl mx-auto">
          &copy; {new Date().getFullYear()} REQUIEM LABS &bull; POWERED BY MAGENTA.JS
        </footer>

      </main>

    </div>
  );
}