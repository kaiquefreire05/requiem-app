import requiemLogo from "../assets/requiem-logo-full.svg";
import { PanelLeft } from "lucide-react";

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  recentMelodies: string[];
}

export function Sidebar({ isSidebarOpen, setIsSidebarOpen, recentMelodies }: SidebarProps) {
  return (
    <aside
      className={`flex flex-col bg-[#101010] transition-all duration-300 ease-in-out relative z-20 ${
        isSidebarOpen ? 'w-72' : 'w-[68px]'
      }`}
    >
      <div className="flex items-center h-16 px-3 pt-2">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2.5 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Alternar menu"
        >
          <PanelLeft className="w-5 h-5 text-white/80" strokeWidth={2} />
        </button>

        <div className={`ml-2 flex items-center overflow-hidden transition-opacity duration-300 ${
          isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
        }`}>
          <img src={requiemLogo} alt="Requiem Logo" className="h-7 w-auto drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
        </div>
      </div>

      <div className="px-3 mt-8">
        <button className={`flex items-center p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-all border border-white/5 ${
          isSidebarOpen ? 'w-full rounded-2xl' : 'w-11 justify-center'
        }`}>
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span className={`ml-3 text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
            isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'
          }`}>
            Nova Composição
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mt-8 px-3 scrollbar-hide">
        <h3 className={`text-[11px] font-semibold text-white/40 mb-3 ml-2 uppercase tracking-wider overflow-hidden transition-all duration-300 ${
          isSidebarOpen ? 'opacity-100' : 'opacity-0 h-0 mb-0'
        }`}>
          Recentes
        </h3>
        <ul className="space-y-1">
          {recentMelodies.map((melody, idx) => (
            <li key={idx}>
              <button className={`flex items-center w-full p-2.5 rounded-lg hover:bg-white/5 transition-colors ${
                isSidebarOpen ? 'justify-start' : 'justify-center'
              }`}>
                <svg className="w-4 h-4 text-white/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className={`ml-3 text-sm text-white/70 truncate transition-all duration-300 ${
                  isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'
                }`}>
                  {melody}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
