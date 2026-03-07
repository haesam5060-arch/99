// Render a pixel art sprite onto a canvas context
export function renderSprite(ctx, sprite, colorMap, x, y, pixelSize = 3) {
  sprite.forEach((row, ry) => {
    row.forEach((cell, rx) => {
      if (cell !== 0 && colorMap[cell]) {
        ctx.fillStyle = colorMap[cell];
        ctx.fillRect(
          x + rx * pixelSize,
          y + ry * pixelSize,
          pixelSize,
          pixelSize
        );
      }
    });
  });
}

// Create particles for explosion effect
export function createExplosionParticles(x, y, color, count = 12) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 2 + Math.random() * 4,
      color,
      life: 1,
      decay: 0.02 + Math.random() * 0.02,
    });
  }
  return particles;
}
