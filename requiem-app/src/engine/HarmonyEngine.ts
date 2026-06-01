// ─────────────────────────────────────────────────────────
//  HarmonyEngine.ts
// ─────────────────────────────────────────────────────────
//  Sistema Híbrido de Progressão Harmônica
//
//  Combina dois modelos complementares:
//  1. Grafo Direcionado (HARMONY_GRAPH)
//     → Define o que é PERMITIDO (regras da teoria musical)
//  2. Cadeia de Markov (TransitionMatrix)
//     → Define o que é PROVÁVEL (expressão estilística)
//
//  A regra de ouro:
//  O Grafo filtra os candidatos. A Markov os prioriza.
//
//  • Puramente funcional — sem mutações, sem efeitos.
//  • Fortemente tipado — cada nó, aresta e peso explícitos.
//  • Data-Driven — datasets JSON carregados automaticamente
//    pelo Vite em tempo de compilação.
// ─────────────────────────────────────────────────────────

import type { DetectedNote } from "../hooks/usePitchDetector";
import { chordToRoman } from "./TonalityAdapter";

// ─────────────────────────────────────────────────────────
//  1. Tipos e Interfaces
// ─────────────────────────────────────────────────────────

/** Nó do grafo harmônico — representa um acorde e suas transições válidas. */
export interface ChordNode {
  /** Pitch classes constituintes do acorde (0 = C, 1 = C#, ..., 11 = B).
   *  O primeiro elemento é sempre a nota tônica/fundamental. */
  readonly notes: readonly number[];
  /** Nomes dos acordes vizinhos válidos no grafo (inclui o próprio acorde). */
  readonly allowedTransitions: readonly string[];
}

/** Formato de cada arquivo JSON de progressão no dataset. */
export interface ProgressionData {
  readonly title: string;
  readonly originalTonality: string;
  readonly normalizedProgression: readonly string[];
}

/**
 * Matriz de transição de Markov.
 * Mapeia cada acorde de origem a um registro de destinos com probabilidades.
 * Ex: { "C": { "G": 0.35, "Am": 0.25, "F": 0.40 } }
 */
export type TransitionMatrix = Readonly<Record<string, Readonly<Record<string, number>>>>;

// ─────────────────────────────────────────────────────────
//  2. Grafo Harmônico (Knowledge Base)
// ─────────────────────────────────────────────────────────
//  Modela o Ciclo de Quintas e relações harmônicas
//  primárias/secundárias. Cada nó mapeia um acorde para
//  seus pitch classes e transições permitidas (edges).
//
//  Pitch Class Reference:
//  C=0  C#=1  D=2  D#=3  E=4  F=5
//  F#=6 G=7   G#=8 A=9   A#=10 B=11
// ─────────────────────────────────────────────────────────

