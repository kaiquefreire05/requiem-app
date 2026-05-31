import { memo } from "react";

interface DynamicRingProps {
  isActive: boolean;
  currentFrequency: number;
  currentNote?: string;
  onClick?: () => void;
  intensity?: number; 
}

export const DynamicRing = memo(function DynamicRing({
  isActive,
  currentFrequency,
  currentNote,
  onClick,
  intensity,
}: DynamicRingProps) {
  const hasFreq = currentFrequency > 0;
  
  // Normaliza a frequência (aprox. 100Hz a 1000Hz) de 0 a 1
  const normalizedFreq = Math.min(Math.max((currentFrequency - 100) / 900, 0), 1);
  
  // Usa a prop de intensidade para volume e velocidade
  const activeIntensity = intensity !== undefined ? Math.min(Math.max(intensity, 0), 1) : normalizedFreq;
  
  const sizeClass = isActive 
    ? "w-48 h-48 sm:w-64 sm:h-64 mb-8" 
    : "w-32 h-32 sm:w-48 sm:h-48 mb-8";

  // Expansão mais orgânica e elástica baseada no volume
  const scale = hasFreq ? 1 + activeIntensity * 0.35 : 1;
  
  // Velocidade da rotação principal
  const rotationDuration = hasFreq 
    ? Math.max(3, 14 - (activeIntensity * 10)) 
    : (isActive ? 18 : 25);
  
  // Abertura do anel altamente responsiva à intensidade do som
  const radiusOffset = hasFreq ? 35 + activeIntensity * 50 : (isActive ? 28 : 18);
  
  // Hue dinâmico: Graves (Frio) -> Agudos (Quente)
  const baseHue = 240 - (normalizedFreq * 260);

  // Desfoque dramático controlado pela força do som (intensity)
  const blurAmount = hasFreq ? 12 + activeIntensity * 45 : (isActive ? 24 : 12);

  // Array de luzes com offsets assimétricos (orbitMorph) para quebrar o círculo perfeito
  const lights = [
    { size: "w-24 h-24 sm:w-32 sm:h-32", hueOffset: 0, orbitMorph: 1.15, blob: "40% 60% 70% 30% / 40% 50% 60% 50%" },
    { size: "w-32 h-32 sm:w-40 sm:h-40", hueOffset: 25, orbitMorph: 0.85, blob: "60% 40% 30% 70% / 50% 60% 40% 50%" },
    { size: "w-20 h-20 sm:w-28 sm:h-28", hueOffset: -15, orbitMorph: 1.25, blob: "30% 70% 70% 30% / 30% 30% 70% 70%" },
    { size: "w-36 h-36 sm:w-48 sm:h-48", hueOffset: 45, orbitMorph: 0.9, blob: "70% 30% 50% 50% / 30% 70% 50% 50%" },
    { size: "w-24 h-24 sm:w-32 sm:h-32", hueOffset: -30, orbitMorph: 1.1, blob: "50% 50% 30% 70% / 70% 30% 50% 50%" },
    { size: "w-28 h-28 sm:w-36 sm:h-36", hueOffset: 15, orbitMorph: 0.95, blob: "40% 60% 60% 40% / 60% 40% 60% 40%" },
    { size: "w-24 h-24 sm:w-32 sm:h-32", hueOffset: -45, orbitMorph: 1.2, blob: "60% 40% 50% 50% / 40% 60% 40% 60%" },
    { size: "w-20 h-20 sm:w-28 sm:h-28", hueOffset: 30, orbitMorph: 0.8, blob: "30% 70% 40% 60% / 50% 50% 60% 40%" },
  ];

  return (
    <div 
      className={`relative flex items-center justify-center mt-4 transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${sizeClass} ${!isActive ? 'animate-pulse-subtle' : ''} ${onClick ? 'cursor-pointer hover:scale-105' : ''}`}
      onClick={onClick}
    >
      
      {/* Brilho de fundo pulsante unificado */}
      <div 
        className="absolute inset-0 rounded-full transition-all duration-700 ease-out mix-blend-screen pointer-events-none"
        style={{
          backgroundColor: hasFreq ? `hsla(${baseHue}, 80%, 60%, ${0.15 + activeIntensity * 0.25})` : 'transparent',
          filter: `blur(${blurAmount * 1.8}px)`,
          transform: `scale(${scale * 1.3})`,
        }}
      />

      {/* Camada orbital externa (Dança lenta e elíptica) */}
      <div 
        className="absolute inset-0 flex items-center justify-center animate-spin transition-all duration-500 ease-out"
        style={{ 
          animationDuration: `${rotationDuration}s`,
          transform: `scale(${scale})`
        }}
      >
        {lights.map((light, index) => {
          const angle = (index * 360) / lights.length;
          const currentHue = baseHue + light.hueOffset;
          const dynamicColor = `hsl(${currentHue}, 85%, 65%)`;
          
          return (
            <div
              key={`outer-${index}`}
              className={`absolute transition-all duration-700 ease-out mix-blend-screen ${light.size}`}
              style={{
                backgroundColor: dynamicColor,
                filter: `blur(${blurAmount}px)`,
                opacity: hasFreq ? 0.65 + (activeIntensity * 0.35) : (isActive ? 0.4 : 0.15),
                borderRadius: light.blob,
                // A combinação de rotate(angle) com rotate(-angle/2) cria um movimento circular que torce a forma geométrica
                transform: `rotate(${angle}deg) translateY(-${radiusOffset * light.orbitMorph}px) rotate(-${angle / 2}deg) scale(${1 + activeIntensity * 0.25})`,
              }}
            />
          );
        })}
      </div>

      {/* Camada orbital interna reversa (Cria o aspecto hipnotizante) */}
      <div 
        className="absolute inset-0 flex items-center justify-center animate-spin transition-all duration-700 ease-out opacity-70"
        style={{ 
          animationDuration: `${rotationDuration * 1.6}s`,
          animationDirection: 'reverse',
          transform: `scale(${scale * 0.75})`
        }}
      >
        {lights.slice(0, 5).map((light, index) => {
          const angle = (index * 360) / 5;
          const currentHue = baseHue + light.hueOffset * 1.5;
          const dynamicColor = `hsl(${currentHue}, 90%, 55%)`;

          return (
            <div
              key={`inner-${index}`}
              className={`absolute transition-all duration-700 ease-out mix-blend-screen ${light.size}`}
              style={{
                backgroundColor: dynamicColor,
                filter: `blur(${blurAmount * 1.3}px)`,
                opacity: hasFreq ? 0.5 + (activeIntensity * 0.4) : (isActive ? 0.3 : 0.1),
                borderRadius: light.blob,
                transform: `rotate(${angle + 45}deg) translateY(-${radiusOffset * 0.5 * light.orbitMorph}px) rotate(${angle}deg) scale(${1 + activeIntensity * 0.3})`,
              }}
            />
          );
        })}
      </div>

      {/* Núcleo de absorção (Traz profundidade ao centro) */}
      <div 
        className="absolute inset-8 sm:inset-12 rounded-full bg-black transition-all duration-700 z-10"
        style={{
          opacity: isActive ? 0.95 : 0.8,
          transform: `scale(${scale * 0.85})`,
          // Sombra interna que reage à intensidade
          boxShadow: hasFreq ? `0 0 ${30 + activeIntensity * 50}px ${10 + activeIntensity * 30}px rgba(0,0,0,0.9) inset` : 'none',
          filter: `blur(${6 + activeIntensity * 10}px)`
        }}
      />
      
      {/* Tipografia refinada da nota */}
      {isActive && currentNote && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 transition-opacity duration-300">
          <span 
            className="text-white/95 text-4xl sm:text-6xl font-light tracking-tighter drop-shadow-2xl transition-all duration-200"
            style={{ 
              textShadow: hasFreq ? `0 0 ${15 + activeIntensity * 25}px hsla(${baseHue}, 90%, 70%, 0.9)` : '0 2px 10px rgba(0,0,0,0.5)',
              transform: `scale(${1 + activeIntensity * 0.08})`
            }}
          >
            {currentNote.replace(/[0-9]/g, '')}
            <span className="text-xl sm:text-3xl text-white/60 ml-1 font-medium">{currentNote.match(/[0-9]/)?.[0]}</span>
          </span>
        </div>
      )}
    </div>
  );
});