
import type { INoteSequence } from "@magenta/music";

interface PianoRollProps {
  notes: INoteSequence["notes"];
  laneColorClass: string; // e.g. "bg-violet-500"
  pxPerSecond: number;
}

export function PianoRoll({ notes, laneColorClass, pxPerSecond }: PianoRollProps) {
  if (!notes || notes.length === 0) return null;

  // Determine pitch range
  let pitchMin = 127;
  let pitchMax = 0;
  notes.forEach((n) => {
    if (n.pitch != null) {
      if (n.pitch < pitchMin) pitchMin = n.pitch;
      if (n.pitch > pitchMax) pitchMax = n.pitch;
    }
  });

  pitchMin = Math.max(0, pitchMin - 2);
  pitchMax = Math.min(127, pitchMax + 2);
  const pitchRange = pitchMax - pitchMin + 1;
  const rowPercent = 100 / pitchRange;

  return (
    <div className={`relative w-full h-full ${laneColorClass} overflow-hidden rounded-md group/piano`}>
      {/* ── Notes ── */}
      {notes.map((note, i) => {
        if (note.startTime == null || note.endTime == null || note.pitch == null) return null;

        const left = note.startTime * pxPerSecond;
        const width = Math.max((note.endTime - note.startTime) * pxPerSecond, 2);
        const top = (pitchMax - note.pitch) * rowPercent;

        return (
          <div
            key={i}
            className="absolute bg-black rounded-sm transition-colors group-hover/piano:bg-black/80"
            style={{
              left: `${left}px`,
              top: `${top + rowPercent * 0.2}%`,
              width: `${width}px`,
              height: `${rowPercent * 0.6}%`,
            }}
          />
        );
      })}
    </div>
  );
}
