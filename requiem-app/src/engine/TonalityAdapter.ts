// ─────────────────────────────────────────────────────────
//  TonalityAdapter.ts
// ─────────────────────────────────────────────────────────
//  Camada de tradução entre o "World Space" (qualquer
//  tonalidade) e o "Local Space" (Dó Maior / Lá Menor)
//  usado internamente pelo HarmonyEngine.
//
//  Responsabilidades:
//  1. Normalizar notas de entrada (microfone) → C Major
//  2. Transpor acordes de saída (C Major) → tonalidade alvo
//  3. Normalizar progressões do dataset para treinar Markov
//
//  • Puramente funcional — sem mutações, sem efeitos.
//  • Fortemente tipado — offsets, parsing e mapeamento.
// ─────────────────────────────────────────────────────────

import type { DetectedNote } from "../hooks/usePitchDetector";

// ─────────────────────────────────────────────────────────
//  1. Mapa de Offsets (Semitons a partir de Dó)
// ─────────────────────────────────────────────────────────
//  Cada tonalidade é mapeada ao número de semitons que a
//  separa de Dó (C = 0). Menores usam o offset da sua
//  relativa maior (Am = 0, Em = 7, Bm = 2, ...).
// ─────────────────────────────────────────────────────────

/** Offset em semitons de cada nota fundamental em relação a Dó. */
const ROOT_OFFSETS: Readonly<Record<string, number>> = {
  C: 0,   "C#": 1,  Db: 1,
  D: 2,   "D#": 3,  Eb: 3,
  E: 4,   Fb: 4,
  F: 5,   "F#": 6,  Gb: 6,
  G: 7,   "G#": 8,  Ab: 8,
  A: 9,   "A#": 10, Bb: 10,
  B: 11,  Cb: 11,
};

/**
 * Mapa completo de tonalidades para seus offsets.
 * Maiores usam o offset direto do root.
 * Menores usam o offset da sua relativa maior.
 *
 * Ex: Am → relativa de C → offset 0
 *     Em → relativa de G → offset 7
 *     F#m → relativa de A → offset 9
 */
export const TONALITY_OFFSETS: Readonly<Record<string, number>> = {
  // ── Maiores ───────────────────────────────────────────
  C: 0,    "C#": 1,   Db: 1,
  D: 2,    "D#": 3,   Eb: 3,
  E: 4,
  F: 5,    "F#": 6,   Gb: 6,
  G: 7,    "G#": 8,   Ab: 8,
  A: 9,    "A#": 10,  Bb: 10,
  B: 11,   Cb: 11,

  // ── Menores (offset = relativa maior) ─────────────────
  Am: 0,    "A#m": 1,  Bbm: 1,
  Bm: 2,   Cm: 3,
  "C#m": 4, Dm: 5,
  "D#m": 6, Ebm: 6,   Em: 7,
  Fm: 8,   "F#m": 9,
  Gm: 10,  "G#m": 11, Abm: 11,
};

// ─────────────────────────────────────────────────────────
//  2. Nomes de Notas e Parsing
// ─────────────────────────────────────────────────────────

/**
 * Nomes padrão das 12 notas (usando sustenidos).
 * Índice = pitch class (0 = C, 1 = C#, ..., 11 = B).
 */
const NOTE_NAMES_SHARP: readonly string[] = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
];

/**
 * Nomes alternativos usando bemóis (para tonalidades com bemóis).
 */
const NOTE_NAMES_FLAT: readonly string[] = [
  "C", "Db", "D", "Eb", "E", "F",
  "Gb", "G", "Ab", "A", "Bb", "B",
];

/**
 * Tonalidades que preferem notação com bemóis.
 * Se a tonalidade alvo estiver nesta lista, usamos NOTE_NAMES_FLAT.
 */
const FLAT_TONALITIES: ReadonlySet<string> = new Set([
  "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb",
  "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm",
]);

/**
 * Regex para separar a tônica (root) do sufixo (qualidade) de um acorde.
 *
 * Captura:
 * - Grupo 1: Root — uma letra A-G seguida opcionalmente de # ou b
 * - Grupo 2: Suffix — tudo que sobra (m, 7, dim, sus4, maj7, etc.)
 *
 * Exemplos:
 *   "C"     → ["C",  ""]
 *   "F#m"   → ["F#", "m"]
 *   "Bbdim" → ["Bb", "dim"]
 *   "Dm7"   → ["D",  "m7"]
 *   "G#7"   → ["G#", "7"]
 */
