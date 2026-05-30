import { memo } from "react";

interface DynamicRingProps {
  isActive: boolean;
  currentFrequency: number;
  currentNote?: string;
  onClick?: () => void;
  // Nova prop opcional recomendada para controlar a força/volume do trecho (0.0 a 1.0)
  // Caso não seja passada, usaremos a variação da frequência como fallback
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
  
  // Usa a prop de intensidade para a velocidade. Se não existir, tenta deduzir pela frequência.
  const activeIntensity = intensity !== undefined ? Math.min(Math.max(intensity, 0), 1) : normalizedFreq;
  
  const sizeClass = isActive 
    ? "w-48 h-48 sm:w-56 sm:h-56 mb-8" 
    : "w-32 h-32 sm:w-40 sm:h-40 mb-8";

  // Dinâmica de escala baseada na força do som
  const scale = hasFreq ? 1 + activeIntensity * 0.25 : 1;
  
  // Dinâmica de VELOCIDADE: Trechos fortes = mais rápido (menor duração), suaves = mais lento
  const rotationDuration = hasFreq 
    ? Math.max(1.2, 8 - (activeIntensity * 6.8)) 
    : (isActive ? 8 : 15);
  
  // O raio em que as luzes se distanciam do centro (aumenta com a intensidade)
  const radiusOffset = hasFreq ? 40 + activeIntensity * 20 : (isActive ? 32 : 24);
  
  // Dinâmica de CORES: Tons menores/graves (frequência baixa) = Frio (Azul/Ciano ~ 240deg)
  // Tons maiores/agudos (frequência alta) = Quente (Vermelho/Laranja/Rosa ~ 0deg a -40deg)
  const baseHue = 240 - (normalizedFreq * 260); // Vai de 240 (Azul) até -20 (Rosa/Vermelho)

  // Desfoque
  const blurAmount = hasFreq ? 24 + activeIntensity * 16 : (isActive ? 18 : 14);

  // Array de luzes com offsets de cor para criar o efeito de Aurora
  const lights = [
    { size: "w-20 h-20 sm:w-28 sm:h-28", delay: "0ms", hueOffset: 0 },
    { size: "w-24 h-24 sm:w-32 sm:h-32", delay: "200ms", hueOffset: 25 },
    { size: "w-16 h-16 sm:w-24 sm:h-24", delay: "400ms", hueOffset: -15 },
    { size: "w-28 h-28 sm:w-36 sm:h-36", delay: "600ms", hueOffset: 45 },
    { size: "w-20 h-20 sm:w-24 sm:h-24", delay: "800ms", hueOffset: -30 },
    { size: "w-24 h-24 sm:w-32 sm:h-32", delay: "1000ms", hueOffset: 15 },
    { size: "w-20 h-20 sm:w-28 sm:h-28", delay: "1200ms", hueOffset: -45 },
    { size: "w-16 h-16 sm:w-20 sm:h-20", delay: "1400ms", hueOffset: 30 },
  ];

  return (
    <div 
      className={`relative flex items-center justify-center mt-4 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${sizeClass} ${!isActive ? 'animate-pulse-subtle' : ''} ${onClick ? 'cursor-pointer hover:scale-105' : ''}`}
      onClick={onClick}
    >
      
      {/* Container giratório principal */}
      <div 
        className="absolute inset-0 flex items-center justify-center animate-spin transition-all duration-300 ease-out"
        style={{ 
          animationDuration: `${rotationDuration}s`,
          transform: `scale(${scale})`
        }}
      >
        {lights.map((light, index) => {
          const angle = (index * 360) / lights.length;
          // Calcula a cor final da luz somando o hue base com a variação individual
          const currentHue = baseHue + light.hueOffset;
          const dynamicColor = `hsl(${currentHue}, 90%, 60%)`;
          
          return (
            <div
              key={index}
              className={`absolute rounded-full transition-all duration-500 ease-out mix-blend-screen ${light.size}`}
              style={{
                backgroundColor: dynamicColor,
                filter: `blur(${blurAmount}px)`,
                opacity: hasFreq ? 0.85 + (activeIntensity * 0.15) : (isActive ? 0.6 : 0.3),
                transform: `rotate(${angle}deg) translateY(-${radiusOffset}px)`,
                animationDelay: light.delay,
              }}
            />
          );
        })}
      </div>

      {/* Rotação inversa suave no fundo */}
      <div 
        className="absolute inset-0 flex items-center justify-center animate-spin transition-all duration-300 ease-out opacity-50"
        style={{ 
          animationDuration: `${rotationDuration * 1.5}s`,
          animationDirection: 'reverse',
          transform: `scale(${scale * 0.8})`
        }}
      >
        {lights.slice(0, 4).map((light, index) => {
          const angle = (index * 360) / 4;
          const currentHue = baseHue + light.hueOffset;
          const dynamicColor = `hsl(${currentHue}, 90%, 55%)`;

          return (
            <div
              key={`inner-${index}`}
              className={`absolute rounded-full transition-all duration-500 ease-out mix-blend-screen ${light.size}`}
              style={{
                backgroundColor: dynamicColor,
                filter: `blur(${blurAmount * 1.2}px)`,
                transform: `rotate(${angle + 45}deg) translateY(-${radiusOffset * 0.7}px)`,
              }}
            />
          );
        })}
      </div>

      {/* Núcleo escuro (Buraco Negro) */}
      <div 
        className="absolute inset-6 sm:inset-8 rounded-full bg-black/80 blur-lg transition-all duration-500 z-10"
        style={{
          opacity: isActive ? 1 : 0.6,
          transform: `scale(${scale})`
        }}
      />
      
      {/* Nota atual sendo detectada */}
      {isActive && currentNote && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 transition-opacity duration-300">
          <span className="text-white/90 text-4xl sm:text-5xl font-light tracking-tighter drop-shadow-md">
            {currentNote.replace(/[0-9]/g, '')}
            <span className="text-xl sm:text-2xl text-white/50">{currentNote.match(/[0-9]/)?.[0]}</span>
          </span>
        </div>
      )}
    </div>
  );
});