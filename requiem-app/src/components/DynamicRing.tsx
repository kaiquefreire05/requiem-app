import { memo } from "react";

interface DynamicRingProps {
  isActive: boolean;
  currentFrequency: number;
}

export const DynamicRing = memo(function DynamicRing({
  isActive,
  currentFrequency,
}: DynamicRingProps) {
  // Normaliza a frequência (aprox 100Hz - 1000Hz) para escala 0-1
  const normalizedFreq = Math.min(Math.max((currentFrequency - 100) / 900, 0), 1);
  
  // Dinâmica de borda, aura (blur) e pulsação da escala
  const borderWidth = isActive && currentFrequency > 0 ? 3 + normalizedFreq * 24 : 2;
  const blurAmount = isActive && currentFrequency > 0 ? 15 + normalizedFreq * 35 : 8;
  const scale = isActive && currentFrequency > 0 ? 1 + normalizedFreq * 0.3 : 0.95;
  
  // Velocidade de rotação: o anel gira mais freneticamente em momentos de pico
  const rotationDuration = isActive && currentFrequency > 0 ? Math.max(0.3, 3 - normalizedFreq * 2.5) : 8;

  // Lógica de Cores HSL para transição 100% fluida:
  // Tons baixos (graves) = Frio (Azul/Roxo, Hue ~240)
  // Tons altos (agudos) = Quente (Vermelho/Laranja, Hue ~0)
  const baseHue = isActive && currentFrequency > 0 ? 240 - (normalizedFreq * 240) : 220;
  const secondaryHue = isActive && currentFrequency > 0 ? 280 - (normalizedFreq * 220) : 260;
  
  const dynamicGradient = `linear-gradient(135deg, hsl(${baseHue}, 100%, 55%), hsl(${secondaryHue}, 100%, 50%))`;

  return (
    <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 mb-6 mt-4">
      
      {/* Outer Glow (Aura externa da IA) */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-150 ease-out"
        style={{
          background: dynamicGradient,
          filter: `blur(${blurAmount}px)`,
          opacity: isActive && currentFrequency > 0 ? 0.6 + (normalizedFreq * 0.4) : 0.1,
          transform: `scale(${scale})`,
        }}
      />
      
      {/* Main Ring - Totalmente vazado no meio */}
      <div
        className="absolute inset-0 rounded-full flex items-center justify-center transition-all duration-150 ease-out animate-spin"
        style={{
          background: dynamicGradient,
          animationDuration: `${rotationDuration}s`,
          transform: `scale(${scale})`,
          // Truque de CSS para criar o anel vazado dinamicamente:
          maskImage: `radial-gradient(circle, transparent calc(100% - ${borderWidth}px), black calc(100% - ${borderWidth}px))`,
          WebkitMaskImage: `radial-gradient(circle, transparent calc(100% - ${borderWidth}px), black calc(100% - ${borderWidth}px))`
        }}
      />

      {/* Núcleo de IA (opcional) - Pequena partícula central reativa flutuando no vazio */}
      <div 
        className="absolute rounded-full transition-all duration-150 ease-out"
        style={{
          width: `${4 + normalizedFreq * 12}px`,
          height: `${4 + normalizedFreq * 12}px`,
          background: dynamicGradient,
          filter: 'blur(3px)',
          opacity: isActive && currentFrequency > 0 ? 0.7 : 0,
        }}
      />
    </div>
  );
});