const CHORD_REGEX = /^([A-G][#b]?)(.*)$/;

/**
 * Faz o parsing de um nome de acorde em root + suffix.
 * Retorna null se o formato for inválido.
 */
const parseChord = (
  chordName: string,
): { root: string; suffix: string } | null => {
  const match = chordName.match(CHORD_REGEX);
  if (!match) return null;
  return { root: match[1], suffix: match[2] };
};

/**
 * Retorna o offset em semitons de uma tonalidade.
 * Fallback para 0 (Dó Maior) se desconhecida.
 */
export const getTonalityOffset = (tonality: string): number =>
  TONALITY_OFFSETS[tonality] ?? 0;

/**
 * Seleciona o array de nomes (sharps ou flats) mais
 * adequado para a tonalidade alvo.
 */
const noteNamesFor = (tonality: string): readonly string[] =>
  FLAT_TONALITIES.has(tonality) ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;

// ─────────────────────────────────────────────────────────
//  3. Transposição de Notas de Entrada (World → Local)
// ─────────────────────────────────────────────────────────

/**
 * Normaliza as notas detectadas pelo microfone, transpondo-as
 * do "World Space" (tonalidade do usuário) para o "Local Space"
 * (Dó Maior), onde o HarmonyEngine opera.
 *
 * Subtrai o offset da tonalidade escolhida do pitch MIDI de
 * cada nota. Isso faz com que uma melodia tocada em Ré Maior
 * soe, internamente, como se estivesse em Dó Maior.
 *
 * @param notes            — Notas detectadas no pitch original
 * @param targetTonality   — Tonalidade escolhida pelo usuário (ex: "D", "Am")
 * @returns                  Notas com pitch transposto para C Major
 */
export const normalizeNotes = (
  notes: readonly DetectedNote[],
  targetTonality: string,
): DetectedNote[] => {
  const offset = getTonalityOffset(targetTonality);

  // Se offset é 0 (Dó Maior / Lá Menor), nada a fazer
  if (offset === 0) return notes.map(n => ({ ...n }));

  return notes.map(n => ({
    pitch: n.pitch - offset,
    startTime: n.startTime,
    endTime: n.endTime,
  }));
};

// ─────────────────────────────────────────────────────────
//  4. Transposição de Acordes de Saída (Local → World)
// ─────────────────────────────────────────────────────────

/**
 * Transpõe um nome de acorde do "Local Space" (Dó Maior)
 * para o "World Space" (tonalidade alvo).
 *
 * 1. Separa a tônica (root) do sufixo (m, 7, dim, etc.)
 * 2. Converte a tônica para índice (0–11)
 * 3. Soma o offset da tonalidade alvo (mod 12)
 * 4. Converte de volta para nome de nota (sharps ou flats)
 * 5. Concatena com o sufixo original intacto
 *
 * @param chordName        — Nome do acorde em C Major (ex: "Dm7", "G7")
 * @param targetTonality   — Tonalidade alvo (ex: "D", "Bb", "F#m")
 * @returns                  Acorde transposto (ex: "Em7", "A7")
 *
 * @example
 * transposeChord("Dm7", "D")  → "Em7"   (offset 2: D→E)
 * transposeChord("G7",  "F")  → "C7"    (offset 5: G→C)
 * transposeChord("Am",  "G")  → "Em"    (offset 7: A→E)
 * transposeChord("C",   "C")  → "C"     (offset 0: noop)
 */
export const transposeChord = (
  chordName: string,
  targetTonality: string,
): string => {
  const parsed = parseChord(chordName);
  if (!parsed) return chordName;

  const offset = getTonalityOffset(targetTonality);
  if (offset === 0) return chordName;

  const rootIndex = ROOT_OFFSETS[parsed.root];
  if (rootIndex === undefined) return chordName;

  const newIndex = (rootIndex + offset) % 12;
  const noteNames = noteNamesFor(targetTonality);

  return noteNames[newIndex] + parsed.suffix;
};

/**
 * Transpõe uma progressão inteira de acordes do Local para o World Space.
 */
export const transposeProgression = (
  progression: readonly string[],
  targetTonality: string,
): readonly string[] =>
  progression.map(chord => transposeChord(chord, targetTonality));

// ─────────────────────────────────────────────────────────
//  5. Normalização de Dataset (World → Local)
// ─────────────────────────────────────────────────────────
//  Transpõe uma progressão da sua tonalidade original
//  para Dó Maior, para que a Cadeia de Markov aprenda
//  padrões universais (I-V-vi-IV) independente da key.
// ─────────────────────────────────────────────────────────

/**
 * Normaliza uma progressão de acordes da sua tonalidade
 * original para Dó Maior (Local Space).
 *
 * Usado na construção da Matriz de Markov para que todos
 * os datasets contribuam para os mesmos padrões harmônicos
 * relativos (I, IV, V, vi, etc.) independente da tonalidade
 * original da composição.
 *
 * @param progression        — Progressão na tonalidade original
 * @param originalTonality   — Tonalidade original (ex: "D", "Bb")
 * @returns                    Progressão transposta para C Major
 *
 * @example
 * normalizeProgressionToC(["D", "A", "Bm", "G"], "D")
 * → ["C", "G", "Am", "F"]
 */
export const normalizeProgressionToC = (
  progression: readonly string[],
  originalTonality: string,
): readonly string[] => {
  const offset = getTonalityOffset(originalTonality);
  if (offset === 0) return [...progression];

  // Subtrair o offset = transpor "para baixo" até Dó
  return progression.map(chordName => {
    const parsed = parseChord(chordName);
    if (!parsed) return chordName;

    const rootIndex = ROOT_OFFSETS[parsed.root];
    if (rootIndex === undefined) return chordName;

    const newIndex = ((rootIndex - offset) % 12 + 12) % 12;
    // Sempre usar sharps no Local Space (consistência interna)
    return NOTE_NAMES_SHARP[newIndex] + parsed.suffix;
  });
};

// ─────────────────────────────────────────────────────────
//  6. Catálogo de Tonalidades para a UI
// ─────────────────────────────────────────────────────────

/** Opção de tonalidade para renderização na UI. */
export interface TonalityOption {
  /** Valor programático (ex: "C", "F#m") */
  readonly value: string;
  /** Label amigável em português (ex: "Dó Maior (C)") */
  readonly label: string;
}

/** Todas as tonalidades maiores disponíveis. */
export const MAJOR_TONALITIES: readonly TonalityOption[] = [
  { value: "C",   label: "Dó Maior (C)" },
  { value: "C#",  label: "Dó# Maior (C#)" },
  { value: "Db",  label: "Réb Maior (Db)" },
  { value: "D",   label: "Ré Maior (D)" },
  { value: "Eb",  label: "Mib Maior (Eb)" },
  { value: "E",   label: "Mi Maior (E)" },
  { value: "F",   label: "Fá Maior (F)" },
  { value: "F#",  label: "Fá# Maior (F#)" },
  { value: "Gb",  label: "Solb Maior (Gb)" },
  { value: "G",   label: "Sol Maior (G)" },
  { value: "Ab",  label: "Láb Maior (Ab)" },
  { value: "A",   label: "Lá Maior (A)" },
  { value: "Bb",  label: "Sib Maior (Bb)" },
  { value: "B",   label: "Si Maior (B)" },
];

/** Todas as tonalidades menores disponíveis. */
export const MINOR_TONALITIES: readonly TonalityOption[] = [
  { value: "Am",   label: "Lá Menor (Am)" },
  { value: "A#m",  label: "Lá# Menor (A#m)" },
  { value: "Bbm",  label: "Sib Menor (Bbm)" },
  { value: "Bm",   label: "Si Menor (Bm)" },
  { value: "Cm",   label: "Dó Menor (Cm)" },
  { value: "C#m",  label: "Dó# Menor (C#m)" },
  { value: "Dm",   label: "Ré Menor (Dm)" },
  { value: "D#m",  label: "Ré# Menor (D#m)" },
  { value: "Ebm",  label: "Mib Menor (Ebm)" },
  { value: "Em",   label: "Mi Menor (Em)" },
  { value: "Fm",   label: "Fá Menor (Fm)" },
  { value: "F#m",  label: "Fá# Menor (F#m)" },
  { value: "Gm",   label: "Sol Menor (Gm)" },
  { value: "G#m",  label: "Sol# Menor (G#m)" },
  { value: "Abm",  label: "Láb Menor (Abm)" },
];

/** Todas as tonalidades combinadas (maiores + menores). */
export const ALL_TONALITIES: readonly TonalityOption[] = [
  ...MAJOR_TONALITIES,
  ...MINOR_TONALITIES,
];

// ─────────────────────────────────────────────────────────
//  7. Opções de Fórmula de Compasso para a UI
// ─────────────────────────────────────────────────────────

/** Valores permitidos para a Unidade de Tempo (denominador). */
export const UT_OPTIONS: readonly number[] = [2, 4, 8];

/** Valores permitidos para a Quantidade de Tempos (numerador). */
export const QT_OPTIONS: readonly number[] = [2, 3, 4, 6, 9, 12];
