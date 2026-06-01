import { Music, Box } from "lucide-react";

export interface FloatingBottomNavProps {
  studioView: 'session' | 'arrangement';
  setStudioView: (view: 'session' | 'arrangement') => void;
}

export function FloatingBottomNav({ studioView, setStudioView }: FloatingBottomNavProps) {
  const containerStyle = {
    borderRadius: '20px',
    border: '1px solid transparent',
    backgroundImage: 'linear-gradient(90deg, rgba(10, 10, 10, 0.45) 0%), linear-gradient(135deg, rgba(62, 62, 62, 0.43) 0%, transparent 40%)',
    backgroundOrigin: 'border-box',
    backgroundClip: 'padding-box, border-box',
    boxShadow: 'inset 0px 0px 5px -2px rgba(242,242,242,0.16)',
  };

  return (
    <div 
      className="fixed bottom-8 left-1/2 -translate-x-1/2 backdrop-blur-sm p-1.5 flex gap-1 z-50 items-center shadow-2xl transition-all duration-300"
      style={containerStyle}
    >
      <button
        onClick={() => setStudioView('session')}
        className={`flex items-center gap-2.5 px-6 py-2.5 rounded-[15px] text-[15px] font-medium transition-all duration-300 ${
          studioView === 'session' ? 'bg-[#202020] text-white shadow-md' : 'text-white/60 hover:text-white hover:bg-white/5'
        }`}
      >
        <Music size={18} strokeWidth={2} />
        Session
      </button>
      <button
        onClick={() => setStudioView('arrangement')}
        className={`flex items-center gap-2.5 px-6 py-2.5 rounded-[15px] text-[15px] font-medium transition-all duration-300 ${
          studioView === 'arrangement' ? 'bg-[#202020] text-white shadow-md' : 'text-white/60 hover:text-white hover:bg-white/5'
        }`}
      >
        <Box size={18} strokeWidth={2} />
        Structure
      </button>
    </div>
  );
}
