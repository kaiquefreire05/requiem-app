import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import type { INoteSequence } from "@magenta/music";

export interface UseStringEngineReturn {
  isLoaded: boolean;
  playSequence: (ns: INoteSequence) => Promise<void>;
  stop: () => void;
}

export function useStringEngine(): UseStringEngineReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);

  useEffect(() => {
    // 1. Instanciar o Reverb
    const reverb = new Tone.Reverb({
      decay: 2.5,
      preDelay: 0.1,
    });

    // 2. Instanciar o Sampler (Salamander Grand Piano)
    const sampler = new Tone.Sampler({
      urls: {
        A0: "A0.mp3",
        C1: "C1.mp3",
        C2: "C2.mp3",
        C3: "C3.mp3",
        C4: "C4.mp3",
        C5: "C5.mp3",
        C6: "C6.mp3",
        C7: "C7.mp3",
      },
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      onload: () => {
        setIsLoaded(true);
      },
    });

    // 3. Conectar a cadeia de sinal: Sampler -> Reverb -> Master
    sampler.chain(reverb, Tone.Destination);

    // Guardar as refs
    samplerRef.current = sampler;
    reverbRef.current = reverb;

    // 4. Limpeza da memória (prevenir memory leaks)
    return () => {
      sampler.dispose();
      reverb.dispose();
      Tone.Transport.stop();
      Tone.Transport.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (samplerRef.current) {
      samplerRef.current.releaseAll();
    }
    Tone.Transport.stop();
    Tone.Transport.cancel(); // Limpa a fila de eventos agendados
  }, []);

  const playSequence = useCallback(
    async (ns: INoteSequence) => {
      if (!isLoaded || !samplerRef.current) return;

      // Garantir que o áudio do Tone.js está desbloqueado
      await Tone.start();

      stop(); // Parar playback anterior

      const sampler = samplerRef.current;
      const now = Tone.now() + 0.1; // Adicionar pequeno buffer temporal

      // Agendar todas as notas da NoteSequence
      ns.notes?.forEach((note) => {
        if (note.startTime !== undefined && note.endTime !== undefined && note.pitch !== undefined) {
          const freq = Tone.Frequency(note.pitch, "midi").toNote();
          const duration = note.endTime - note.startTime;
          
          sampler.triggerAttackRelease(
            freq,
            duration,
            now + note.startTime,
            note.instrument === 0 ? 0.8 : 0.5 // Volume: melodia mais alta que a harmonia
          );
        }
      });

      // Opcional: Se quiser usar o Transport para rastrear o tempo,
      // Tone.Transport.start(); mas com Tone.now() não é estritamente necessário.
    },
    [isLoaded, stop]
  );

  return { isLoaded, playSequence, stop };
}
