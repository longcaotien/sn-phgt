import { useEffect, useRef } from "react";
import { createFrameLoop, getMaxDpr, particleScale } from "../utils/perf";

type Props = { intensity?: number; embers?: boolean; rain?: boolean; className?: string };

/**
 * Mưa + tàn lửa năng lượng xanh/tím bay lên, vẽ bằng canvas.
 *
 * Tối ưu hiệu năng:
 * - Dùng chung 1 vòng requestAnimationFrame (tự dừng khi tab ẩn).
 * - Sprite tàn lửa được "nướng" sẵn ra canvas nhỏ => không tạo
 *   RadialGradient + shadowBlur mỗi hạt mỗi frame (đây là thủ phạm lag chính).
 * - Giới hạn DPR và số hạt theo cấu hình máy.
 */
export default function RainCanvas({ intensity = 1, embers = true, rain = true, className = "" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = getMaxDpr();

    const resize = () => {
      dpr = getMaxDpr();
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let resizeRaf = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(resize);
    };
    window.addEventListener("resize", onResize);

    // ---- Sprite tàn lửa nướng sẵn (2 màu) ----
    const SPRITE = 32;
    const makeEmberSprite = (rgb: string) => {
      const c = document.createElement("canvas");
      c.width = c.height = SPRITE;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
      grad.addColorStop(0, `rgba(${rgb},0.95)`);
      grad.addColorStop(0.35, `rgba(${rgb},0.45)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, SPRITE, SPRITE);
      return c;
    };
    const spriteBlue = makeEmberSprite("90,175,255");
    const spritePurple = makeEmberSprite("168,85,255");

    const scale = particleScale;
    const dropCount = rain ? Math.floor(180 * intensity * (scale < 1 ? 0.6 : 1)) : 0;
    const drops = Array.from({ length: dropCount }, () => ({
      x: Math.random() * 1.3,
      y: Math.random(),
      len: 10 + Math.random() * 26,
      speed: 0.9 + Math.random() * 1.1,
      a: 0.15 + Math.random() * 0.4,
    }));

    const emberList = Array.from({ length: embers ? Math.floor(55 * scale) : 0 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 2.2,
      vy: 0.04 + Math.random() * 0.12,
      ph: Math.random() * Math.PI * 2,
      purple: Math.random() > 0.55,
    }));

    let t = 0;

    const draw = (_now: number, dt: number) => {
      t += dt;
      ctx.clearRect(0, 0, w, h);

      if (drops.length) {
        // Gom mưa theo 1 style duy nhất để giảm số lần đổi state của ctx.
        ctx.strokeStyle = "rgba(170,205,255,0.45)";
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (const d of drops) {
          d.y += d.speed * dt * 1.4;
          d.x -= d.speed * dt * 0.25;
          if (d.y > 1.05) {
            d.y = -0.05;
            d.x = Math.random() * 1.3;
          }
          const x = d.x * w;
          const y = d.y * h;
          ctx.moveTo(x, y);
          ctx.lineTo(x + d.len * 0.18, y - d.len);
        }
        ctx.stroke();
      }

      if (emberList.length) {
        ctx.globalCompositeOperation = "lighter";
        for (const e of emberList) {
          e.y -= e.vy * dt;
          if (e.y < -0.05) {
            e.y = 1.05;
            e.x = Math.random();
          }
          const x = (e.x + Math.sin(t * 0.8 + e.ph) * 0.02) * w;
          const y = e.y * h;
          const flick = 0.5 + 0.5 * Math.sin(t * 3 + e.ph);
          const size = e.r * 12;
          ctx.globalAlpha = 0.35 + 0.65 * flick;
          ctx.drawImage(e.purple ? spritePurple : spriteBlue, x - size / 2, y - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    };

    const stop = createFrameLoop(draw);

    return () => {
      stop();
      cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", onResize);
    };
  }, [intensity, embers, rain]);

  return <canvas ref={ref} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
