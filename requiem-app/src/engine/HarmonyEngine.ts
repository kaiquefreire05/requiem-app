import type { DetectedNote } from "../hooks/usePitchDetector";
import { chordToRoman, getChordPitchClasses } from "./TonalityAdapter";

// ─────────────────────────────────────────────────────────
//  1. Tipos e Interfaces
// ─────────────────────────────────────────────────────────

export interface ChordNode {
  readonly notes: readonly number[];
  readonly allowedTransitions: readonly string[];
}

export interface ProgressionData {
  readonly title: string;
  readonly originalTonality: string;
  readonly normalizedProgression: readonly string[];
}

export type TransitionMatrix = Readonly<Record<string, Readonly<Record<string, number>>>>;

export interface TwoTierMarkovModel {
  baseMatrix: TransitionMatrix;
  suffixMatrix: TransitionMatrix;
}

// ─────────────────────────────────────────────────────────
//  2. Grafo Harmônico (Knowledge Base)
// ─────────────────────────────────────────────────────────

export const HARMONY_GRAPH: Readonly<Record<string, ChordNode>> = {
  // ── Acordes Maiores ────────────────
  C:  { notes: [0, 4, 7],   allowedTransitions: ["C", "G", "F", "Am", "Dm", "Em", "G7", "C7", "E7", "A7", "D7", "Bdim"] },
  G:  { notes: [7, 11, 2],  allowedTransitions: ["G", "C", "D", "Em", "Am", "Bm", "D7", "G7", "B7", "E7", "F#dim"] },
  D:  { notes: [2, 6, 9],   allowedTransitions: ["D", "G", "A", "Bm", "Em", "F#m", "A7", "D7", "F#dim", "E7"] },
  A:  { notes: [9, 1, 4],   allowedTransitions: ["A", "D", "E", "F#m", "Bm", "C#m", "E7", "A7", "C#dim", "B7"] },
  E:  { notes: [4, 8, 11],  allowedTransitions: ["E", "A", "B", "C#m", "F#m", "G#m", "B7", "E7", "G#dim"] },
  B:  { notes: [11, 3, 6],  allowedTransitions: ["B", "E", "F#", "G#m", "C#m", "D#m", "F#7", "B7"] },
  "F#": { notes: [6, 10, 1],  allowedTransitions: ["F#", "B", "C#", "D#m", "G#m", "F#7", "C#7"] },
  F:  { notes: [5, 9, 0],   allowedTransitions: ["F", "C", "Bb", "Dm", "Am", "Gm", "C7", "F7", "D7", "A7"] },
  Bb: { notes: [10, 2, 5],  allowedTransitions: ["Bb", "F", "Eb", "Gm", "Dm", "Cm", "F7", "Bb7", "D7"] },
  Eb: { notes: [3, 7, 10],  allowedTransitions: ["Eb", "Bb", "Ab", "Cm", "Gm", "Fm", "Bb7", "Eb7", "G7"] },
  Ab: { notes: [8, 0, 3],   allowedTransitions: ["Ab", "Eb", "Db", "Fm", "Cm", "Bbm", "Eb7", "Ab7"] },
  Db: { notes: [1, 5, 8],   allowedTransitions: ["Db", "Ab", "Gb", "Bbm", "Fm", "Ab7", "Db7"] },

  // ── Acordes Menores ───────────
  Am: { notes: [9, 0, 4],   allowedTransitions: ["Am", "C", "Dm", "Em", "F", "G", "E7", "G7", "A7", "Bdim", "D7"] },
  Em: { notes: [4, 7, 11],  allowedTransitions: ["Em", "G", "Am", "C", "D", "Bm", "B7", "D7", "F#dim", "E7"] },
  Bm: { notes: [11, 2, 6],  allowedTransitions: ["Bm", "D", "Em", "G", "A", "F#m", "F#7", "A7", "F#dim"] },
  "F#m": { notes: [6, 9, 1],  allowedTransitions: ["F#m", "A", "Bm", "D", "E", "C#m", "C#7", "E7", "C#dim"] },
  "C#m": { notes: [1, 4, 8],  allowedTransitions: ["C#m", "E", "F#m", "A", "B", "G#m", "G#7", "B7", "G#dim"] },
  "G#m": { notes: [8, 11, 3], allowedTransitions: ["G#m", "B", "C#m", "E", "F#", "D#m", "D#7", "F#7"] },
  "D#m": { notes: [3, 6, 10], allowedTransitions: ["D#m", "F#", "G#m", "B", "D#7", "A#7"] },
  Dm: { notes: [2, 5, 9],   allowedTransitions: ["Dm", "F", "Am", "C", "Bb", "Gm", "A7", "C7", "D7", "Bdim"] },
  Gm: { notes: [7, 10, 2],  allowedTransitions: ["Gm", "Bb", "Dm", "F", "Eb", "Cm", "D7", "F7", "Bb7"] },
  Cm: { notes: [0, 3, 7],   allowedTransitions: ["Cm", "Eb", "Gm", "Bb", "Ab", "Fm", "G7", "Bb7", "Eb7"] },
  Fm: { notes: [5, 8, 0],   allowedTransitions: ["Fm", "Ab", "Cm", "Eb", "Db", "Bbm", "C7", "Eb7", "Ab7"] },
  Bbm: { notes: [10, 1, 5], allowedTransitions: ["Bbm", "Db", "Fm", "Ab", "F7", "Ab7", "Db7"] },

  // ── Acordes Dominantes ──────
  G7:  { notes: [7, 11, 2, 5],  allowedTransitions: ["C", "Am", "Cm", "G7", "C7", "F", "Dm"] },
  D7:  { notes: [2, 6, 9, 0],   allowedTransitions: ["G", "Em", "Gm", "D7", "G7", "C", "Am"] },
  A7:  { notes: [9, 1, 4, 7],   allowedTransitions: ["D", "Bm", "Dm", "A7", "D7", "G", "Em"] },
  E7:  { notes: [4, 8, 11, 2],  allowedTransitions: ["A", "F#m", "Am", "E7", "A7", "D", "Bm"] },
  B7:  { notes: [11, 3, 6, 9],  allowedTransitions: ["E", "C#m", "Em", "B7", "E7", "A", "F#m"] },
  "F#7": { notes: [6, 10, 1, 4], allowedTransitions: ["B", "G#m", "Bm", "F#7", "B7", "E", "C#m"] },
  "C#7": { notes: [1, 5, 8, 11], allowedTransitions: ["F#", "D#m", "F#m", "C#7", "F#7", "B"] },
  C7:  { notes: [0, 4, 7, 10],  allowedTransitions: ["F", "Dm", "Fm", "C7", "F7", "Bb", "Gm"] },
  F7:  { notes: [5, 9, 0, 3],   allowedTransitions: ["Bb", "Gm", "Bbm", "F7", "Bb7", "Eb", "Cm"] },
  Bb7: { notes: [10, 2, 5, 8],  allowedTransitions: ["Eb", "Cm", "Bb7", "Eb7", "Ab", "Fm"] },
  Eb7: { notes: [3, 7, 10, 1],  allowedTransitions: ["Ab", "Fm", "Eb7", "Ab7", "Db"] },
  Ab7: { notes: [8, 0, 3, 6],   allowedTransitions: ["Db", "Bbm", "Ab7", "Db7"] },
  Db7: { notes: [1, 5, 8, 11],  allowedTransitions: ["Gb", "Db7", "Ab", "Fm"] },
  "D#7": { notes: [3, 7, 10, 1], allowedTransitions: ["G#m", "D#7", "G#", "F"] },
  "G#7": { notes: [8, 0, 3, 6],  allowedTransitions: ["C#m", "G#7", "C#", "F#m"] },
  "A#7": { notes: [10, 2, 5, 8], allowedTransitions: ["D#m", "A#7", "D#", "G#m"] },

  // ── Acordes Diminutos ──────
  Bdim:   { notes: [11, 2, 5],  allowedTransitions: ["C", "Am", "G7", "Dm", "F", "Em"] },
  "F#dim": { notes: [6, 9, 0],   allowedTransitions: ["G", "Em", "D7", "Am", "C", "Bm"] },
  "C#dim": { notes: [1, 4, 7],   allowedTransitions: ["D", "Bm", "A7", "Em", "G", "F#m"] },
  "G#dim": { notes: [8, 11, 2],  allowedTransitions: ["A", "F#m", "E7", "Bm", "D", "C#m"] },
  "D#dim": { notes: [3, 6, 9],   allowedTransitions: ["E", "C#m", "B7", "F#m", "A"] },
  "A#dim": { notes: [10, 1, 4],  allowedTransitions: ["B", "G#m", "F#7", "C#m", "E"] },
  Edim:   { notes: [4, 7, 10],  allowedTransitions: ["F", "Dm", "C7", "Am", "Bb", "Gm"] },
  Adim:   { notes: [9, 0, 3],   allowedTransitions: ["Bb", "Gm", "F7", "Dm", "Eb", "Cm"] },
  Ddim:   { notes: [2, 5, 8],   allowedTransitions: ["Eb", "Cm", "Bb7", "Gm", "Ab", "Fm"] },
  Gdim:   { notes: [7, 10, 1],  allowedTransitions: ["Ab", "Fm", "Eb7", "Cm", "Db"] },
  Cdim:   { notes: [0, 3, 6],   allowedTransitions: ["Db", "Bbm", "Ab7", "Fm"] },
  Fdim:   { notes: [5, 8, 11],  allowedTransitions: ["Gb", "Ebm", "Db7", "Bbm"] },

  // ── Aliases Enharmônicos ──────────────────────────────
  "C#": { notes: [1, 5, 8], allowedTransitions: ["Db", "Ab", "Gb", "Bbm", "Fm", "Ab7", "Db7"] },
  Gb: { notes: [6, 10, 1],  allowedTransitions: ["F#", "B", "C#", "D#m", "G#m", "F#7", "C#7"] },
  "G#": { notes: [8, 0, 3], allowedTransitions: ["Ab", "Eb", "Db", "Fm", "Cm", "Bbm", "Eb7", "Ab7"] },
  "D#": { notes: [3, 7, 10], allowedTransitions: ["Eb", "Bb", "Ab", "Cm", "Gm", "Fm", "Bb7", "Eb7", "G7"] },
  Ebm: { notes: [3, 6, 10], allowedTransitions: ["D#m", "F#", "G#m", "B", "D#7", "A#7"] },
} as const;

