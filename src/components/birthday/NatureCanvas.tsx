import { useEffect, useRef } from "react";

/** Lớp hiệu ứng thiên nhiên chill 60fps: đom đóm ấm áp, cánh hoa anh đào bay trong gió & bụi nắng */
export default function NatureCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const fireflies = Array.from({ length: 28 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1.5 + Math.random() * 2.6,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -0.15 - Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.025,
    }));

    const petals = Array.from({ length: 18 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 4 + Math.random() * 5,
      vx: 0.35 + Math.random() * 0.55,
      vy: 0.35 + Math.random() * 0.5,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.03,
      sway: Math.random() * Math.PI * 2,
      color: Math.random() < 0.72 ? "rgba(255, 198, 218, 0.72)" : "rgba(255, 232, 178, 0.65)",
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Đom đóm phát sáng dịu
      for (const f of fireflies) {
        f.phase += f.speed;
        f.x += f.vx + Math.sin(f.phase * 0.7) * 0.25;
        f.y += f.vy + Math.cos(f.phase * 0.5) * 0.15;

        if (f.y < -20) f.y = h + 20;
        if (f.x < -20) f.x = w + 20;
        if (f.x > w + 20) f.x = -20;

        const alpha = 0.28 + 0.65 * (0.5 + 0.5 * Math.sin(f.phase));
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 5.5);
        g.addColorStop(0, `rgba(255, 240, 175, ${alpha})`);
        g.addColorStop(0.4, `rgba(255, 200, 95, ${alpha * 0.45})`);
        g.addColorStop(1, "rgba(255, 190, 80, 0)");

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 5.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cánh hoa bay nhẹ trong làn gió
      for (const p of petals) {
        p.sway += 0.025;
        p.x += p.vx + Math.sin(p.sway) * 0.45;
        p.y += p.vy;
        p.rot += p.vrot;

        if (p.y > h + 20) {
          p.y = -15;
          p.x = Math.random() * w * 0.9;
        }
        if (p.x > w + 20) {
          p.x = -15;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-10 h-full w-full" />;
}
