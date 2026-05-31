import { Mic, LayoutGrid } from "lucide-react";

export type AppTab = "vibe" | "studio";

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-zinc-900/90 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">

        {/* Vibe tab */}
        <button
          onClick={() => onTabChange("vibe")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
            activeTab === "vibe"
              ? "bg-white text-black shadow-md"
              : "text-white/50 hover:text-white/80 hover:bg-white/5"
          }`}
        >
          <Mic size={16} />
          <span>Vibe</span>
        </button>

        {/* Studio tab */}
        <button
          onClick={() => onTabChange("studio")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
            activeTab === "studio"
              ? "bg-white text-black shadow-md"
              : "text-white/50 hover:text-white/80 hover:bg-white/5"
          }`}
        >
          <LayoutGrid size={16} />
          <span>Studio</span>
        </button>

      </div>
    </div>
  );
}
