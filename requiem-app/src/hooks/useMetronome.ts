import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";

// ─────────────────────────────────────────────────────────
//  useMetronome – metrônomo de alta precisão via Tone.js
// ─────────────────────────────────────────────────────────
//
//  • Usa Tone.Transport (Web Audio clock) para scheduling
//    com precisão de sub-milissegundo.
//  • Count-in de 1 compasso inteiro antes de sinalizar
//    "pronto para gravar".
//  • Primeiro beat de cada compasso tem tom mais agudo (acento).
//  • Retorna `isPulsing` que fica true por um breve flash
//    a cada batida — ideal para atrelar a uma animação CSS.
// ─────────────────────────────────────────────────────────

export interface UseMetronomeOptions {
  /** Batidas por minuto */
  bpm: number;
  /** Fórmula de compasso no formato "N/D" (ex: "4/4", "3/4", "6/8") */
  timeSignature: string;
  /** Se true, suprime os clicks de áudio mas mantém o pulso visual */
  muted?: boolean;
}

export interface UseMetronomeReturn {
  /** Inicia o metrônomo (count-in → gravação) */
  start: () => Promise<void>;
  /** Para o metrônomo imediatamente */
  stop: () => void;
  /** `true` durante o count-in, `false` depois */
  isCountingIn: boolean;
  /** `true` quando o count-in terminou e a gravação está liberada */
  isReady: boolean;
  /** Alterna para `true` brevemente a cada batida — use para CSS pulse */
  isPulsing: boolean;
  /** Índice do beat atual dentro do compasso (0-indexed) */
  currentBeat: number;
}

// ── Frequências dos clicks ──────────────────────────────
const ACCENT_FREQ = 1500;   // 1º beat – tom agudo
const NORMAL_FREQ = 1000;   // demais beats – tom padrão
const CLICK_DURATION = 0.04; // 40 ms – estalo curtíssimo

/**
 * Cria um "click" sintético usando um oscilador efêmero.
 * Isso evita a latência de carregar samples e garante
 * timing exato porque o `time` vem direto do Transport.
 */
function scheduleClick(
  synth: Tone.Synth,
  freq: number,
  time: Tone.Unit.Time
): void {
  synth.triggerAttackRelease(freq, CLICK_DURATION, time);
}

export function useMetronome({
  bpm,
  timeSignature,
  muted = false,
}: UseMetronomeOptions): UseMetronomeReturn {
  // ── Estado React ─────────────────────────────────────
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);

  // ── Refs persistentes ────────────────────────────────
  const synthRef = useRef<Tone.Synth | null>(null);
  const eventIdRef = useRef<number | null>(null);
  const beatCountRef = useRef(0);
  const beatsPerMeasureRef = useRef(4);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRunningRef = useRef(false);
  const mutedRef = useRef(muted);

  // Manter refs sincronizados com props
  useEffect(() => {
    const [numerator] = timeSignature.split("/").map(Number);
    beatsPerMeasureRef.current = numerator || 4;
  }, [timeSignature]);

  // Atualizar BPM do Transport em tempo real
  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  // Manter mutedRef sincronizado com a prop
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // ── Cleanup ao desmontar ─────────────────────────────
  useEffect(() => {
    return () => {
      cleanupTransport();
      synthRef.current?.dispose();
      synthRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers internos ─────────────────────────────────

  function cleanupTransport(): void {
    const transport = Tone.getTransport();
    if (eventIdRef.current !== null) {
      transport.clear(eventIdRef.current);
      eventIdRef.current = null;
    }
    transport.stop();
    transport.position = 0;
    if (pulseTimeoutRef.current) {
      clearTimeout(pulseTimeoutRef.current);
      pulseTimeoutRef.current = null;
    }
  }

  /**
   * Dispara o flash de `isPulsing`.
   * O timeout é calculado para durar ~60% do intervalo entre beats,
   * capped em 150 ms para não parecer "grudado".
   */
  function triggerPulse(): void {
    setIsPulsing(true);
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    const pulseDuration = Math.min((60 / bpm) * 0.6 * 1000, 150);
    pulseTimeoutRef.current = setTimeout(() => {
      setIsPulsing(false);
      pulseTimeoutRef.current = null;
    }, pulseDuration);
  }

  // ── Start ────────────────────────────────────────────
  const start = useCallback(async () => {
    // Garante que o AudioContext foi "resumed" pelo gesto do usuário
    await Tone.start();

    if (isRunningRef.current) return;
    isRunningRef.current = true;

    // Criar o synth uma única vez
    if (!synthRef.current) {
      synthRef.current = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: {
          attack: 0.001,
          decay: 0.05,
          sustain: 0,
          release: 0.02,
        },
        volume: -6,
      }).toDestination();
    }

    const transport = Tone.getTransport();
    transport.bpm.value = bpm;
    transport.position = 0;
    beatCountRef.current = 0;

    const beatsPerBar = beatsPerMeasureRef.current;

    // Reset de estado
    setIsCountingIn(true);
    setIsReady(false);
    setIsPulsing(false);
    setCurrentBeat(0);

    // ── Agendar cada beat via Transport ────────────────
    // Usamos "4n" (quarter note) como unidade base.
    // O Transport garante que o callback `time` é o tempo
    // exato no AudioContext, eliminando jitter do JS.
    eventIdRef.current = transport.scheduleRepeat(
      (time: number) => {
        const beat = beatCountRef.current;
        const beatInBar = beat % beatsPerBar;
        const isAccent = beatInBar === 0;

        // Click no audio thread (tempo exato) — silenciado se muted
        if (!mutedRef.current) {
          scheduleClick(
            synthRef.current!,
            isAccent ? ACCENT_FREQ : NORMAL_FREQ,
            time
          );
        }

        // Atualizações visuais no UI thread
        // Tone.getDraw() sincroniza com requestAnimationFrame
        // para que as atualizações de estado coincidam com
        // o frame de renderização mais próximo do click.
        Tone.getDraw().schedule(() => {
          if (!isRunningRef.current) return;

          setCurrentBeat(beatInBar);
          triggerPulse();

          // Transição count-in → ready após 1 compasso completo
          if (beat === beatsPerBar - 1) {
            setIsCountingIn(false);
            setIsReady(true);
          }
        }, time);

        beatCountRef.current++;
      },
      "4n", // intervalo = 1 quarter note
      0     // início imediato
    );

    transport.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, timeSignature]);

  // ── Stop ─────────────────────────────────────────────
  const stop = useCallback(() => {
    isRunningRef.current = false;
    cleanupTransport();
    setIsCountingIn(false);
    setIsReady(false);
    setIsPulsing(false);
    setCurrentBeat(0);
    beatCountRef.current = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    start,
    stop,
    isCountingIn,
    isReady,
    isPulsing,
    currentBeat,
  };
}
