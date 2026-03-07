import { useEffect, useRef } from 'react';

export default function StarBackground() {
  const canvasRef = useRef(null);
  const starsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create stars
    starsRef.current = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() > 0.8 ? 2 : 1,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.03,
      color: Math.random() > 0.7 ? '#ffff99' : '#ffffff',
    }));

    let animId;
    const draw = () => {
      ctx.fillStyle = '#0a0a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      starsRef.current.forEach((star) => {
        star.twinkle += star.speed;
        const alpha = 0.3 + Math.sin(star.twinkle) * 0.7;
        ctx.globalAlpha = Math.max(0.1, alpha);
        ctx.fillStyle = star.color;
        ctx.fillRect(
          Math.floor(star.x),
          Math.floor(star.y),
          star.size,
          star.size
        );
      });
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
