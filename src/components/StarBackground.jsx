import { useEffect, useRef } from 'react';

export default function StarBackground() {
  const canvasRef = useRef(null);
  const starsRef = useRef([]);
  const meteorsRef = useRef([]);

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

    const createMeteor = () => {
      const startX = Math.random() * canvas.width * 1.2;
      const speed = 4 + Math.random() * 5;
      const baseSize = 6 + Math.floor(Math.random() * 8);
      return {
        x: startX,
        y: -40,
        speed,
        angle: 0.6 + Math.random() * 0.4,
        length: 20 + Math.floor(Math.random() * 25),
        size: baseSize,
        life: 1,
        color: Math.random() > 0.5 ? '#ff8844' : '#ffaa33',
      };
    };

    // 초기 유성 몇 개
    meteorsRef.current = [];

    let animId;
    let meteorTimer = 0;

    const draw = () => {
      ctx.fillStyle = '#0a0a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 별
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

      // 유성 생성 (랜덤 간격)
      meteorTimer++;
      if (meteorTimer > 60 && Math.random() < 0.02) {
        meteorsRef.current.push(createMeteor());
        meteorTimer = 0;
      }

      // 유성 그리기
      meteorsRef.current.forEach((m) => {
        const dx = Math.cos(m.angle) * m.speed;
        const dy = Math.sin(m.angle) * m.speed;
        m.x += dx;
        m.y += dy;

        // 꼬리 (픽셀 도트로 표현)
        for (let i = 0; i < m.length; i++) {
          const progress = i / m.length;
          const tx = Math.floor(m.x - dx * i * 2.5);
          const ty = Math.floor(m.y - dy * i * 2.5);
          const tailAlpha = (1 - progress) * 0.95;
          ctx.globalAlpha = tailAlpha;

          // 크기가 점점 줄어듦
          const dotSize = Math.max(2, Math.floor(m.size * (1 - progress * 0.8)));

          if (i < 3) {
            // 머리: 밝은 흰/노란
            ctx.fillStyle = '#ffffcc';
            ctx.fillRect(tx, ty, m.size, m.size);
            // 머리 주변 밝은 픽셀
            ctx.fillStyle = '#ffeeaa';
            ctx.fillRect(tx - 2, ty + 2, 2, 2);
            ctx.fillRect(tx + m.size, ty - 2, 2, 2);
          } else if (progress < 0.4) {
            // 중간: 주황/빨간 불꽃
            ctx.fillStyle = m.color;
            ctx.fillRect(tx, ty, dotSize, dotSize);
            // 불꽃 파편
            if (i % 2 === 0) {
              ctx.fillStyle = '#ff6622';
              const ox = (Math.random() - 0.5) * dotSize * 2;
              const oy = (Math.random() - 0.5) * dotSize * 2;
              ctx.fillRect(Math.floor(tx + ox), Math.floor(ty + oy), 2, 2);
            }
          } else {
            // 끝부분: 어두운 빨간, 작은 파편
            ctx.fillStyle = '#cc3300';
            ctx.fillRect(tx, ty, dotSize, dotSize);
            if (i % 3 === 0) {
              ctx.globalAlpha = tailAlpha * 0.5;
              ctx.fillStyle = '#881100';
              ctx.fillRect(tx + 2, ty + 2, Math.max(1, dotSize - 2), Math.max(1, dotSize - 2));
            }
          }
        }

        // 화면 밖으로 나가면 제거 표시
        if (m.y > canvas.height + 20 || m.x > canvas.width + 100) {
          m.life = 0;
        }
      });

      // 죽은 유성 제거
      meteorsRef.current = meteorsRef.current.filter((m) => m.life > 0);

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
