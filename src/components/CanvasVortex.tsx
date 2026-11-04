import React, { useEffect, useRef } from 'react';

export interface TargetLocation {
  x: number;
  y: number;
  size: number;
}

interface SpriteParticle {
  id: string;
  image: CanvasImageSource;
  radius: number;
  targetRadius: number;
  angle: number;
  rot: number;
  spinV: number;
  flip: number;
  flipV: number;
  layer: number;
  state: 'pile' | 'launch' | 'landed';
  t: number;
  duration: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  size: number;
  alpha: number;
  sx: number;
}

interface CanvasVortexProps {
  getTarget: (id: string) => TargetLocation | null;
  onLand: (id: string) => void;
  onVortexReady?: (controller: VortexController) => void;
}

export interface VortexController {
  addSprite: (id: string, image: CanvasImageSource, totalItems?: number) => void;
  launchSprite: (id: string) => void;
  drainAll: () => void;
  clear: () => void;
}

export const CanvasVortex: React.FC<CanvasVortexProps> = ({
  getTarget,
  onLand,
  onVortexReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritesRef = useRef<Map<string, SpriteParticle>>(new Map());
  const queueRef = useRef<string[]>([]);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const controller: VortexController = {
      addSprite: (id, image, totalItems = 50) => {
        if (spritesRef.current.has(id)) return;
        // Dynamically scale sprite size based on file count so particles feel large and crisp in the bigger stage
        const computedSize = Math.max(32, Math.min(50, Math.round(440 / Math.sqrt(Math.max(20, totalItems)))));
        const pileRadius = (Math.pow(Math.random(), 0.65) * Math.min(width * 0.18, height * 0.22)) + 16;

        spritesRef.current.set(id, {
          id,
          image,
          radius: pileRadius,
          targetRadius: pileRadius,
          angle: Math.random() * Math.PI * 2,
          rot: (Math.random() - 0.5) * 0.6,
          spinV: (Math.random() - 0.5) * 1.2,
          flip: Math.random() * Math.PI * 2,
          flipV: 1.2 + Math.random() * 1.8,
          layer: Math.random(),
          state: 'pile',
          t: 0,
          duration: 0.6 + Math.random() * 0.4,
          x: width / 2,
          y: height / 2,
          startX: width / 2,
          startY: height / 2,
          size: computedSize,
          alpha: 0.9,
          sx: 1,
        });
      },
      launchSprite: (id) => {
        if (!queueRef.current.includes(id)) {
          queueRef.current.push(id);
        }
      },
      drainAll: () => {
        // Quickly launch all remaining pile sprites so center is 100% clean
        for (const [id, sprite] of spritesRef.current.entries()) {
          if (sprite.state === 'pile' && !queueRef.current.includes(id)) {
            queueRef.current.push(id);
          }
        }
      },
      clear: () => {
        spritesRef.current.clear();
        queueRef.current = [];
      },
    };

    onVortexReady?.(controller);

    let lastTime = performance.now();
    let launchBudget = 0;

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // Dynamically accelerate launch rate when queue is large
      const qLen = queueRef.current.length;
      const launchRate = Math.max(16, Math.min(120, qLen * 4));
      launchBudget += dt * launchRate;

      while (launchBudget >= 1 && queueRef.current.length > 0) {
        launchBudget -= 1;
        const nextId = queueRef.current.shift()!;
        const sprite = spritesRef.current.get(nextId);
        if (sprite && sprite.state === 'pile') {
          sprite.state = 'launch';
          sprite.t = 0;
          sprite.startX = sprite.x;
          sprite.startY = sprite.y;
        }
      }

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Sort sprites by layer for realistic overlap
      const sortedSprites = Array.from(spritesRef.current.values()).sort(
        (a, b) => a.layer - b.layer
      );

      for (const sprite of sortedSprites) {
        if (sprite.state === 'pile') {
          // Vortex orbit physics
          sprite.angle += (1.4 + (1 - sprite.radius / (width * 0.2))) * dt;
          sprite.flip += sprite.flipV * dt;
          sprite.x = centerX + Math.cos(sprite.angle) * sprite.radius;
          sprite.y = centerY + Math.sin(sprite.angle) * sprite.radius;
          sprite.sx = Math.cos(sprite.flip);
        } else if (sprite.state === 'launch') {
          // Flight physics towards destination card
          sprite.t += dt / sprite.duration;
          const target = getTarget(sprite.id);
          const targetX = target ? target.x : centerX;
          const targetY = target ? target.y : centerY;

          const progress = Math.min(1, sprite.t);
          // Ease-out cubic
          const ease = 1 - Math.pow(1 - progress, 3);
          // Arc curve
          const arcHeight = -50 * Math.sin(progress * Math.PI);

          sprite.x = sprite.startX + (targetX - sprite.startX) * ease;
          sprite.y = sprite.startY + (targetY - sprite.startY) * ease + arcHeight;
          sprite.rot += sprite.spinV * dt;

          // Scale down smoothly as it approaches card
          const scaleProg = 1 - 0.4 * ease;
          sprite.sx = scaleProg;

          if (progress >= 1) {
            sprite.state = 'landed';
            onLand(sprite.id);
          }
        }

        // Only draw sprites that have not yet landed
        if (sprite.state !== 'landed') {
          ctx.save();
          ctx.translate(sprite.x, sprite.y);
          ctx.rotate(sprite.rot);
          ctx.scale(Math.abs(sprite.sx) > 0.05 ? sprite.sx : 0.05, Math.abs(sprite.sx) > 0.05 ? sprite.sx : 0.05);
          ctx.globalAlpha = sprite.alpha;

          const halfSize = sprite.size / 2;

          // Clean shadow
          ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 3;

          try {
            ctx.drawImage(sprite.image, -halfSize, -halfSize, sprite.size, sprite.size);
          } catch {}

          ctx.restore();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [getTarget, onLand, onVortexReady]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-20 h-full w-full"
    />
  );
};
