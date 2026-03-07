import { useRef, useEffect } from 'react';

// Renders Korean text as pixel art on a card background
export default function SchoolCardCharacter({ schoolName = '중촌', pixelSize = 4, frame = 'idle' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 16 * pixelSize;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    const isAttack = frame === 'attack';
    const borderColor = '#2266dd';
    const bgColor = '#4488ff';
    const innerBg = '#eef4ff';
    const gold = '#ffd700';

    const p = pixelSize;
    const offset = isAttack ? 0 : 1;
    const cardW = isAttack ? 16 : 14;
    const cardX = offset;

    // Border
    ctx.fillStyle = borderColor;
    ctx.fillRect(cardX * p, 0, cardW * p, 15 * p);

    // Inner background
    ctx.fillStyle = bgColor;
    ctx.fillRect((cardX + 1) * p, 1 * p, (cardW - 2) * p, 13 * p);

    // Text area - large
    ctx.fillStyle = innerBg;
    ctx.fillRect((cardX + 2) * p, 2 * p, (cardW - 4) * p, 9 * p);

    // Gold stripe at bottom
    ctx.fillStyle = gold;
    ctx.fillRect((cardX + 2) * p, 11 * p, (cardW - 4) * p, 2 * p);

    // Render school name
    const displayText = schoolName.slice(0, 4);
    const textAreaW = (cardW - 4) * p;
    const textAreaX = (cardX + 2) * p;
    const textCenterX = textAreaX + textAreaW / 2;
    const textCenterY = 6.5 * p;

    // Font size scales with pixelSize - make it big and readable
    const fontSize = displayText.length <= 2
      ? Math.round(p * 3.5)
      : displayText.length === 3
        ? Math.round(p * 2.8)
        : Math.round(p * 2.2);

    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#112244';
    ctx.font = `bold ${fontSize}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, textCenterX, textCenterY);

    // "초" label on gold stripe
    const labelSize = Math.max(Math.round(p * 1.6), 6);
    ctx.fillStyle = '#775500';
    ctx.font = `bold ${labelSize}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    ctx.fillText('초', textCenterX, 12 * p);
  }, [schoolName, pixelSize, frame]);

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
