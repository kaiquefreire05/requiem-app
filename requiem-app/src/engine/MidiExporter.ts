// ─────────────────────────────────────────────────────────
//  MidiExporter.ts
// ─────────────────────────────────────────────────────────
//  Gerador de arquivos MIDI (SMF Type 1) a partir dos
//  dados internos do Requiem. Zero dependências externas.
//
//  Responsabilidades:
//  1. Converter NoteSequence (melodia) → MIDI Track
//  2. Converter ChordSegment[] (harmonia) → MIDI Track
//  3. Gerar arquivo .mid binário completo (Type 1)
//  4. Disparar download no navegador
//
//  Formato: SMF Type 1, PPQN 480, 2 tracks por arquivo
//  Track 0: Lead Melody (canal 0)
//  Track 1: Chords (canal 1)
// ─────────────────────────────────────────────────────────

import type { INoteSequence } from "@magenta/music";
import type { ChordSegment, CompositionBlock } from "../App";
import { getChordPitchClasses } from "./TonalityAdapter";

// ─────────────────────────────────────────────────────────
//  Constantes
// ─────────────────────────────────────────────────────────

/** Pulses Per Quarter Note — padrão profissional */
const PPQN = 480;

/** Oitava base para notas de acorde (C3 = MIDI 48) */
const CHORD_BASE_OCTAVE = 48;

// ─────────────────────────────────────────────────────────
//  1. Utilitários Binários MIDI
// ─────────────────────────────────────────────────────────

/**
 * Codifica um valor inteiro em Variable-Length Quantity (VLQ).
 * O formato VLQ usa 7 bits por byte, com o MSB indicando
 * se há mais bytes a seguir.
 */
function writeVLQ(value: number): number[] {
  if (value < 0) value = 0;

  const bytes: number[] = [];
  bytes.unshift(value & 0x7F);
  value >>= 7;

  while (value > 0) {
    bytes.unshift((value & 0x7F) | 0x80);
    value >>= 7;
  }

  return bytes;
}

/**
 * Converte uma string ASCII em array de bytes.
 */
function stringToBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i));
  }
  return bytes;
}

/**
 * Escreve um inteiro de 16 bits (big-endian) em 2 bytes.
 */
function writeUint16(value: number): number[] {
  return [(value >> 8) & 0xFF, value & 0xFF];
}

/**
 * Escreve um inteiro de 32 bits (big-endian) em 4 bytes.
 */
function writeUint32(value: number): number[] {
  return [
    (value >> 24) & 0xFF,
    (value >> 16) & 0xFF,
    (value >> 8) & 0xFF,
    value & 0xFF,
  ];
}

// ─────────────────────────────────────────────────────────
//  2. Construtores de Eventos MIDI
// ─────────────────────────────────────────────────────────

interface MidiEvent {
  /** Delta time em ticks desde o evento anterior */
  deltaTicks: number;
  /** Bytes do evento (status + data) */
  data: number[];
}

/**
 * Cria um meta-event de Tempo (FF 51 03).
 * Converte BPM → microsegundos por quarter note.
 */
function createTempoEvent(bpm: number): MidiEvent {
  const microsecondsPerBeat = Math.round(60_000_000 / bpm);
  return {
    deltaTicks: 0,
    data: [
      0xFF, 0x51, 0x03,
      (microsecondsPerBeat >> 16) & 0xFF,
      (microsecondsPerBeat >> 8) & 0xFF,
      microsecondsPerBeat & 0xFF,
    ],
  };
}

/**
 * Cria um meta-event de Track Name (FF 03).
 */
function createTrackNameEvent(name: string): MidiEvent {
  const nameBytes = stringToBytes(name);
  return {
    deltaTicks: 0,
    data: [0xFF, 0x03, ...writeVLQ(nameBytes.length), ...nameBytes],
  };
}

/**
 * Cria um meta-event de Time Signature (FF 58 04).
 */
function createTimeSignatureEvent(numerator: number, denominator: number): MidiEvent {
  // O denominador no MIDI é expresso como potência de 2
  // 4/4 → denominator=4 → log2(4)=2
  const denomLog2 = Math.round(Math.log2(denominator));
  return {
    deltaTicks: 0,
    data: [
      0xFF, 0x58, 0x04,
      numerator,
      denomLog2,
      24,  // MIDI clocks per metronome click (padrão)
      8,   // 32nd notes per quarter note (padrão)
    ],
  };
}

/**
 * Cria o meta-event End of Track (FF 2F 00).
 */
function createEndOfTrackEvent(deltaTicks: number = 0): MidiEvent {
  return {
    deltaTicks,
    data: [0xFF, 0x2F, 0x00],
  };
}

/**
 * Cria um evento Note On (0x90 + canal).
 */
