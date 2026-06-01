export interface TrackHeadersProps {
  rulerHeight: number;
}

export function TrackHeaders({ rulerHeight }: TrackHeadersProps) {
  return (
    <div className="w-[200px] flex flex-col shrink-0 bg-[#131313] z-20">
      <div style={{ height: `${rulerHeight}px` }} className="bg-[#1e1e1e]" />
      
      <div className="h-40 flex-none flex flex-col bg-[#181818]">
        <div className="flex items-center gap-2 px-4 py-3 opacity-90 hover:opacity-100 transition-opacity flex-1">
          <div className="w-1 h-full bg-white/80 rounded-full" />
          <div>
            <div className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Track 1</div>
            <div className="text-sm font-semibold tracking-wide text-white/90">LEAD MELODY</div>
          </div>
        </div>
      </div>

      <div className="h-40 flex-none flex flex-col bg-[#121212]">
        <div className="flex items-center gap-2 px-4 py-3 opacity-90 hover:opacity-100 transition-opacity flex-1">
          <div className="w-1 h-full bg-white/50 rounded-full" />
          <div>
            <div className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Track 2</div>
            <div className="text-sm font-semibold tracking-wide text-white/90">CHORDS</div>
          </div>
        </div>
      </div>
    </div>
  );
}
