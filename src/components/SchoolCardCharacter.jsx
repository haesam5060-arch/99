import { useRef, useEffect } from 'react';

// Renders school name as a styled text badge character
// mode: 'card' for shop display (card form), 'icon' for inline icon (text badge)
export default function SchoolCardCharacter({ schoolName = '중촌', pixelSize = 4, frame = 'idle', mode = 'card' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 16 * pixelSize;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;

    const p = pixelSize;
    const displayText = schoolName.slice(0, 4);
    const isAttack = frame === 'attack';

    if (mode === 'icon') {
      // Icon mode: circular/rounded badge with school name
      const cx = size / 2;
      const cy = size / 2;
      const r = 7 * p;

      // Badge background
      ctx.fillStyle = '#3366cc';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Inner circle
      ctx.fillStyle = '#4488ff';
      ctx.beginPath();
      ctx.arc(cx, cy, r - p, 0, Math.PI * 2);
      ctx.fill();

      // School name text
      const fontSize = displayText.length <= 2
        ? Math.round(p * 3.2)
        : Math.round(p * 2.4);

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSize}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayText, cx, cy - p * 0.3);

      // Small "초" at bottom
      const labelSize = Math.max(Math.round(p * 1.3), 5);
      ctx.fillStyle = '#ffd700';
      ctx.font = `bold ${labelSize}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
      ctx.fillText('초', cx, cy + p * 2.5);
    } else {
      // Card mode: full card display for shop
      const offset = isAttack ? 0 : 1;
      const cardW = isAttack ? 16 : 14;
      const cardX = offset;

      // Border
      ctx.fillStyle = '#2266dd';
      ctx.fillRect(cardX * p, 0, cardW * p, 15 * p);

      // Inner background
      ctx.fillStyle = '#4488ff';
      ctx.fillRect((cardX + 1) * p, 1 * p, (cardW - 2) * p, 13 * p);

      // Text area
      ctx.fillStyle = '#eef4ff';
      ctx.fillRect((cardX + 2) * p, 2 * p, (cardW - 4) * p, 9 * p);

      // Gold stripe
      ctx.fillStyle = '#ffd700';
      ctx.fillRect((cardX + 2) * p, 11 * p, (cardW - 4) * p, 2 * p);

      // School name
      const textAreaW = (cardW - 4) * p;
      const textAreaX = (cardX + 2) * p;
      const textCenterX = textAreaX + textAreaW / 2;

      const fontSize = displayText.length <= 2
        ? Math.round(p * 3.5)
        : displayText.length === 3
          ? Math.round(p * 2.8)
          : Math.round(p * 2.2);

      ctx.fillStyle = '#112244';
      ctx.font = `bold ${fontSize}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayText, textCenterX, 6.5 * p);

      // "초" label
      const labelSize = Math.max(Math.round(p * 1.6), 6);
      ctx.fillStyle = '#775500';
      ctx.font = `bold ${labelSize}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
      ctx.fillText('초', textCenterX, 12 * p);
    }
  }, [schoolName, pixelSize, frame, mode]);

  const size = 16 * pixelSize;
  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}