function createNoteOnEvent(deltaTicks: number, channel: number, pitch: number, velocity: number): MidiEvent {
  return {
    deltaTicks,
    data: [0x90 | (channel & 0x0F), pitch & 0x7F, velocity & 0x7F],
  };
}

/**
 * Cria um evento Note Off (0x80 + canal).
 */
function createNoteOffEvent(deltaTicks: number, channel: number, pitch: number): MidiEvent {
  return {
    deltaTicks,
    data: [0x80 | (channel & 0x0F), pitch & 0x7F, 0],
  };
}

// ─────────────────────────────────────────────────────────
//  3. Serialização de Track Chunk
// ─────────────────────────────────────────────────────────

/**
 * Serializa uma lista de MidiEvents em um Track Chunk (MTrk).
 * Formato: "MTrk" + 4 bytes de length + event data
 */
function buildTrackChunk(events: MidiEvent[]): number[] {
  // Serializar todos os eventos
  const eventBytes: number[] = [];
  for (const event of events) {
    eventBytes.push(...writeVLQ(event.deltaTicks));
    eventBytes.push(...event.data);
  }

  // Montar o chunk: "MTrk" + length (32-bit) + data
  const chunk: number[] = [
    ...stringToBytes("MTrk"),
    ...writeUint32(eventBytes.length),
    ...eventBytes,
  ];

  return chunk;
}

// ─────────────────────────────────────────────────────────
//  4. Conversão NoteSequence → Track de Melodia
// ─────────────────────────────────────────────────────────

/**
 * Converte as notas de melodia (instrument === 0) de um
 * NoteSequence em uma track MIDI completa.
 */
function buildMelodyTrack(
  noteSequence: INoteSequence | undefined,
  bpm: number,
  timeSignatureNumerator: number,
  timeSignatureDenominator: number,
): number[] {
  const events: MidiEvent[] = [];
  const channel = 0;

  // Meta-events iniciais
  events.push(createTrackNameEvent("Lead Melody"));
  events.push(createTempoEvent(bpm));
  events.push(createTimeSignatureEvent(timeSignatureNumerator, timeSignatureDenominator));

  if (noteSequence?.notes) {
    // Filtrar apenas notas de melodia (instrument 0)
    const melodyNotes = noteSequence.notes
      .filter(n => n.instrument === 0 && n.startTime != null && n.endTime != null)
      .sort((a, b) => a.startTime! - b.startTime!);

    // Converter cada nota em par Note On / Note Off
    // Precisamos calcular delta times relativos
    type TimedEvent = { absoluteTick: number; isNoteOn: boolean; pitch: number; velocity: number };
    const timedEvents: TimedEvent[] = [];

    const secondsToTicks = (seconds: number): number =>
      Math.round(seconds * (PPQN * bpm / 60));

    for (const note of melodyNotes) {
      const startTick = secondsToTicks(note.startTime!);
      const endTick = secondsToTicks(note.endTime!);
      const velocity = note.velocity ?? 80;

      timedEvents.push({
        absoluteTick: startTick,
        isNoteOn: true,
        pitch: note.pitch!,
        velocity,
      });
      timedEvents.push({
        absoluteTick: endTick,
        isNoteOn: false,
        pitch: note.pitch!,
        velocity: 0,
      });
    }

    // Ordenar por tick absoluto, Note Off antes de Note On no mesmo tick
    timedEvents.sort((a, b) => {
      if (a.absoluteTick !== b.absoluteTick) return a.absoluteTick - b.absoluteTick;
      // Note Off (false=0) antes de Note On (true=1) no mesmo tick
      return (a.isNoteOn ? 1 : 0) - (b.isNoteOn ? 1 : 0);
    });

    // Converter para delta times
    let lastTick = 0;
    for (const te of timedEvents) {
      const deltaTick = Math.max(0, te.absoluteTick - lastTick);
      if (te.isNoteOn) {
        events.push(createNoteOnEvent(deltaTick, channel, te.pitch, te.velocity));
      } else {
        events.push(createNoteOffEvent(deltaTick, channel, te.pitch));
      }
      lastTick = te.absoluteTick;
    }
  }

  // End of Track
  events.push(createEndOfTrackEvent(PPQN)); // 1 beat de silêncio final

  return buildTrackChunk(events);
}

// ─────────────────────────────────────────────────────────
//  5. Conversão ChordSegment[] → Track de Acordes
// ─────────────────────────────────────────────────────────

/**
 * Converte a progressão de acordes em uma track MIDI.
 * Cada acorde é um bloco de notas simultâneas na oitava C3.
 */
