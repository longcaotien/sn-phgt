import { useEffect, useRef } from "react";

type Props = { intensity?: number; embers?: boolean; rain?: boolean; className?: string };

/** Mưa + tàn lửa năng lượng xanh/tím bay lên, vẽ bằng canvas */
export default function RainCanvas({ intensity = 1, embers = true, rain = true, className = "" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0,
      h = 0,
      raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const dropCount = rain ? Math.floor(180 * intensity) : 0;
    const drops = Array.from({ length: dropCount }, () => ({
      x: Math.random() * 1.3,
      y: Math.random(),
      len: 10 + Math.random() * 26,
      speed: 0.9 + Math.random() * 1.1,
      a: 0.15 + Math.random() * 0.4,
    }));

    const emberList = Array.from({ length: embers ? 55 : 0 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 2.2,
      vy: 0.04 + Math.random() * 0.12,
      ph: Math.random() * Math.PI * 2,
      purple: Math.random() > 0.55,
    }));

    let t = 0;
    const loop = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);

      // mưa
      ctx.lineCap = "round";
      for (const d of drops) {
        d.y += (d.speed * 0.016) * 1.4;
        d.x -= d.speed * 0.016 * 0.25;
        if (d.y > 1.05) {
          d.y = -0.05;
          d.x = Math.random() * 1.3;
        }
        const x = d.x * w;
        const y = d.y * h;
        ctx.strokeStyle = `rgba(170,205,255,${d.a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + d.len * 0.18, y - d.len);
        ctx.stroke();
      }

      // tàn lửa
      for (const e of emberList) {
        e.y -= e.vy * 0.016;
        if (e.y < -0.05) {
          e.y = 1.05;
          e.x = Math.random();
        }
        const x = (e.x + Math.sin(t * 0.8 + e.ph) * 0.02) * w;
        const y = e.y * h;
        const flick = 0.5 + 0.5 * Math.sin(t * 3 + e.ph);
        const col = e.purple ? "168,85,255" : "90,175,255";
        const g = ctx.createRadialGradient(x, y, 0, x, y, e.r * 6);
        g.addColorStop(0, `rgba(${col},${0.9 * flick})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, e.r * 6, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [intensity, embers]);

  return <canvas ref={ref} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
