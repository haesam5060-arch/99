import { useRef, useEffect } from 'react';

// Renders school name as a styled text badge character
// mode: 'card' for shop display (card form), 'icon' for inline icon (HTML badge)
export default function SchoolCardCharacter({ schoolName = '중촌', pixelSize = 4, frame = 'idle', mode = 'card' }) {
  const size = 16 * pixelSize;

  if (mode === 'icon') {
    const displayText = schoolName.slice(0, 4);
    const fontSize = displayText.length <= 2
      ? Math.max(size * 0.35, 10)
      : Math.max(size * 0.28, 8);
    const labelSize = Math.max(size * 0.16, 6);

    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #4488ff, #2255cc)',
        border: `${Math.max(pixelSize * 0.5, 1)}px solid #6699ff`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}>
        <span style={{
          color: '#ffffff',
          fontSize,
          fontWeight: 'bold',
          fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
          lineHeight: 1.1,
          textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
        }}>
          {displayText}
        </span>
        <span style={{
          color: '#ffd700',
          fontSize: labelSize,
          fontWeight: 'bold',
          fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
          lineHeight: 1,
          marginTop: 1,
        }}>
          초
        </span>
      </div>
    );
  }

  // Card mode: canvas-based for shop display
  return <SchoolCardCanvas schoolName={schoolName} pixelSize={pixelSize} frame={frame} />;
}

function SchoolCardCanvas({ schoolName, pixelSize, frame }) {
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