function buildChordsTrack(
  progression: ChordSegment[],
  bpm: number,
  timeSignatureDenominator: number,
): number[] {
  const events: MidiEvent[] = [];
  const channel = 1;

  // Meta-event de nome
  events.push(createTrackNameEvent("Chords"));

  if (progression.length === 0) {
    events.push(createEndOfTrackEvent(0));
    return buildTrackChunk(events);
  }

  const ticksPerBeat = PPQN;

  for (const seg of progression) {
    const pitchClasses = getChordPitchClasses(seg.chord);
    const midiPitches = pitchClasses.map(pc => CHORD_BASE_OCTAVE + pc);
    const velocity = Math.floor(Math.max(0.2, seg.velocity || 0.7) * 127);
    const durationTicks = Math.round(seg.durationBeats * ticksPerBeat);

    // Note On de todas as notas do acorde (delta = 0 para notas simultâneas)
    for (let i = 0; i < midiPitches.length; i++) {
      events.push(createNoteOnEvent(0, channel, midiPitches[i], velocity));
    }

    // Note Off de todas as notas (após durationTicks)
    for (let i = 0; i < midiPitches.length; i++) {
      // Primeiro Note Off carrega o delta total, os demais delta = 0
      const delta = i === 0 ? durationTicks : 0;
      events.push(createNoteOffEvent(delta, channel, midiPitches[i]));
    }
  }

  // End of Track
  events.push(createEndOfTrackEvent(PPQN));

  return buildTrackChunk(events);
}

// ─────────────────────────────────────────────────────────
//  6. Gerador MIDI Completo (SMF Type 1)
// ─────────────────────────────────────────────────────────

/**
 * Gera o cabeçalho MIDI (MThd) para um arquivo SMF Type 1.
 */
function buildMidiHeader(numTracks: number): number[] {
  return [
    ...stringToBytes("MThd"),  // Chunk type
    ...writeUint32(6),          // Chunk length (sempre 6)
    ...writeUint16(1),          // Format type 1 (multi-track)
    ...writeUint16(numTracks),  // Number of tracks
    ...writeUint16(PPQN),       // Ticks per quarter note
  ];
}

/**
 * Gera um arquivo MIDI completo (SMF Type 1) a partir de
 * um CompositionBlock do Requiem.
 *
 * @returns Uint8Array contendo o arquivo .mid binário
 */
export function exportBlockToMidi(
  block: CompositionBlock,
  bpm: number,
  utValue: number,
): Uint8Array {
  // Parsear time signature do bloco
  const tsParts = block.timeSignature.split("/");
  const tsNumerator = parseInt(tsParts[0] || "4");
  const tsDenominator = parseInt(tsParts[1] || "4");

  // Construir as duas tracks
  const melodyTrack = buildMelodyTrack(block.noteSequence, bpm, tsNumerator, tsDenominator);
  const chordsTrack = buildChordsTrack(block.progression, bpm, tsDenominator);

  // Montar o arquivo completo: Header + Tracks
  const header = buildMidiHeader(2);
  const fileBytes = [...header, ...melodyTrack, ...chordsTrack];

  return new Uint8Array(fileBytes);
}

// ─────────────────────────────────────────────────────────
//  7. Download Helper
// ─────────────────────────────────────────────────────────

/**
 * Dispara o download de um Uint8Array como arquivo .mid
 * no navegador do usuário.
 */
function downloadMidiFile(data: Uint8Array, filename: string): void {
  const blob = new Blob([data], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";

  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ─────────────────────────────────────────────────────────
//  8. API Pública — Exportação por Arrangement
// ─────────────────────────────────────────────────────────

/**
 * Exporta todos os arrangements (blocos) como arquivos MIDI
 * separados. Cada arquivo é nomeado pelo nome do bloco.
 *
 * Apenas blocos com conteúdo (notas ou progressão) são exportados.
 *
 * @param blocks   — Array de CompositionBlock (arrangements)
 * @param bpm      — BPM global da composição
 * @param utValue  — Unidade de tempo (denominador do compasso)
 */
export function exportArrangementToMidi(
  blocks: CompositionBlock[],
  bpm: number,
  utValue: number,
): void {
  const exportableBlocks = blocks.filter(
    b => (b.notes && b.notes.length > 0) || (b.progression && b.progression.length > 0)
  );

  if (exportableBlocks.length === 0) {
    console.warn("[MidiExporter] Nenhum bloco com conteúdo para exportar.");
    return;
  }

  // Pequeno delay entre downloads para evitar bloqueio do navegador
  exportableBlocks.forEach((block, index) => {
    setTimeout(() => {
      const midiData = exportBlockToMidi(block, bpm, utValue);
      const safeName = block.name.replace(/[<>:"/\\|?*]/g, "_"); // Sanitizar nome do arquivo
      downloadMidiFile(midiData, `${safeName}.mid`);
    }, index * 200);
  });
}
