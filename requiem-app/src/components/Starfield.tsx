import { useEffect, useRef } from "react";

export interface StarfieldProps {
  animated: boolean;
  numStars?: number;
}

export function Starfield({ animated, numStars = 250 }: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    
    window.addEventListener("resize", resize);
    resize();

    // Inicializar as estrelas (distribuição 3D)
    const stars = Array.from({ length: numStars }).map(() => ({
      x: (Math.random() - 0.5) * 2000, // Coordenada X em um espaço maior
      y: (Math.random() - 0.5) * 2000, // Coordenada Y
      z: Math.random() * 2000,         // Profundidade (Z)
      radius: Math.random() * 1.5 + 0.5,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";

      const centerX = width / 2;
      const centerY = height / 2;
      const focalLength = 300; // Intensidade da perspectiva

      for (let i = 0; i < numStars; i++) {
        const star = stars[i];

        if (animated) {
          star.z -= 4.0; // Velocidade do "Hyperdrive"
          if (star.z <= 0) {
            star.z = 2000;
            star.x = (Math.random() - 0.5) * 2000;
            star.y = (Math.random() - 0.5) * 2000;
          }
        }

        // Projeção perspectiva (3D para 2D)
        const k = focalLength / (star.z || 1);
        const px = star.x * k + centerX;
        const py = star.y * k + centerY;
        const size = star.radius * k;

        // Desenhar apenas se estiver visível na tela
        if (px >= 0 && px <= width && py >= 0 && py <= height && size > 0.1) {
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [animated, numStars]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000 ${
        animated ? "opacity-30" : "opacity-15"
      }`}
    />
  );
}
