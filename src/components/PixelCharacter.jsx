import { useRef, useEffect } from 'react';
import { CHARACTER_SPRITES, CHARACTER_PALETTES } from '../data/characters';
import { renderSprite } from '../utils/pixelRenderer';

export default function PixelCharacter({ characterId = 0, frame = 'idle', pixelSize = 4 }) {
  const canvasRef = useRef(null);

  const sprite = CHARACTER_SPRITES[characterId]?.[frame];
  const palette = CHARACTER_PALETTES[characterId];
  const spriteSize = palette?.spriteSize || 16;
  // Scale so 32x32 sprites render at same visual size as 16x16
  const actualPixelSize = spriteSize === 32 ? Math.max(1, Math.floor(pixelSize / 2)) : pixelSize;
  const canvasSize = spriteSize * actualPixelSize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sprite || !palette?.colors) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    renderSprite(ctx, sprite, palette.colors, 0, 0, actualPixelSize);
  }, [characterId, frame, pixelSize, sprite, palette, canvasSize, actualPixelSize]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize}
      height={canvasSize}
      style={{
        width: canvasSize,
        height: canvasSize,
        imageRendering: 'pixelated',
      }}
    />
  );
}
