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
      const speed = 2 + Math.random() * 3;
      return {
        x: startX,
        y: -10,
        speed,
        angle: 0.6 + Math.random() * 0.4, // 사선 각도
        length: 8 + Math.floor(Math.random() * 12),
        size: 2,
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
          const tx = Math.floor(m.x - dx * i * 1.5);
          const ty = Math.floor(m.y - dy * i * 1.5);
          const tailAlpha = (1 - i / m.length) * 0.9;
          ctx.globalAlpha = tailAlpha;

          if (i < 2) {
            // 머리 부분: 밝은 흰색/노란색
            ctx.fillStyle = '#ffffcc';
            ctx.fillRect(tx, ty, m.size, m.size);
          } else if (i < m.length * 0.4) {
            // 중간: 주황/빨간
            ctx.fillStyle = m.color;
            ctx.fillRect(tx, ty, m.size, m.size);
          } else {
            // 끝부분: 어두운 빨간 + 작게
            ctx.fillStyle = '#cc3300';
            ctx.fillRect(tx, ty, 1, 1);
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
