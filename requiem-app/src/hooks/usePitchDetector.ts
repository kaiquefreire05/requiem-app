import { useCallback, useRef, useState } from "react";
import { YIN } from "pitchfinder";
import type { PitchDetector } from "pitchfinder/lib/detectors/types";

// ─────────────────────────────────────────────────────────
//  usePitchDetector – detecção de pitch via pitchfinder
// ─────────────────────────────────────────────────────────
//
//  Usa o AnalyserNode (Web Audio API) para capturar áudio
//  e o algoritmo YIN (via pitchfinder) para detectar a
//  frequência fundamental com precisão — sem erros de
//  oitava em instrumentos ricos em harmônicos.
//
//  Retorna um array de "notas detectadas" no formato
//  { pitch, startTime, endTime } pronto para converter
//  em NoteSequence do Magenta.
// ─────────────────────────────────────────────────────────

export interface DetectedNote {
  /** MIDI pitch number (0–127) */
  pitch: number;
  /** Tempo de início da nota em segundos (relativo ao início da gravação) */
  startTime: number;
  /** Tempo de fim da nota em segundos */
  endTime: number;
}

export interface UsePitchDetectorReturn {
  /** Inicia captura do microfone e detecção de pitch */
  startListening: () => Promise<void>;
  /** Para a detecção e retorna as notas detectadas */
  stopListening: () => DetectedNote[];
  /** Se está ativamente detectando */
  isListening: boolean;
  /** Última frequência detectada (Hz), 0 se silêncio */
  currentFrequency: number;
}

// ── Constantes de detecção ──────────────────────────────
const FFT_SIZE = 2048;
const SAMPLE_RATE = 44100;
const MIN_NOTE_DURATION = 0.05; // Notas menores que 50ms são descartadas
const DEBOUNCE_MS = 80;         // Debounce entre atualizações de pitch

/**
 * Converte frequência em Hz para número MIDI.
 * A4 = 440 Hz = MIDI 69.
 */
function freqToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

export function usePitchDetector(): UsePitchDetectorReturn {
  const [isListening, setIsListening] = useState(false);
  const [currentFrequency, setCurrentFrequency] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<PitchDetector | null>(null);

  const notesRef = useRef<DetectedNote[]>([]);
  const currentNoteRef = useRef<{ pitch: number; startTime: number } | null>(null);
  const startTimestampRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const isListeningRef = useRef(false);

  // ── Loop de detecção ──────────────────────────────────
  const detectLoop = useCallback(function loop() {
    if (!isListeningRef.current || !analyserRef.current || !detectorRef.current) return;

    const analyser = analyserRef.current;
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    const now = performance.now();

    // Debounce
    if (now - lastUpdateRef.current >= DEBOUNCE_MS) {
      lastUpdateRef.current = now;

      // 1. Calcular o volume RMS da amostra atual
      let rms = 0;
      for (let i = 0; i < buffer.length; i++) {
        rms += buffer[i] * buffer[i];
      }
      rms = Math.sqrt(rms / buffer.length);

      let freq = 0;

      // 2. O Noise Gate: Só calcula o pitch se o volume for maior que o chiado
      if (rms > 0.015) {
        const detected = detectorRef.current(buffer);
        
        // 3. Filtro de Frequência: Ignorar apitos bizarros (acima de 3000Hz) ou graves absurdos
        if (detected !== null && detected > 80 && detected < 3000) {
          freq = detected;
        }
      }

      const currentTime = (now - startTimestampRef.current) / 1000;

      setCurrentFrequency(freq);

      if (freq > 0) {
        const midi = freqToMidi(freq);
        const current = currentNoteRef.current;

        if (!current || current.pitch !== midi) {
          // Finalizar nota anterior
          if (current) {
            const duration = currentTime - current.startTime;
            if (duration >= MIN_NOTE_DURATION) {
              notesRef.current.push({
                pitch: current.pitch,
                startTime: current.startTime,
                endTime: currentTime,
              });
            }
          }
          // Iniciar nova nota
          currentNoteRef.current = { pitch: midi, startTime: currentTime };
        }
      } else {
        // Silêncio — finalizar nota se existir
        if (currentNoteRef.current) {
          const duration = currentTime - currentNoteRef.current.startTime;
          if (duration >= MIN_NOTE_DURATION) {
            notesRef.current.push({
              pitch: currentNoteRef.current.pitch,
              startTime: currentNoteRef.current.startTime,
              endTime: currentTime,
            });
          }
          currentNoteRef.current = null;
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  // ── Start ─────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    // Não conectar ao destination para não causar feedback

    // Instanciar o detector YIN com o sampleRate real do contexto
    detectorRef.current = YIN({ sampleRate: audioCtx.sampleRate });

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;
    sourceRef.current = source;
    streamRef.current = stream;

    notesRef.current = [];
    currentNoteRef.current = null;
    startTimestampRef.current = performance.now();
    lastUpdateRef.current = 0;
    isListeningRef.current = true;

    setIsListening(true);
    setCurrentFrequency(0);

    rafRef.current = requestAnimationFrame(detectLoop);
  }, [detectLoop]);

  // ── Stop ──────────────────────────────────────────────
  const stopListening = useCallback((): DetectedNote[] => {
    isListeningRef.current = false;
    setIsListening(false);

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Finalizar última nota em andamento
    if (currentNoteRef.current) {
      const currentTime = (performance.now() - startTimestampRef.current) / 1000;
      const duration = currentTime - currentNoteRef.current.startTime;
      if (duration >= MIN_NOTE_DURATION) {
        notesRef.current.push({
          pitch: currentNoteRef.current.pitch,
          startTime: currentNoteRef.current.startTime,
          endTime: currentTime,
        });
      }
      currentNoteRef.current = null;
    }

    // Cleanup de áudio
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    sourceRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    detectorRef.current = null;

    setCurrentFrequency(0);

    const result = [...notesRef.current];
    notesRef.current = [];
    return result;
  }, []);

  return {
    startListening,
    stopListening,
    isListening,
    currentFrequency,
  };
}
