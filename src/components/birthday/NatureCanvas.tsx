import { useEffect, useRef } from "react";

type LayerMode = "back" | "front";

/**
 * Hệ thống hiệu ứng thiên nhiên anime 4K chuyển động mượt 60fps:
 * - layer="back": Tia nắng hoàng hôn, sương nắng mặt hồ, sóng lấp lánh, chim bay xa, dây liễu rủ, đom đóm.
 * - layer="front": Cỏ & hoa dại mềm mại tiền cảnh uốn theo gió, cánh hoa anh đào & bokeh ánh nắng bay.
 */
export default function NatureCanvas({ layer = "back" }: { layer?: LayerMode }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth;
    let h = window.innerHeight;

    const resizeCanvas = () => {
      if (!canvas) return;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();

    let fireflies: {
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      phase: number;
      speed: number;
    }[] = [];

    let willowStrands: {
      xRatio: number;
      yRatio: number;
      lenRatio: number;
      phase: number;
      amp: number;
      hue: string;
      leaves: number;
    }[] = [];

    let sunGlints: { xRatio: number; yRatio: number; ph: number; sp: number; w: number }[] = [];

    let sunDust: { x: number; y: number; r: number; vx: number; vy: number; a: number; ph: number }[] = [];

    let birds: { x: number; y: number; speed: number; wingPh: number; scale: number }[] = [];

    let blades: {
      xRatio: number;
      height: number;
      width: number;
      lean: number;
      phase: number;
      color1: string;
      color2: string;
      flower?: "daisy" | "poppy" | null;
      alpha: number;
    }[] = [];

    let petals: {
      x: number;
      y: number;
      size: number;
      vx: number;
      vy: number;
      rot: number;
      vrot: number;
      sway: number;
      kind: "sakura" | "leaf" | "bokeh";
      alpha: number;
    }[] = [];

    const rebuildScene = () => {
      if (layer === "back") {
        fireflies = Array.from({ length: 28 }, () => ({
          x: Math.random() * w,
          y: h * (0.22 + Math.random() * 0.7),
          r: 1.4 + Math.random() * 2.4,
          vx: (Math.random() - 0.5) * 0.24,
          vy: -0.1 - Math.random() * 0.22,
          phase: Math.random() * Math.PI * 2,
          speed: 0.018 + Math.random() * 0.02,
        }));

        sunDust = Array.from({ length: 42 }, () => ({
          x: w * (0.22 + Math.random() * 0.72),
          y: h * (0.08 + Math.random() * 0.78),
          r: 1 + Math.random() * 2.2,
          vx: 0.08 + Math.random() * 0.16,
          vy: -0.04 + (Math.random() - 0.5) * 0.1,
          a: 0.18 + Math.random() * 0.35,
          ph: Math.random() * Math.PI * 2,
        }));

        sunGlints = Array.from({ length: 44 }, (_, i) => {
          const t = i / 43;
          return {
            xRatio: 0.48 + Math.random() * 0.48,
            yRatio: 0.51 + t * 0.22,
            ph: Math.random() * Math.PI * 2,
            sp: 1.5 + Math.random() * 2.5,
            w: 14 + t * 55,
          };
        });

        willowStrands = Array.from({ length: 24 }, (_, i) => {
          const t = i / 23;
          return {
            xRatio: 0.02 + t * 0.48 + (Math.random() - 0.5) * 0.02,
            yRatio: 0.0 + (t > 0.62 ? (t - 0.62) * 0.24 : Math.random() * 0.06),
            lenRatio: 0.17 + Math.random() * 0.24 - (t > 0.68 ? 0.04 : 0),
            phase: Math.random() * Math.PI * 2,
            amp: 10 + Math.random() * 14,
            hue:
              i % 3 === 0
                ? "rgba(136, 174, 72, 0.42)"
                : i % 3 === 1
                ? "rgba(74, 114, 42, 0.46)"
                : "rgba(176, 204, 96, 0.36)",
            leaves: 8 + Math.floor(Math.random() * 5),
          };
        });

        birds = Array.from({ length: 4 }, (_, i) => ({
          x: w * (0.45 + i * 0.05 + Math.random() * 0.1),
          y: h * (0.18 + Math.random() * 0.14),
          speed: 0.22 + Math.random() * 0.14,
          wingPh: Math.random() * Math.PI * 2,
          scale: 0.65 + Math.random() * 0.45,
        }));
      } else {
        const count = w < 640 ? 90 : 175;
        blades = Array.from({ length: count }, (_, i) => {
          const xRatio = (i + Math.random() * 0.85) / count;
          const depth = Math.random();
          const edgeBoost = xRatio < 0.14 || xRatio > 0.86 ? 1.15 : 0.46;
          const baseH = (w < 640 ? 22 : 34) + Math.random() * (w < 640 ? 28 : 42);
          const height = baseH * edgeBoost * (0.65 + depth * 0.45);

          let flower: "daisy" | "poppy" | null = null;
          const r = Math.random();
          if (r < 0.05 && (xRatio < 0.22 || xRatio > 0.78)) flower = "daisy";
          else if (r < 0.085 && (xRatio < 0.18 || xRatio > 0.82)) flower = "poppy";

          const darkColors = ["#182c14", "#1f3719", "#25401d"];
          const midColors = ["#335420", "#456826", "#5a7c2d"];
          const sunColors = ["#7c9838", "#96aa45", "#b2ba56"];
          const c1 = depth < 0.4 ? darkColors[i % 3] : midColors[i % 3];
          const c2 = depth < 0.4 ? midColors[i % 3] : sunColors[i % 3];

          return {
            xRatio,
            height,
            width: 1.8 + depth * 2.1,
            lean: (Math.random() - 0.35) * 11,
            phase: Math.random() * Math.PI * 2,
            color1: c1,
            color2: c2,
            flower,
            alpha: 0.72 + depth * 0.25,
          };
        });

        petals = Array.from({ length: w < 640 ? 18 : 30 }, (_, i) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          size: i % 6 === 0 ? 10 + Math.random() * 14 : 4 + Math.random() * 4.2,
          vx: 0.36 + Math.random() * 0.5,
          vy: 0.26 + Math.random() * 0.44,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.03,
          sway: Math.random() * Math.PI * 2,
          kind: i % 6 === 0 ? "bokeh" : i % 5 === 0 ? "leaf" : "sakura",
          alpha: i % 6 === 0 ? 0.14 + Math.random() * 0.14 : 0.75,
        }));
      }
    };

    rebuildScene();

    const onResize = () => {
      resizeCanvas();
      rebuildScene();
    };
    window.addEventListener("resize", onResize);

    const startTime = performance.now();

    const drawBack = (t: number) => {
      // 1. Tia nắng hoàng hôn mềm mại
      const sunX = w * 0.59;
      const sunY = h * 0.37;
      for (let i = 0; i < 4; i++) {
        const angle = 2.42 + i * 0.17 + Math.sin(t * 0.22 + i) * 0.03;
        const len = Math.max(w, h) * 0.9;
        const spread = 0.08 + (i % 2) * 0.03;
        const pulse = 0.04 + 0.022 * Math.sin(t * 0.45 + i * 1.3);

        const grad = ctx.createLinearGradient(sunX, sunY, sunX + Math.cos(angle) * len, sunY + Math.sin(angle) * len);
        grad.addColorStop(0, `rgba(255, 234, 175, ${pulse * 1.5})`);
        grad.addColorStop(0.5, `rgba(255, 212, 128, ${pulse * 0.65})`);
        grad.addColorStop(1, "rgba(255, 200, 110, 0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        ctx.lineTo(sunX + Math.cos(angle - spread) * len, sunY + Math.sin(angle - spread) * len);
        ctx.lineTo(sunX + Math.cos(angle + spread) * len, sunY + Math.sin(angle + spread) * len);
        ctx.closePath();
        ctx.fill();
      }

      // 2. Sương nắng mỏng nhẹ trôi ngang mặt hồ
      const mistShift = Math.sin(t * 0.25) * 40;
      const mistGrad = ctx.createLinearGradient(w * 0.35 + mistShift, h * 0.56, w * 0.95 + mistShift, h * 0.64);
      mistGrad.addColorStop(0, "rgba(255, 228, 178, 0)");
      mistGrad.addColorStop(0.5, "rgba(255, 232, 190, 0.09)");
      mistGrad.addColorStop(1, "rgba(255, 228, 178, 0)");
      ctx.fillStyle = mistGrad;
      ctx.fillRect(0, h * 0.48, w, h * 0.22);

      // 3. Mặt hồ gợn sóng & ánh kim cương lấp lánh (Shinkai water glints)
      for (const g of sunGlints) {
        const wave = Math.sin(t * g.sp + g.ph);
        if (wave < -0.15) continue;
        const gx = g.xRatio * w + Math.sin(t * 0.9 + g.ph) * 6;
        const gy = g.yRatio * h;
        const a = (wave + 0.15) * 0.22;
        const rg = ctx.createLinearGradient(gx - g.w / 2, gy, gx + g.w / 2, gy);
        rg.addColorStop(0, "rgba(255, 232, 160, 0)");
        rg.addColorStop(0.5, `rgba(255, 245, 205, ${a})`);
        rg.addColorStop(1, "rgba(255, 232, 160, 0)");
        ctx.fillStyle = rg;
        ctx.fillRect(gx - g.w / 2, gy, g.w, 1.6);
      }

      // 4. Đàn chim bay chầm chậm phía chân trời hoàng hôn
      ctx.strokeStyle = "rgba(85, 62, 58, 0.45)";
      ctx.lineWidth = 1.4;
      for (const b of birds) {
        b.x += b.speed;
        b.wingPh += 0.085;
        if (b.x > w + 40) b.x = w * 0.35;
        const by = b.y + Math.sin(t * 0.6 + b.wingPh * 0.2) * 5;
        const flap = Math.sin(b.wingPh) * 4.5 * b.scale;
        const span = 7 * b.scale;

        ctx.beginPath();
        ctx.moveTo(b.x - span, by + flap);
        ctx.quadraticCurveTo(b.x - span * 0.45, by - 3 * b.scale, b.x, by);
        ctx.quadraticCurveTo(b.x + span * 0.45, by - 3 * b.scale, b.x + span, by + flap);
        ctx.stroke();
      }

      // 5. Cành liễu rủ tự nhiên uốn lượn theo gió
      for (const s of willowStrands) {
        const sx = s.xRatio * w;
        const sy = s.yRatio * h;
        const len = s.lenRatio * h;
        const wind = Math.sin(t * 1.1 + s.phase + s.xRatio * 4.2) * s.amp + Math.sin(t * 2.0 + s.phase) * 3.5;
        const ex = sx + wind;
        const ey = sy + len;
        const cx = sx + wind * 0.35;
        const cy = sy + len * 0.52;

        ctx.strokeStyle = s.hue;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cx, cy, ex, ey);
        ctx.stroke();

        ctx.fillStyle = s.hue;
        for (let k = 1; k <= s.leaves; k++) {
          const lt = k / s.leaves;
          const omt = 1 - lt;
          const lx = omt * omt * sx + 2 * omt * lt * cx + lt * lt * ex;
          const ly = omt * omt * sy + 2 * omt * lt * cy + lt * lt * ey;
          const side = k % 2 === 0 ? 1 : -1;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(side * 0.52 + wind * 0.015);
          ctx.beginPath();
          ctx.ellipse(side * 2.4, 0, 4.4, 1.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 6. Bụi nắng hoàng hôn
      for (const d of sunDust) {
        d.ph += 0.015;
        d.x += d.vx;
        d.y += d.vy + Math.sin(d.ph) * 0.1;
        if (d.x > w + 10) d.x = -10;
        const alpha = d.a * (0.5 + 0.5 * Math.sin(d.ph));
        ctx.fillStyle = `rgba(255, 242, 200, ${alpha})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 7. Đom đóm ấm áp
      for (const f of fireflies) {
        f.phase += f.speed;
        f.x += f.vx + Math.sin(f.phase * 0.7) * 0.2;
        f.y += f.vy + Math.cos(f.phase * 0.5) * 0.12;

        if (f.y < h * 0.15) f.y = h * 0.92;
        if (f.x < -20) f.x = w + 20;
        if (f.x > w + 20) f.x = -20;

        const alpha = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(f.phase));
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 5);
        g.addColorStop(0, `rgba(255, 244, 185, ${alpha})`);
        g.addColorStop(0.45, `rgba(255, 204, 100, ${alpha * 0.42})`);
        g.addColorStop(1, "rgba(255, 190, 80, 0)");

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawFront = (t: number) => {
      // 1. Thảm cỏ mềm mại tinh tế ở rìa đáy (không che chân bàn/đầu gối)
      const baseY = h + 4;
      for (const b of blades) {
        const bx = b.xRatio * w;
        const gust =
          Math.sin(t * 1.45 - b.xRatio * 6 + b.phase * 0.3) * (8 + b.height * 0.14) +
          Math.sin(t * 2.5 - b.xRatio * 11) * 2.8;
        const tipX = bx + b.lean + gust;
        const tipY = baseY - b.height;
        const ctrlX = bx + (b.lean + gust) * 0.34;
        const ctrlY = baseY - b.height * 0.55;

        const grad = ctx.createLinearGradient(bx, baseY, tipX, tipY);
        grad.addColorStop(0, b.color1);
        grad.addColorStop(1, b.color2);

        ctx.save();
        ctx.globalAlpha = b.alpha;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(bx - b.width, baseY);
        ctx.quadraticCurveTo(ctrlX - b.width * 0.35, ctrlY, tipX, tipY);
        ctx.quadraticCurveTo(ctrlX + b.width * 0.35, ctrlY, bx + b.width, baseY);
        ctx.closePath();
        ctx.fill();

        if (b.flower === "daisy") {
          ctx.translate(tipX, tipY);
          ctx.fillStyle = "rgba(255, 252, 242, 0.92)";
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2 + gust * 0.015;
            ctx.beginPath();
            ctx.ellipse(Math.cos(a) * 3.8, Math.sin(a) * 3.8, 3.1, 1.5, a, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = "#facc15";
          ctx.beginPath();
          ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (b.flower === "poppy") {
          ctx.translate(tipX, tipY);
          ctx.fillStyle = "rgba(249, 115, 56, 0.92)";
          ctx.beginPath();
          ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fef08a";
          ctx.beginPath();
          ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 2. Cánh hoa anh đào, lá liễu & bokeh ánh nắng bay qua tiền cảnh
      for (const p of petals) {
        p.sway += 0.025;
        p.x += p.vx + Math.sin(p.sway) * 0.5;
        p.y += p.vy;
        p.rot += p.vrot;

        if (p.y > h + 24) {
          p.y = -20;
          p.x = Math.random() * w * 0.85;
        }
        if (p.x > w + 24) {
          p.x = -20;
        }

        if (p.kind === "bokeh") {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, `rgba(255, 236, 178, ${p.alpha})`);
          g.addColorStop(1, "rgba(255, 224, 140, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle =
            p.kind === "sakura" ? "rgba(255, 204, 224, 0.78)" : "rgba(154, 208, 92, 0.7)";
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.kind === "sakura" ? p.size * 0.56 : p.size * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    };

    const draw = (now: number) => {
      const t = (now - startTime) * 0.001;
      ctx.clearRect(0, 0, w, h);
      if (layer === "back") drawBack(t);
      else drawFront(t);
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [layer]);

  return (
    <canvas
      ref={ref}
      className={`pointer-events-none absolute inset-0 h-full w-full ${layer === "back" ? "z-10" : "z-30"}`}
    />
  );
}
