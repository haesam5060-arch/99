import { useRef, useEffect } from 'react';
import { CHARACTER_SPRITES, CHARACTER_PALETTES } from '../data/characters';
import { renderSprite } from '../utils/pixelRenderer';

export default function PixelCharacter({ characterId = 0, frame = 'idle', pixelSize = 4 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const sprite = CHARACTER_SPRITES[characterId]?.[frame];
    const palette = CHARACTER_PALETTES[characterId]?.colors;
    if (!sprite || !palette) return;

    const size = 16 * pixelSize;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    renderSprite(ctx, sprite, palette, 0, 0, pixelSize);
  }, [characterId, frame, pixelSize]);

  const size = 16 * pixelSize;
  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
      }}
    />
  );
}
