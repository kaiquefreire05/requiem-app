import { TimeSignatureSelector, type TimeSignature } from "./TimeSignatureSelector";
import { BpmSelector } from "./BpmSelector";

interface RecordControlsProps {
  appState: string;
  isRecording: boolean;
  isProcessing: boolean;
  currentFrequency: number;
  currentNote: string;
  isButtonDisabled: boolean;
  handleMainButtonClick: () => void;
  stateLabels: Record<string, string>;
  preRecordTimeSignature: TimeSignature;
  setPreRecordTimeSignature: (val: TimeSignature) => void;
  preRecordBpm: number | "AUTO";
  setPreRecordBpm: (val: number | "AUTO") => void;
}

export function RecordControls({
  appState,
  isRecording,
  isProcessing,
  currentFrequency,
  currentNote,
  isButtonDisabled,
  handleMainButtonClick,
  preRecordTimeSignature,
  setPreRecordTimeSignature,
  preRecordBpm,
  setPreRecordBpm,
}: RecordControlsProps) {
  const isInputDisabled = isButtonDisabled && appState !== "RECORDING";

  return (
    <div className="w-full max-w-2xl px-4 flex flex-col items-center transition-all duration-500 mb-8 z-20">
      {/* Input Bar Container */}
      <div className="w-full max-w-xl flex flex-col gap-2">
        {/* Top small indicators */}
        <div className="flex justify-between items-center px-4 mb-2">
          <span className="text-[10px] text-white/40 flex items-center gap-1.5 font-mono uppercase tracking-wider">
            <svg className="w-3 h-3 text-white/30" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Requiem Engine Ativo
          </span>
          <span className="text-[10px] text-white/40 flex items-center gap-1.5 font-mono uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            Modelo Pronto
          </span>
        </div>

        {/* Main Input Bar */}
        <div 
          onClick={!isInputDisabled ? handleMainButtonClick : undefined}
          className={`
            relative group flex items-center w-full bg-[#161616]/80 backdrop-blur-xl border border-white/10
            rounded-2xl p-2 sm:p-2.5 transition-all duration-300
            ${!isInputDisabled ? 'cursor-pointer hover:bg-[#1a1a1a]/90 hover:border-white/20 hover:shadow-[0_4px_30px_rgba(255,255,255,0.05)]' : 'opacity-70 cursor-not-allowed'}
            ${isRecording ? 'border-red-500/30 shadow-[0_4px_30px_rgba(220,38,38,0.15)] bg-red-950/10' : ''}
          `}
        >
          {/* left selectors or recording indicator */}
          <div className="flex-shrink-0 flex items-center justify-center gap-2 mr-2 z-30">
            {isRecording ? (
               <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" /></div>
            ) : isProcessing ? (
               <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center"><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>
            ) : (
               <>
                 <TimeSignatureSelector 
                   value={preRecordTimeSignature}
                   onChange={setPreRecordTimeSignature}
                   disabled={isInputDisabled}
                 />
                 <BpmSelector 
                   value={preRecordBpm}
                   onChange={setPreRecordBpm}
                   disabled={isInputDisabled}
                 />
               </>
            )}
          </div>

          <div className="flex-1 flex items-center px-2">
            <span className={`text-sm sm:text-base font-light transition-colors ${isRecording ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`}>
              {isRecording 
                ? (currentNote ? `${currentNote} (${currentFrequency}Hz)` : 'Gravando sinal...') 
                : isProcessing 
                ? 'Processando Harmonia...' 
                : 'Iniciar captura de áudio...'}
            </span>
          </div>

          <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${isRecording ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white/80'}`}>
            {isRecording ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

