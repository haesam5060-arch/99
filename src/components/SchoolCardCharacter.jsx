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
    ctx.imageSmoothingEnabled = false;

    const isAttack = frame === 'attack';
    const borderColor = '#2266dd';
    const bgColor = '#4488ff';
    const innerBg = '#ddeeff';
    const gold = '#ffd700';

    // Draw card background
    const p = pixelSize;
    const offset = isAttack ? 0 : 1;
    const cardW = isAttack ? 16 : 14;
    const cardX = offset;

    // Border
    ctx.fillStyle = borderColor;
    ctx.fillRect(cardX * p, 1 * p, cardW * p, 13 * p);

    // Inner background
    ctx.fillStyle = bgColor;
    ctx.fillRect((cardX + 1) * p, 2 * p, (cardW - 2) * p, 11 * p);

    // Text area (light background for readability)
    ctx.fillStyle = innerBg;
    ctx.fillRect((cardX + 2) * p, 3 * p, (cardW - 4) * p, 7 * p);

    // Gold stripe at bottom
    ctx.fillStyle = gold;
    ctx.fillRect((cardX + 2) * p, 10 * p, (cardW - 4) * p, 2 * p);

    // Render school name text directly on canvas
    const displayText = schoolName.slice(0, 4);
    const textAreaW = (cardW - 4) * p;
    const textAreaH = 7 * p;
    const textAreaX = (cardX + 2) * p;
    const textAreaY = 3 * p;

    // Choose font size based on text length and pixel size
    const baseFontSize = Math.max(Math.floor(p * 2.5), 8);
    const fontSize = displayText.length <= 2 ? baseFontSize : Math.max(Math.floor(baseFontSize * 0.75), 6);

    ctx.fillStyle = '#112244';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Save, clip to text area, draw text, restore
    ctx.save();
    ctx.beginPath();
    ctx.rect(textAreaX, textAreaY, textAreaW, textAreaH);
    ctx.clip();
    ctx.fillText(displayText, textAreaX + textAreaW / 2, textAreaY + textAreaH / 2);
    ctx.restore();

    // Small "초" label on gold stripe
    const labelSize = Math.max(Math.floor(p * 1.2), 5);
    ctx.fillStyle = '#885500';
    ctx.font = `bold ${labelSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('초', (cardX + cardW / 2) * p, 11 * p);
  }, [schoolName, pixelSize, frame]);

  const size = 16 * pixelSize;
  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  );
}
