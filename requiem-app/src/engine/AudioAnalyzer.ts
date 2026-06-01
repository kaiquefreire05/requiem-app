import type { DetectedNote } from "../hooks/usePitchDetector";

// Perfis Krumhansl-Schmuckler simplificados (pesos para notas da escala)
// Valores típicos para cada uma das 12 pitch classes relativos à tônica
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const PITCH_CLASS_NAMES_MAJOR = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const PITCH_CLASS_NAMES_MINOR = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

/**
 * Deduz a tonalidade predominante (Key) de um conjunto de notas baseado na duração total de cada Pitch Class.
 */
export function detectKey(notes: DetectedNote[]): string {
  if (!notes || notes.length < 3) return "C"; // Fallback para poucas notas

  // 1. Somar durações por pitch class
  const durations = new Array(12).fill(0);
  for (const note of notes) {
    if (note.pitch < 0) continue;
    const duration = note.endTime - note.startTime;
    const pitchClass = note.pitch % 12;
    durations[pitchClass] += duration;
  }

  // Se for tudo silêncio (improvável, mas...)
  const totalDuration = durations.reduce((a, b) => a + b, 0);
  if (totalDuration === 0) return "C";

  // Normalizar durações
  const normalized = durations.map(d => d / totalDuration);

  // 2. Calcular correlação de Pearson para cada uma das 24 possíveis chaves (12 maiores, 12 menores)
  let bestKey = "C";
  let maxCorrelation = -Infinity;

  const calculateCorrelation = (input: number[], profile: number[]) => {
    const avgInput = input.reduce((a, b) => a + b, 0) / input.length;
    const avgProfile = profile.reduce((a, b) => a + b, 0) / profile.length;
    
    let num = 0;
    let den1 = 0;
    let den2 = 0;
    for (let i = 0; i < 12; i++) {
      const diff1 = input[i] - avgInput;
      const diff2 = profile[i] - avgProfile;
      num += diff1 * diff2;
      den1 += diff1 * diff1;
      den2 += diff2 * diff2;
    }
    return num / Math.sqrt(den1 * den2);
  };

  for (let shift = 0; shift < 12; shift++) {
    // Rotaciona o input para testar a tônica 'shift'
    const shiftedInput = [...normalized.slice(shift), ...normalized.slice(0, shift)];
    
    const corrMajor = calculateCorrelation(shiftedInput, MAJOR_PROFILE);
    if (corrMajor > maxCorrelation) {
      maxCorrelation = corrMajor;
      bestKey = PITCH_CLASS_NAMES_MAJOR[shift]; 
    }

    const corrMinor = calculateCorrelation(shiftedInput, MINOR_PROFILE);
    if (corrMinor > maxCorrelation) {
      maxCorrelation = corrMinor;
      bestKey = `${PITCH_CLASS_NAMES_MINOR[shift]}m`; 
    }
  }

  return bestKey;
}

/**
 * Estima o BPM baseado no tempo (delta) entre onsets de notas.
 */
export function estimateBPM(notes: DetectedNote[]): number {
  if (!notes || notes.length < 2) return 120; // Fallback

  // 1. Ordenar por startTime
  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);

  // 2. Extrair deltas
  const deltas: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i].startTime - sorted[i - 1].startTime;
    // Filtrar deltas muito curtos (ex: acordes tocados juntos, < 100ms) ou muito longos (> 2s)
    if (delta > 0.1 && delta < 2.0) {
      deltas.push(delta);
    }
  }

  if (deltas.length === 0) return 120;

  // 3. Média dos deltas válidos
  // Opcional: remover outliers para melhorar a precisão
  deltas.sort((a, b) => a - b);
  // Remover os 10% extremos se houver muitas notas
  let validDeltas = deltas;
  if (deltas.length > 5) {
    const trim = Math.floor(deltas.length * 0.1);
    validDeltas = deltas.slice(trim, deltas.length - trim);
  }

  const avgDelta = validDeltas.reduce((a, b) => a + b, 0) / validDeltas.length;

  // Assumindo que o delta médio representa uma semínima, BPM = 60 / delta
  let bpm = Math.round(60 / avgDelta);

  // 4. Limitar e ajustar oitavas de andamento
  // Se for muito rápido, divide por 2; se for muito lento, multiplica por 2
  while (bpm < 60) bpm *= 2;
  while (bpm > 180) bpm = Math.floor(bpm / 2);

  return Math.max(60, Math.min(180, bpm));
}
