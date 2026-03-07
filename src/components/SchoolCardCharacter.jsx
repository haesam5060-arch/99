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
    const innerBg = '#66aaff';
    const gold = '#ffd700';

    // Draw card background
    const p = pixelSize;
    const offset = isAttack ? 0 : 1;
    const cardW = isAttack ? 16 : 14;
    const cardX = offset;

    // Border
    ctx.fillStyle = borderColor;
    ctx.fillRect(cardX * p, 1 * p, cardW * p, 12 * p);

    // Inner background
    ctx.fillStyle = bgColor;
    ctx.fillRect((cardX + 1) * p, 2 * p, (cardW - 2) * p, 10 * p);

    // Text area (white-ish)
    ctx.fillStyle = innerBg;
    ctx.fillRect((cardX + 2) * p, 3 * p, (cardW - 4) * p, 6 * p);

    // Gold stripe
    ctx.fillStyle = gold;
    ctx.fillRect((cardX + 2) * p, 9 * p, (cardW - 4) * p, 2 * p);

    // Render school name as pixel text
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 64;
    textCanvas.height = 32;
    const tCtx = textCanvas.getContext('2d');
    tCtx.imageSmoothingEnabled = false;

    // Draw text small to get pixel effect
    const displayText = schoolName.slice(0, 4);
    const fontSize = displayText.length <= 2 ? 11 : displayText.length === 3 ? 9 : 7;
    tCtx.fillStyle = '#222244';
    tCtx.font = `bold ${fontSize}px sans-serif`;
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'middle';
    tCtx.fillText(displayText, 32, 16);

    // Sample the text canvas and render as pixels onto the card
    const textAreaW = cardW - 4;
    const textAreaH = 6;
    const textAreaX = cardX + 2;
    const textAreaY = 3;
    const imgData = tCtx.getImageData(0, 0, 64, 32);

    for (let py = 0; py < textAreaH; py++) {
      for (let px = 0; px < textAreaW; px++) {
        // Map card pixel to text canvas pixel
        const tx = Math.floor((px / textAreaW) * 64);
        const ty = Math.floor((py / textAreaH) * 32);
        const idx = (ty * 64 + tx) * 4;
        const alpha = imgData.data[idx + 3];
        if (alpha > 80) {
          ctx.fillStyle = '#222244';
          ctx.fillRect((textAreaX + px) * p, (textAreaY + py) * p, p, p);
        }
      }
    }
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