// ─────────────────────────────────────────────────────────
//  3. Carregamento e Transformação (Two-Tier Model)
// ─────────────────────────────────────────────────────────

const dataModules = import.meta.glob<ProgressionData>(
  "../assets/music_data/*.json",
  { eager: true, import: "default" },
);

const HARMONY_GRAPH_BASES_ROMAN = new Set(
  Object.keys(HARMONY_GRAPH).map(c => chordToRoman(c, "C"))
);

const splitCinematic = (roman: string): { baseRoman: string, extension: string } => {
  // Se o acorde inteiro já faz parte do grafo estrutural (ex: V7), trate como Base pura
  if (HARMONY_GRAPH_BASES_ROMAN.has(roman)) {
    return { baseRoman: roman, extension: "none" };
  }
  
  // Caso contrário, isola a raiz (I, vi, etc) do sufixo (add9, maj7, etc)
  const match = roman.match(/^([b#]?(?:III|iii|II|ii|IV|iv|VIII|viii|VII|vii|VI|vi|V|v|I|i))(.*)$/);
  if (!match) return { baseRoman: roman, extension: "none" };
  
  const base = match[1];
  const suffix = match[2];

  return { baseRoman: base, extension: suffix || "none" };
};

interface TwoTierDatasets {
  baseProgressions: string[][];
  suffixData: { base: string, extension: string }[][];
}

const extractTwoTierDataset = (modules: Record<string, ProgressionData>): TwoTierDatasets => {
  const baseProgressions: string[][] = [];
  const suffixData: { base: string, extension: string }[][] = [];

  Object.values(modules)
    .filter((mod): mod is ProgressionData => Array.isArray(mod?.normalizedProgression) && typeof mod?.originalTonality === "string")
    .forEach(mod => {
      const bProg: string[] = [];
      const sProg: { base: string, extension: string }[] = [];
      mod.normalizedProgression.forEach(chord => {
        const roman = chordToRoman(chord, mod.originalTonality);
        const { baseRoman, extension } = splitCinematic(roman);
        bProg.push(baseRoman);
        sProg.push({ base: baseRoman, extension });
      });
      baseProgressions.push(bProg);
      suffixData.push(sProg);
    });

  return { baseProgressions, suffixData };
};

// ─────────────────────────────────────────────────────────
//  4. Cadeias de Markov (Base + Sufixos)
// ─────────────────────────────────────────────────────────

export const buildTwoTierMarkovModel = (datasets: TwoTierDatasets): TwoTierMarkovModel => {
  const { baseProgressions, suffixData } = datasets;
  const ALPHA = 0.01;

  // -- Matriz Base --
  const baseCounts: Record<string, Record<string, number>> = {};
  const allBaseDegrees = Array.from(HARMONY_GRAPH_BASES_ROMAN);

  for (const progression of baseProgressions) {
    for (let i = 0; i < progression.length - 1; i++) {
      const from1 = progression[i];
      const to = progression[i + 1];

      if (!baseCounts[from1]) baseCounts[from1] = {};
      baseCounts[from1][to] = (baseCounts[from1][to] ?? 0) + 1;

      if (i >= 1) {
        const from2 = progression[i - 1];
        const state2 = `${from2},${from1}`;
        if (!baseCounts[state2]) baseCounts[state2] = {};
        baseCounts[state2][to] = (baseCounts[state2][to] ?? 0) + 1;
      }
    }
  }

  const baseMatrix: Record<string, Record<string, number>> = {};
  for (const [state, destinations] of Object.entries(baseCounts)) {
    baseMatrix[state] = {};
    let totalOutgoing = 0;
    for (const degree of allBaseDegrees) {
      const count = (destinations[degree] ?? 0) + ALPHA;
      baseMatrix[state][degree] = count;
      totalOutgoing += count;
    }
    for (const degree of allBaseDegrees) {
      baseMatrix[state][degree] /= totalOutgoing;
    }
  }

  // -- Matriz de Sufixos --
  const suffixCounts: Record<string, Record<string, number>> = {};
  const allExtensions = new Set<string>(["none", "add9", "madd9", "sus4", "sus2", "maj7", "m7b5", "aug", "m7", "7", "11", "m11", "5"]);

  for (const sProg of suffixData) {
    for (const item of sProg) {
      if (!suffixCounts[item.base]) suffixCounts[item.base] = {};
      suffixCounts[item.base][item.extension] = (suffixCounts[item.base][item.extension] ?? 0) + 1;
      allExtensions.add(item.extension);
    }
  }

  const extensionsArray = Array.from(allExtensions);
  const suffixMatrix: Record<string, Record<string, number>> = {};
  
  for (const [baseState, extensions] of Object.entries(suffixCounts)) {
    suffixMatrix[baseState] = {};
    let totalExt = 0;
    for (const ext of extensionsArray) {
      const count = (extensions[ext] ?? 0) + ALPHA;
      suffixMatrix[baseState][ext] = count;
      totalExt += count;
    }
    for (const ext of extensionsArray) {
      suffixMatrix[baseState][ext] /= totalExt;
    }
  }

  return { baseMatrix, suffixMatrix };
};

const twoTierDatasets = extractTwoTierDataset(dataModules);
export const markovModel: TwoTierMarkovModel = buildTwoTierMarkovModel(twoTierDatasets);

// ─────────────────────────────────────────────────────────
//  6. Constantes de Pesos e Heurísticas
// ─────────────────────────────────────────────────────────

const WEIGHT_IN_CHORD = 2.0;
const WEIGHT_ROOT_BONUS = 1.5;
const WEIGHT_OUT_PENALTY = 0.5;
const WEIGHT_STRONG_BEAT = 3.0;
const WEIGHT_WEAK_BEAT = 0.5;
const BEAT_MARGIN_SEC = 0.15;
const REGISTER_LOW_THRESHOLD = 48; 
const REGISTER_HIGH_THRESHOLD = 72; 
const REGISTER_PENALTY = 0.2;
const REGISTER_BONUS = 1.5;
const DENSITY_THRESHOLD = 8;
const ORNAMENT_PENALTY_MULTIPLIER = 0.2; 
const LEAP_THRESHOLD = 7;
const TENSION_BONUS = 1.5;

const WEIGHT_MARKOV = 20.0;
const THRESHOLD_MODAL_INTERCHANGE = 0.05;

// ─────────────────────────────────────────────────────────
//  7. Avaliação de Notas
// ─────────────────────────────────────────────────────────

const computeNoteScore = (
  chordName: string,
  chordNotes: readonly number[],
  playedNotes: readonly DetectedNote[],
  windowStart: number,
  secondsPerBeat: number,
  isHighDensity: boolean,
  avgPitch: number,
  avgAmplitude: number
): number => {
  let score = 0;
  const rootNote = chordNotes[0];
  const outPenalty = isHighDensity ? WEIGHT_OUT_PENALTY * ORNAMENT_PENALTY_MULTIPLIER : WEIGHT_OUT_PENALTY;

  for (const note of playedNotes) {
    const pc = Math.round(note.pitch) % 12;
    const isChordTone = chordNotes.includes(pc);
    const isRoot = pc === rootNote;

    const relTime = note.startTime - windowStart;
    const beatPhase = (relTime % secondsPerBeat) / secondsPerBeat;
    const isStrongBeat = beatPhase < BEAT_MARGIN_SEC || beatPhase > 1 - BEAT_MARGIN_SEC;
    const rhythmicWeight = isStrongBeat ? WEIGHT_STRONG_BEAT : WEIGHT_WEAK_BEAT;

    const amplitudeWeight = (note.amplitude || 0.7) / avgAmplitude;

    let registerMod = 1.0;
    if (note.pitch < REGISTER_LOW_THRESHOLD && isRoot) registerMod = REGISTER_BONUS;
    if (note.pitch > REGISTER_HIGH_THRESHOLD && !isChordTone) registerMod = REGISTER_PENALTY;

    const baseVal = isChordTone ? (WEIGHT_IN_CHORD + (isRoot ? WEIGHT_ROOT_BONUS : 0)) : -outPenalty;
    score += baseVal * rhythmicWeight * amplitudeWeight * registerMod;
  }
  return score;
};

// ─────────────────────────────────────────────────────────
//  8. Algoritmo Principal (Two-Tier)
// ─────────────────────────────────────────────────────────

const lookupStyleProbability = (
  matrix: TransitionMatrix,
  state1: string,
  state2: string | null,
  targetState: string,
): number => {
  if (state2 && matrix[state2]?.[targetState] !== undefined) return matrix[state2][targetState];
  if (matrix[state1]?.[targetState] !== undefined) return matrix[state1][targetState];
  return 0; 
};

export function determineNextChord(
  chordHistory: readonly string[],
  playedNotes: readonly DetectedNote[],
  windowStart: number,
  secondsPerBeat: number,
  model: TwoTierMarkovModel = markovModel,
  isReroll: boolean = false
): { chord: string, velocity: number } {
  const currentChord = chordHistory.length > 0 ? chordHistory[chordHistory.length - 1] : "C";

  if (playedNotes.length === 0) return { chord: currentChord, velocity: 0.7 };

  // O acorde de histórico pode ter sufixos acoplados (ex: Cadd9). Usamos splitCinematic para extrair a base pura.
  const { baseRoman: currentBase } = splitCinematic(currentChord);
  // Precisamos do nó HARMONY_GRAPH da base do acorde atual
  const currentBaseName = Object.keys(HARMONY_GRAPH).find(c => chordToRoman(c, "C") === currentBase) || "C";
  const currentNode = HARMONY_GRAPH[currentBaseName];

  if (!currentNode) return { chord: currentChord, velocity: 0.7 };

  const romanHistory = chordHistory.map(c => chordToRoman(c, "C")).map(r => splitCinematic(r).baseRoman);
  const currRoman = romanHistory.length > 0 ? romanHistory[romanHistory.length - 1] : "I";
  const prevRoman = romanHistory.length > 1 ? romanHistory[romanHistory.length - 2] : null;

  const state1 = currRoman;
  const state2 = prevRoman ? `${prevRoman},${currRoman}` : null;

  const density = playedNotes.length;
  const isHighDensity = density > DENSITY_THRESHOLD;

  let sumPitch = 0;
  let sumAmp = 0;
  let hasHighTensionLeap = false;

  for (let i = 0; i < density; i++) {
    sumPitch += playedNotes[i].pitch;
    sumAmp += (playedNotes[i].amplitude || 0.7);
    if (i > 0) {
      const leap = Math.abs(playedNotes[i].pitch - playedNotes[i - 1].pitch);
      if (leap >= LEAP_THRESHOLD) hasHighTensionLeap = true;
    }
  }
  const avgPitch = density > 0 ? sumPitch / density : 0;
  const avgAmplitude = density > 0 ? Math.max(0.2, sumAmp / density) : 0.7;

  // -- O SISTEMA DE VOTAÇÃO TWO-TIER --
  const allBaseCandidates = Object.keys(HARMONY_GRAPH);
  
  // Extraímos dinamicamente os sufixos treinados do modelo.
  const allExtensionsArray = Object.keys(model.suffixMatrix[currRoman] || { "none": 1 });
  if (allExtensionsArray.length === 0) allExtensionsArray.push("none");

  const candidates: { chord: string, score: number }[] = [];

  for (const candidateBaseName of allBaseCandidates) {
    const candidateRoman = chordToRoman(candidateBaseName, "C");
    const { baseRoman } = splitCinematic(candidateRoman);

    let baseStyleProb = lookupStyleProbability(model.baseMatrix, state1, state2, baseRoman);

    // Validação do grafo da Função Harmônica (Base)
    const isAllowedByGraph = currentNode.allowedTransitions.includes(candidateBaseName);
    const isAllowedByMarkov = baseStyleProb > THRESHOLD_MODAL_INTERCHANGE;

    if (!isAllowedByGraph && !isAllowedByMarkov) continue;

    if (hasHighTensionLeap && (candidateBaseName.includes('7') || candidateBaseName.includes('dim'))) {
      baseStyleProb *= TENSION_BONUS;
    }

    // Se o acorde base já for complexo no grafo (ex: G7, Bdim), evitamos acoplar mais sufixos bizarros.
    const isTriad = !candidateBaseName.includes("7") && !candidateBaseName.includes("dim");
    const validExtensions = isTriad ? allExtensionsArray : ["none"];

    for (const ext of validExtensions) {
      const fullChordName = ext === "none" ? candidateBaseName : candidateBaseName + ext;
      const fullChordNotes = getChordPitchClasses(fullChordName);

      const suffixStyleProb = model.suffixMatrix[baseRoman]?.[ext] ?? (1.0 / allExtensionsArray.length);
      
      const combinedStyleProb = baseStyleProb * suffixStyleProb;

      const noteScore = computeNoteScore(
        fullChordName,
        fullChordNotes,
        playedNotes,
        windowStart,
        secondsPerBeat,
        isHighDensity,
        avgPitch,
        avgAmplitude
      );

      // Penaliza acordes com mais de 3 notas (tríades) para forçar clareza, a menos que a melodia exija a extensão
      const complexityPenalty = Math.max(0, fullChordNotes.length - 3) * 2.5;

      const finalScore = (noteScore * 1.0) + (combinedStyleProb * WEIGHT_MARKOV) - complexityPenalty;

      candidates.push({ chord: fullChordName, score: finalScore });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  
  let bestChord = currentChord;
  
  if (candidates.length > 0) {
    if (isReroll && candidates.length >= 2) {
      const poolSize = Math.min(3, candidates.length);
      // Ponderação Simples: 50% pro 1º, 30% pro 2º, 20% pro 3º
      const rand = Math.random();
      if (rand < 0.5) bestChord = candidates[0].chord;
      else if (rand < 0.8 && poolSize > 1) bestChord = candidates[1].chord;
      else bestChord = candidates[poolSize - 1].chord;
    } else {
      bestChord = candidates[0].chord;
    }
  }

  return { chord: bestChord, velocity: avgAmplitude };
}

// ─────────────────────────────────────────────────────────
//  9. Gerador de Progressão Completa
// ─────────────────────────────────────────────────────────

export function generateProgression(
  playedNotes: readonly DetectedNote[],
  bpm: number,
  _harmonicRhythmBeats: number,
  timeSignatureNumerator: number,
  timeSignatureDenominator: number,
  startChord: string = "C",
  model: TwoTierMarkovModel = markovModel,
  isReroll: boolean = false
): readonly { chord: string, velocity: number }[] {
  if (playedNotes.length === 0) return [{ chord: startChord, velocity: 0.7 }];

  const secondsPerBeat = (4 / timeSignatureDenominator) * (60 / bpm);
  const secondsPerMeasure = secondsPerBeat * timeSignatureNumerator;

  const totalStart = Math.min(...playedNotes.map(n => n.startTime));
  const totalEnd = Math.max(...playedNotes.map(n => n.endTime));
  const totalDuration = totalEnd - totalStart;

  const windowCount = Math.max(1, Math.ceil(totalDuration / secondsPerMeasure));

  const progression: { chord: string, velocity: number }[] = [];
  let history = [startChord];

  for (let w = 0; w < windowCount; w++) {
    const windowStart = totalStart + w * secondsPerMeasure;
    const windowEnd = windowStart + secondsPerMeasure;

    const windowNotes = playedNotes.filter(
      n => n.startTime < windowEnd && n.endTime > windowStart,
    );

    const clippedNotes: readonly DetectedNote[] = windowNotes.map(n => ({
      pitch: n.pitch,
      startTime: Math.max(n.startTime, windowStart),
      endTime: Math.min(n.endTime, windowEnd),
    }));

    const result = determineNextChord(
      history,
      clippedNotes,
      windowStart,
      secondsPerBeat,
      model,
      isReroll
    );
    progression.push(result);
    history.push(result.chord);
  }

  return progression;
}