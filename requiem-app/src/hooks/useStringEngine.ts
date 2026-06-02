import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import type { INoteSequence } from "@magenta/music";
import type { InstrumentType } from "../App";

export interface UseStringEngineReturn {
  isLoaded: boolean;
  playSequence: (ns: INoteSequence, startTimeOffset?: number, melodyInst?: InstrumentType, chordsInst?: InstrumentType) => Promise<void>;
  playFullArrangement: (blocks: { noteSequence?: INoteSequence; bpm: number }[], melodyInst?: InstrumentType, chordsInst?: InstrumentType) => Promise<void>;
  stop: () => void;
  setTrackVolume: (track: number, vol: number) => void;
  setTrackMute: (track: number, muted: boolean) => void;
}

export function useStringEngine(): UseStringEngineReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const pianoSynthRef = useRef<Tone.Sampler | null>(null);
  const stringsSynthRef = useRef<Tone.Sampler | null>(null);
  const padSynthRef = useRef<Tone.PolySynth | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);

  const volumesRef = useRef<{ [key: number]: number }>({ 0: 1, 1: 1 });
  const mutesRef = useRef<{ [key: number]: boolean }>({ 0: false, 1: false });

  const setTrackVolume = useCallback((track: number, vol: number) => {
    volumesRef.current[track] = vol;
  }, []);

  const setTrackMute = useCallback((track: number, muted: boolean) => {
    mutesRef.current[track] = muted;
    // Se mutou agora e estava tocando, liberte o som para não ficar "preso"
    if (muted) {
      if (pianoSynthRef.current) pianoSynthRef.current.releaseAll();
      if (stringsSynthRef.current) stringsSynthRef.current.releaseAll();
      if (padSynthRef.current) padSynthRef.current.releaseAll();
    }
  }, []);

  useEffect(() => {
    // 1. Instanciar o Reverb comum para dar "espaço" a todos os synths
    const reverb = new Tone.Reverb({
      decay: 2.5,
      preDelay: 0.1,
    });

    // 2. Instanciar PIANO (Sampler)
    const pianoSynth = new Tone.Sampler({
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
      volume: 12,
    });
    pianoSynth.chain(reverb, Tone.Destination);

    // 3. Instanciar STRINGS (Sampler com Cello)
    const stringsSynth = new Tone.Sampler({
      urls: {
        "A4": "A4.mp3",
        "C4": "C4.mp3",
        "E4": "E4.mp3",
        "G4": "G4.mp3"
      },
      baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/cello/",
      release: 1.5,
      attack: 0.5,
      volume: -4,
    });
    stringsSynth.chain(reverb, Tone.Destination);

    // 4. Instanciar PAD (FMSynth com Filtro Lowpass)
    const padSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 0.5,
      modulationIndex: 1.2,
      oscillator: { type: "sine" },
      modulation: { type: "triangle" },
      envelope: {
        attack: 1.0,
        decay: 0.5,
        sustain: 1.0,
        release: 2.0,
      },
      volume: -10,
    });
    const lowpassFilter = new Tone.Filter(800, "lowpass");
    padSynth.chain(lowpassFilter, reverb, Tone.Destination);

    // Guardar as refs
    pianoSynthRef.current = pianoSynth;
    stringsSynthRef.current = stringsSynth;
    padSynthRef.current = padSynth;
    reverbRef.current = reverb;

    // 5. Aguardar todos os buffers (Piano e Strings) serem baixados
    Tone.loaded().then(() => {
      setIsLoaded(true);
    });

    // 6. Limpeza da memória
    return () => {
      pianoSynth.dispose();
      stringsSynth.dispose();
      padSynth.dispose();
      lowpassFilter.dispose();
      reverb.dispose();
      Tone.Transport.stop();
      Tone.Transport.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    Tone.Transport.stop();
    Tone.Transport.cancel(); // Limpa a fila de eventos agendados
    if (pianoSynthRef.current) pianoSynthRef.current.releaseAll();
    if (stringsSynthRef.current) stringsSynthRef.current.releaseAll();
    if (padSynthRef.current) padSynthRef.current.releaseAll();
  }, []);

  const routeNote = (note: any, time: number, duration: number, melodyInst: InstrumentType = "piano", chordsInst: InstrumentType = "piano") => {
    if (!pianoSynthRef.current || !stringsSynthRef.current || !padSynthRef.current) return;
    
    // Identificar qual instrumento usar (0 = Melody, 1 = Chords)
    const trackIndex = note.instrument === 0 ? 0 : 1;
    
    // Checar Mute
    if (mutesRef.current[trackIndex]) return;

    const instType = trackIndex === 0 ? melodyInst : chordsInst;
    let synth: Tone.Sampler | Tone.PolySynth = pianoSynthRef.current;
    
    if (instType === "strings") synth = stringsSynthRef.current;
    if (instType === "pad") synth = padSynthRef.current;

    const freq = Tone.Frequency(note.pitch, "midi").toNote();
    
    // Calcular Velocity (Volume Base * Track Volume)
    const baseVelocity = note.velocity != null ? note.velocity / 127 : (trackIndex === 0 ? 1 : 0.7);
    const finalVelocity = baseVelocity * volumesRef.current[trackIndex];
    
    if (finalVelocity <= 0.01) return;
    
    synth.triggerAttackRelease(freq, duration, time, finalVelocity);
  };

  const playSequence = useCallback(
    async (ns: INoteSequence, startTimeOffset: number = 0, melodyInst: InstrumentType = "piano", chordsInst: InstrumentType = "piano") => {
      if (!isLoaded || !pianoSynthRef.current) return;

      await Tone.start();
      stop(); // Parar playback anterior

      // Agendar todas as notas da NoteSequence
      ns.notes?.forEach((note) => {
        if (note.startTime != null && note.endTime != null && note.pitch != null) {
          if (note.endTime <= startTimeOffset) return; // Skip finished notes

          const startDelay = Math.max(0, note.startTime - startTimeOffset);
          const duration = note.endTime - Math.max(note.startTime, startTimeOffset);
          
          Tone.Transport.schedule((time) => {
            routeNote(note, time, duration, melodyInst, chordsInst);
          }, `+${startDelay}`);
        }
      });
      
      Tone.Transport.start();
    },
    [isLoaded, stop]
  );

  const playFullArrangement = useCallback(
    async (blocks: { noteSequence?: INoteSequence; bpm: number }[], melodyInst: InstrumentType = "piano", chordsInst: InstrumentType = "piano") => {
      if (!isLoaded || !pianoSynthRef.current) return;

      await Tone.start();
      stop();

      let accumulatedTime = 0;

      blocks.forEach((block) => {
        if (!block.noteSequence) return;
        
        let maxEndTime = 0;

        block.noteSequence.notes?.forEach((note) => {
          if (note.startTime != null && note.endTime != null && note.pitch != null) {
            const duration = note.endTime - note.startTime;
            
            Tone.Transport.schedule((time) => {
              routeNote(note, time, duration, melodyInst, chordsInst);
            }, `+${accumulatedTime + note.startTime}`);

            if (note.endTime > maxEndTime) {
              maxEndTime = note.endTime;
            }
          }
        });

        accumulatedTime += maxEndTime;
      });

      Tone.Transport.start();
    },
    [isLoaded, stop]
  );

  return { isLoaded, playSequence, stop, playFullArrangement, setTrackVolume, setTrackMute };
}