export const HARMONY_GRAPH: Readonly<Record<string, ChordNode>> = {

  // ── Acordes Maiores (Ciclo de Quintas) ────────────────

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

  // ── Acordes Menores (Relativos e Paralelos) ───────────

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

  // ── Acordes Dominantes (V7 — tensão → resolução) ──────

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

  // ── Acordes Diminutos (vii° — passagem e tensão) ──────

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
//  3. Carregamento Dinâmico do Dataset (Vite)
// ─────────────────────────────────────────────────────────
//  O Vite importa TODOS os JSONs da pasta music_data/
//  em tempo de compilação. Adicionar um novo arquivo
//  à pasta automaticamente o incorpora na Cadeia de Markov
//  sem alterar nenhuma linha de código.
// ─────────────────────────────────────────────────────────

/** Glob eager — Vite resolve em build time, zero custo em runtime. */
const dataModules = import.meta.glob<ProgressionData>(
  "../assets/music_data/*.json",
  { eager: true, import: "default" },
);

/**
 * Extrai todas as progressões dos módulos carregados pelo Vite,
 * normalizando cada uma para Dó Maior usando sua `originalTonality`.
 * Em seguida, realiza Data Augmentation transpondo a progressão base
 * para todas as 14 tonalidades maiores, ensinando a Cadeia de Markov
 * a reconhecer padrões em qualquer tom (ex: G#m).
 */
const extractDataset = (
  modules: Record<string, ProgressionData>,
): readonly (readonly string[])[] => {
  const baseProgressions = Object.values(modules)
    .filter((mod): mod is ProgressionData =>
      Array.isArray(mod?.normalizedProgression) &&
      typeof mod?.originalTonality === "string",
    )
    .map(mod =>
      mod.normalizedProgression.map(chord => chordToRoman(chord, mod.originalTonality))
    );

  return baseProgressions;
};

// ─────────────────────────────────────────────────────────
//  4. Cadeia de Markov (Modelo de Aprendizado)
// ─────────────────────────────────────────────────────────
//  Conta as transições acorde→acorde em todo o dataset
//  e converte as contagens em probabilidades [0.0, 1.0].
//
//  Se "C" apareceu 10 vezes como origem e 4 dessas
//  transições foram para "Am", então P(C→Am) = 0.4.
// ─────────────────────────────────────────────────────────

/**
 * Constrói a Matriz de Transição de Markov a partir de um
 * dataset de progressões harmônicas.
 *
 * @param dataset — Array bidimensional de progressões (string[][])
 * @returns         TransitionMatrix com probabilidades normalizadas
 *
 * Complexidade: O(D × P) onde D = nº de progressões, P = média de acordes por progressão.
 */
export const buildMarkovMatrix = (
  dataset: readonly (readonly string[])[],
): TransitionMatrix => {
  // ── Fase 1: Contagem bruta de transições ──────────────
  const counts: Record<string, Record<string, number>> = {};
  
  // Coletar todos os graus possíveis conhecidos no sistema a partir do HARMONY_GRAPH
  const allDegrees = new Set<string>();
  Object.keys(HARMONY_GRAPH).forEach(chord => {
    allDegrees.add(chordToRoman(chord, "C"));
  });

  for (const progression of dataset) {
    for (let i = 0; i < progression.length - 1; i++) {
      const from1 = progression[i];
      const to = progression[i + 1];

      // 1ª Ordem
      if (!counts[from1]) counts[from1] = {};
      counts[from1][to] = (counts[from1][to] ?? 0) + 1;

      // 2ª Ordem
      if (i >= 1) {
        const from2 = progression[i - 1];
        const state2 = `${from2},${from1}`;
        if (!counts[state2]) counts[state2] = {};
        counts[state2][to] = (counts[state2][to] ?? 0) + 1;
      }
    }
  }

  // ── Fase 2: Laplace Smoothing e Normalização ──────────
  const ALPHA = 0.1;
  const matrix: Record<string, Record<string, number>> = {};
  const degreesArray = Array.from(allDegrees);

  for (const [state, destinations] of Object.entries(counts)) {
    matrix[state] = {};
    let totalOutgoing = 0;
    
    // Adiciona ALPHA a todos os graus possíveis
    for (const degree of degreesArray) {
      const count = (destinations[degree] ?? 0) + ALPHA;
      matrix[state][degree] = count;
      totalOutgoing += count;
    }

    // Normaliza para que a soma seja rigorosamente 1.0
    for (const degree of degreesArray) {
      matrix[state][degree] /= totalOutgoing;
    }
  }

  return matrix;
};

// ─────────────────────────────────────────────────────────
//  5. Instância Pré-calculada (Singleton em módulo)
// ─────────────────────────────────────────────────────────
//  Computada uma única vez no carregamento do módulo.
//  O Vite faz tree-shaking — se ninguém importar,
//  o dataset nem é incluído no bundle.
// ─────────────────────────────────────────────────────────

/** Dataset extraído dos JSONs carregados pelo Vite. */
const dataset: readonly (readonly string[])[] = extractDataset(dataModules);

/** Matriz de Markov pré-calculada — pronta para uso imediato. */
export const transitionMatrix: TransitionMatrix = buildMarkovMatrix(dataset);

// ─────────────────────────────────────────────────────────
//  6. Constantes de Pesos (Heurística Híbrida)
// ─────────────────────────────────────────────────────────

/** Peso multiplicador quando a nota pertence ao acorde candidato. */
const WEIGHT_IN_CHORD = 2.0;

/** Bônus multiplicador adicional quando a nota é a tônica (fundamental). */
const WEIGHT_ROOT_BONUS = 1.5;

/** Penalidade multiplicador quando a nota NÃO pertence ao acorde. */
const WEIGHT_OUT_PENALTY = 0.5;

// -- NOVOS PESOS DE CALIBRAÇÃO (Analisador de Contorno e Textura) --
const WEIGHT_STRONG_BEAT = 3.0;
const WEIGHT_WEAK_BEAT = 0.5;
const BEAT_MARGIN_SEC = 0.15;

const REGISTER_LOW_THRESHOLD = 48; // C3
const REGISTER_HIGH_THRESHOLD = 72; // C5
const REGISTER_PENALTY = 0.2;
const REGISTER_BONUS = 1.5;

const DENSITY_THRESHOLD = 8;
const ORNAMENT_PENALTY_MULTIPLIER = 0.2; // Diminui WEIGHT_OUT_PENALTY

const LEAP_THRESHOLD = 7;
const TENSION_BONUS = 1.5;
// ------------------------------------------------------------------

/**
 * Peso multiplicador da probabilidade Markov no score final.
 *
 * Equilibra a influência do aprendizado estilístico (dataset)
 * com a análise das notas detectadas pelo microfone.
 *
 * Valor calibrado: 15.0 garante que uma probabilidade de 0.4
 * (40% de chance no dataset) contribua +6.0 pontos ao score,
 * comparável a ~3 segundos de nota sustentada dentro do acorde.
 */
const WEIGHT_MARKOV = 15.0;

/** Limiar de probabilidade Markov para permitir empréstimo modal fora do Grafo */
const THRESHOLD_MODAL_INTERCHANGE = 0.15;

// ─────────────────────────────────────────────────────────
//  7. Funções Utilitárias (puras)
// ─────────────────────────────────────────────────────────

/** Converte um MIDI pitch absoluto para Pitch Class (0–11). */
const toPitchClass = (pitch: number): number => ((pitch % 12) + 12) % 12;

/** Calcula a duração de uma nota em segundos. */
const noteDuration = (note: DetectedNote): number =>
  Math.max(0, note.endTime - note.startTime);

/**
 * Pontua um único acorde candidato APENAS com base nas notas tocadas.
 * Incorpora análise de textura e métrica.
 */
const computeNoteScore = (
  candidateName: string,
  candidateNotes: readonly number[],
  playedNotes: readonly DetectedNote[],
  windowStart: number,
  secondsPerBeat: number,
  isHighDensity: boolean,
  avgPitch: number,
): number => {
  // Sensor 2: Registro (Grave vs. Agudo)
  const isComplex = candidateNotes.length > 3 || candidateName.includes('dim') || candidateName.includes('7');
  
  let registerMultiplier = 1.0;
  if (avgPitch > 0) {
    if (avgPitch < REGISTER_LOW_THRESHOLD && isComplex) {
      registerMultiplier = REGISTER_PENALTY; // Lama acústica
    } else if (avgPitch > REGISTER_HIGH_THRESHOLD && isComplex) {
      registerMultiplier = REGISTER_BONUS;   // Registro agudo
    }
  }

  // Sensor 3: Densidade Rítmica
  const currentOutPenalty = isHighDensity 
    ? WEIGHT_OUT_PENALTY * ORNAMENT_PENALTY_MULTIPLIER 
    : WEIGHT_OUT_PENALTY;

  const rawScore = playedNotes.reduce((score, note) => {
    const pc = toPitchClass(note.pitch);
    const duration = noteDuration(note);
    const isInChord = candidateNotes.includes(pc);
    const isRoot = pc === candidateNotes[0];

    // Sensor 1: Posição Métrica (O Peso do Tempo Forte)
    const offsetFromStart = note.startTime - windowStart;
    const closestBeatOffset = Math.round(offsetFromStart / secondsPerBeat) * secondsPerBeat;
    const isStrongBeat = Math.abs(offsetFromStart - closestBeatOffset) <= BEAT_MARGIN_SEC;
    
    const beatMultiplier = isStrongBeat ? WEIGHT_STRONG_BEAT : WEIGHT_WEAK_BEAT;

    if (!isInChord) return score - (duration * currentOutPenalty * beatMultiplier);

    const base = score + (duration * WEIGHT_IN_CHORD * beatMultiplier);
    return isRoot ? base + (duration * WEIGHT_ROOT_BONUS * beatMultiplier) : base;
  }, 0);

  return rawScore * registerMultiplier;
};

/**
 * Busca a probabilidade estilística de uma transição na Matriz de Markov.
 * Tenta usar o histórico de 2ª ordem primeiro, com fallback para 1ª ordem.
 */
const lookupStyleProbability = (
  matrix: TransitionMatrix,
  state1: string,
  state2: string | null,
  targetRoman: string,
): number => {
  if (state2 && matrix[state2]?.[targetRoman] !== undefined) {
    return matrix[state2][targetRoman];
  }
  if (matrix[state1]?.[targetRoman] !== undefined) {
    return matrix[state1][targetRoman];
  }
  return 0; // Laplace garante que será > 0 se o estado existir. 0 apenas se o estado nunca foi visto.
};

// ─────────────────────────────────────────────────────────
//  8. Algoritmo Principal — determineNextChord (Híbrido)
// ─────────────────────────────────────────────────────────

/**
 * Determina o próximo acorde da progressão usando o modelo
 * Híbrido: Grafo Direcionado + Cadeia de Markov.
 *
 * Fórmula:
 *   finalScore = (noteScore × 1.0) + (styleProb × WEIGHT_MARKOV)
 *
 * Onde:
 * - noteScore: pontuação baseada nas notas detectadas pelo microfone
 * - styleProb: probabilidade estilística da Cadeia de Markov
 *
 * O Grafo define os candidatos (o que é PERMITIDO).
 * A Markov prioriza os candidatos (o que é PROVÁVEL).
 * As notas do microfone validam em tempo real (o que é COERENTE).
 *
 * @param currentChord      — Nome do acorde atual (ex: "C", "G7", "Am")
 * @param playedNotes       — Array de notas detectadas no trecho gravado
 * @param markovMatrix      — Matriz de transição pré-calculada
 * @returns                   Nome do acorde candidato com maior score final
 *
 * Complexidade: O(T × N) onde T = transições e N = notas detectadas.
 */
export function determineNextChord(
  chordHistory: readonly string[],
  playedNotes: readonly DetectedNote[],
  windowStart: number,
  secondsPerBeat: number,
  markovMatrix: TransitionMatrix = transitionMatrix,
): string {
  const currentChord = chordHistory.length > 0 ? chordHistory[chordHistory.length - 1] : "C";

  if (playedNotes.length === 0) return currentChord;

  const currentNode = HARMONY_GRAPH[currentChord];
  if (!currentNode) return currentChord;

  // Calcular os estados Markov a partir do histórico (em graus relativos)
  const romanHistory = chordHistory.map(c => chordToRoman(c, "C"));
  const currRoman = romanHistory.length > 0 ? romanHistory[romanHistory.length - 1] : "I";
  const prevRoman = romanHistory.length > 1 ? romanHistory[romanHistory.length - 2] : null;

  const state1 = currRoman;
  const state2 = prevRoman ? `${prevRoman},${currRoman}` : null;

  const density = playedNotes.length;
  const isHighDensity = density > DENSITY_THRESHOLD;

  let sumPitch = 0;
  let hasHighTensionLeap = false;

  for (let i = 0; i < density; i++) {
    sumPitch += playedNotes[i].pitch;
    if (i > 0) {
      const leap = Math.abs(playedNotes[i].pitch - playedNotes[i - 1].pitch);
      if (leap >= LEAP_THRESHOLD) {
        hasHighTensionLeap = true;
      }
    }
  }
  const avgPitch = density > 0 ? sumPitch / density : 0;

  // ── Candidatos: Avaliar TODOS os acordes do grafo para resolver Empréstimo Modal ──
  const allCandidates = Object.keys(HARMONY_GRAPH);

  const { bestChord } = allCandidates.reduce<{
    bestChord: string;
    bestScore: number;
  }>(
    (acc, candidateName) => {
      const candidateNode = HARMONY_GRAPH[candidateName];
      if (!candidateNode) return acc;

      const candidateRoman = chordToRoman(candidateName, "C");
      let styleProb = lookupStyleProbability(markovMatrix, state1, state2, candidateRoman);

      // Validação de Transição (Grafo vs Dataset)
      const isAllowedByGraph = currentNode.allowedTransitions.includes(candidateName);
      const isAllowedByMarkov = styleProb > THRESHOLD_MODAL_INTERCHANGE;

      if (!isAllowedByGraph && !isAllowedByMarkov) return acc;

      const noteScore = computeNoteScore(
        candidateName,
        candidateNode.notes,
        playedNotes,
        windowStart,
        secondsPerBeat,
        isHighDensity,
        avgPitch
      );

      // Sensor 4: Saltos Intervalares (Leaps)
      if (hasHighTensionLeap && (candidateName.includes('7') || candidateName.includes('dim'))) {
        styleProb *= TENSION_BONUS;
      }

      const finalScore = (noteScore * 1.0) + (styleProb * WEIGHT_MARKOV);

      return finalScore > acc.bestScore
        ? { bestChord: candidateName, bestScore: finalScore }
        : acc;
    },
    { bestChord: currentChord, bestScore: -Infinity },
  );

  return bestChord;
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
  markovMatrix_: TransitionMatrix = transitionMatrix,
): readonly string[] {
  if (playedNotes.length === 0) return [startChord];

  // ── MUDANÇA: Matemática do Tempo ────────────────────────
  // O BPM na música digital refere-se a semínimas (denominador 4).
  // A duração de 1 "Beat" real do compasso atual depende do denominador.
  const secondsPerBeat = (4 / timeSignatureDenominator) * (60 / bpm);
  
  // Duração total de 1 compasso inteiro
  const secondsPerMeasure = secondsPerBeat * timeSignatureNumerator;

  // ── Determinar o range temporal total ─────────────────
  const totalStart = Math.min(...playedNotes.map(n => n.startTime));
  const totalEnd = Math.max(...playedNotes.map(n => n.endTime));
  const totalDuration = totalEnd - totalStart;

  // ── Número de janelas (mínimo 1) baseadas em compasso ─
  const windowCount = Math.max(1, Math.ceil(totalDuration / secondsPerMeasure));

  // ── Segmentar notas por janela e avaliar cada um ────
  const progression: string[] = [];
  let history = [startChord];

  for (let w = 0; w < windowCount; w++) {
    const windowStart = totalStart + w * secondsPerMeasure;
    const windowEnd = windowStart + secondsPerMeasure;

    // Notas que interseccionam esta janela temporal
    const windowNotes = playedNotes.filter(
      n => n.startTime < windowEnd && n.endTime > windowStart,
    );

    // Clipar durações ao limite da janela para pontuação justa
    const clippedNotes: readonly DetectedNote[] = windowNotes.map(n => ({
      pitch: n.pitch,
      startTime: Math.max(n.startTime, windowStart),
      endTime: Math.min(n.endTime, windowEnd),
    }));

    const nextChord = determineNextChord(
      history,
      clippedNotes,
      windowStart,
      secondsPerBeat,
      markovMatrix_
    );
    progression.push(nextChord);
    history.push(nextChord);
  }

  return progression;
}

