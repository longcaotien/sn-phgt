import { useEffect, useRef } from "react";

type LayerMode = "back" | "front";

/**
 * Hệ thống hiệu ứng thiên nhiên 4K chuyển động mượt 60fps:
 * - layer="back": Tia nắng hoàng hôn, sóng mặt hồ lấp lánh, dây liễu rủ lay trong gió, đom đóm & bụi nắng.
 * - layer="front": Thảm cỏ đa lớp + hoa dại tiền cảnh uốn lượn theo làn gió & cánh hoa anh đào bay.
 */
export default function NatureCanvas({ layer = "back" }: { layer?: LayerMode }) {
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
      rebuildScene();
    };
    window.addEventListener("resize", onResize);

    // ---- Dữ liệu lớp BACK ----
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

    let sunDust: { x: number; y: number; r: number; vx: number; vy: number; a: number; ph: number }[] = [];

    // ---- Dữ liệu lớp FRONT ----
    let blades: {
      xRatio: number;
      height: number;
      width: number;
      lean: number;
      phase: number;
      color1: string;
      color2: string;
      flower?: "daisy" | "poppy" | "lupine" | null;
      depth: number; // 0 (xa) -> 1 (gần)
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
      kind: "sakura" | "leaf";
    }[] = [];

    const rebuildScene = () => {
      if (layer === "back") {
        fireflies = Array.from({ length: 30 }, () => ({
          x: Math.random() * w,
          y: h * (0.2 + Math.random() * 0.72),
          r: 1.5 + Math.random() * 2.5,
          vx: (Math.random() - 0.5) * 0.28,
          vy: -0.12 - Math.random() * 0.25,
          phase: Math.random() * Math.PI * 2,
          speed: 0.018 + Math.random() * 0.022,
        }));

        sunDust = Array.from({ length: 36 }, () => ({
          x: w * (0.25 + Math.random() * 0.65),
          y: h * (0.1 + Math.random() * 0.75),
          r: 0.9 + Math.random() * 1.8,
          vx: 0.08 + Math.random() * 0.16,
          vy: -0.05 + (Math.random() - 0.5) * 0.12,
          a: 0.2 + Math.random() * 0.35,
          ph: Math.random() * Math.PI * 2,
        }));

        // Dây liễu rủ dọc tán cây trái -> giữa trái
        willowStrands = Array.from({ length: 28 }, (_, i) => {
          const t = i / 27;
          return {
            xRatio: 0.03 + t * 0.49 + (Math.random() - 0.5) * 0.02,
            yRatio: 0.0 + (t > 0.65 ? (t - 0.65) * 0.26 : Math.random() * 0.08),
            lenRatio: 0.2 + Math.random() * 0.27 - (t > 0.7 ? 0.05 : 0),
            phase: Math.random() * Math.PI * 2,
            amp: 12 + Math.random() * 16,
            hue:
              i % 3 === 0
                ? "rgba(154, 198, 76, 0.52)"
                : i % 3 === 1
                ? "rgba(86, 134, 48, 0.58)"
                : "rgba(196, 224, 102, 0.46)",
            leaves: 9 + Math.floor(Math.random() * 6),
          };
        });
      } else {
        const count = w < 640 ? 95 : 185;
        blades = Array.from({ length: count }, (_, i) => {
          const xRatio = (i + Math.random() * 0.85) / count;
          const depth = Math.random();
          const edgeBoost = xRatio < 0.16 || xRatio > 0.84 ? 1.25 : 0.56;
          const baseH = (w < 640 ? 28 : 42) + Math.random() * (w < 640 ? 34 : 52);
          const height = baseH * edgeBoost * (0.62 + depth * 0.48);

          let flower: "daisy" | "poppy" | "lupine" | null = null;
          const r = Math.random();
          if (r < 0.055) flower = "daisy";
          else if (r < 0.10 && (xRatio < 0.24 || xRatio > 0.78)) flower = "poppy";
          else if (r < 0.14 && xRatio < 0.20) flower = "lupine";

          const darkColors = ["#1c3217", "#233d1b", "#2a471f"];
          const midColors = ["#3c5f24", "#4f742b", "#648a32"];
          const sunColors = ["#8aa940", "#a6ba4e", "#c2c962"];
          const c1 = depth < 0.35 ? darkColors[i % 3] : midColors[i % 3];
          const c2 = depth < 0.35 ? midColors[i % 3] : sunColors[i % 3];

          return {
            xRatio,
            height,
            width: 2.2 + depth * 2.8,
            lean: (Math.random() - 0.35) * 14,
            phase: Math.random() * Math.PI * 2,
            color1: c1,
            color2: c2,
            flower,
            depth,
          };
        }).sort((a, b) => a.depth - b.depth);

        petals = Array.from({ length: w < 640 ? 16 : 24 }, (_, i) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 4 + Math.random() * 4.5,
          vx: 0.42 + Math.random() * 0.55,
          vy: 0.32 + Math.random() * 0.48,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.032,
          sway: Math.random() * Math.PI * 2,
          kind: i % 5 === 0 ? "leaf" : "sakura",
        }));
      }
    };

    rebuildScene();

    const startTime = performance.now();

    const drawBack = (t: number) => {
      // 1. Tia nắng hoàng hôn ấm áp tỏa từ mặt trời (x=0.59w, y=0.37h)
      const sunX = w * 0.59;
      const sunY = h * 0.37;
      for (let i = 0; i < 4; i++) {
        const angle = 2.45 + i * 0.16 + Math.sin(t * 0.25 + i) * 0.03;
        const len = Math.max(w, h) * 0.85;
        const spread = 0.075 + (i % 2) * 0.03;
        const pulse = 0.045 + 0.025 * Math.sin(t * 0.5 + i * 1.4);

        const grad = ctx.createLinearGradient(sunX, sunY, sunX + Math.cos(angle) * len, sunY + Math.sin(angle) * len);
        grad.addColorStop(0, `rgba(255, 232, 165, ${pulse * 1.6})`);
        grad.addColorStop(0.55, `rgba(255, 214, 130, ${pulse * 0.7})`);
        grad.addColorStop(1, "rgba(255, 200, 110, 0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        ctx.lineTo(sunX + Math.cos(angle - spread) * len, sunY + Math.sin(angle - spread) * len);
        ctx.lineTo(sunX + Math.cos(angle + spread) * len, sunY + Math.sin(angle + spread) * len);
        ctx.closePath();
        ctx.fill();
      }

      // 2. Sóng mặt hồ lấp lánh ánh vàng hoàng hôn (x: 0.45w..0.98w, y: 0.50h..0.72h)
      for (let row = 0; row < 14; row++) {
        const rt = row / 13;
        const y = h * (0.515 + rt * 0.195);
        const waveShift = Math.sin(t * 1.5 + row * 0.85) * (6 + rt * 10);
        const barW = (36 + rt * 95) * (0.85 + 0.25 * Math.sin(t * 1.9 + row));
        const cx = w * (0.61 + Math.sin(row * 1.7 + t * 0.4) * 0.05) + waveShift;
        const alpha = (0.14 + 0.1 * Math.sin(t * 2.2 + row * 1.3)) * (1 - rt * 0.35);

        const rg = ctx.createLinearGradient(cx - barW / 2, y, cx + barW / 2, y);
        rg.addColorStop(0, "rgba(255, 224, 140, 0)");
        rg.addColorStop(0.5, `rgba(255, 236, 178, ${alpha})`);
        rg.addColorStop(1, "rgba(255, 224, 140, 0)");
        ctx.fillStyle = rg;
        ctx.fillRect(cx - barW / 2, y, barW, 2 + rt * 2.2);
      }

      // 3. Cành liễu rủ lay nhẹ trong gió mượt mà
      for (const s of willowStrands) {
        const sx = s.xRatio * w;
        const sy = s.yRatio * h;
        const len = s.lenRatio * h;
        const wind = Math.sin(t * 1.15 + s.phase + s.xRatio * 4.5) * s.amp + Math.sin(t * 2.1 + s.phase) * 4;
        const ex = sx + wind;
        const ey = sy + len;
        const cx = sx + wind * 0.35;
        const cy = sy + len * 0.52;

        ctx.strokeStyle = s.hue;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cx, cy, ex, ey);
        ctx.stroke();

        // Lá liễu nhỏ dọc thân dây
        ctx.fillStyle = s.hue;
        for (let k = 1; k <= s.leaves; k++) {
          const lt = k / s.leaves;
          const omt = 1 - lt;
          const lx = omt * omt * sx + 2 * omt * lt * cx + lt * lt * ex;
          const ly = omt * omt * sy + 2 * omt * lt * cy + lt * lt * ey;
          const side = k % 2 === 0 ? 1 : -1;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(side * 0.55 + wind * 0.015);
          ctx.beginPath();
          ctx.ellipse(side * 2.5, 0, 4.6, 1.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 4. Bụi nắng lững lờ
      for (const d of sunDust) {
        d.ph += 0.015;
        d.x += d.vx;
        d.y += d.vy + Math.sin(d.ph) * 0.12;
        if (d.x > w + 10) d.x = -10;
        const alpha = d.a * (0.55 + 0.45 * Math.sin(d.ph));
        ctx.fillStyle = `rgba(255, 240, 195, ${alpha})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Đom đóm ấm áp
      for (const f of fireflies) {
        f.phase += f.speed;
        f.x += f.vx + Math.sin(f.phase * 0.7) * 0.22;
        f.y += f.vy + Math.cos(f.phase * 0.5) * 0.14;

        if (f.y < h * 0.12) f.y = h * 0.92;
        if (f.x < -20) f.x = w + 20;
        if (f.x > w + 20) f.x = -20;

        const alpha = 0.28 + 0.65 * (0.5 + 0.5 * Math.sin(f.phase));
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 5.2);
        g.addColorStop(0, `rgba(255, 244, 185, ${alpha})`);
        g.addColorStop(0.45, `rgba(255, 204, 100, ${alpha * 0.42})`);
        g.addColorStop(1, "rgba(255, 190, 80, 0)");

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 5.2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawFront = (t: number) => {
      // 1. Thảm cỏ 4K & hoa dại tiền cảnh uốn cong theo làn gió lướt qua
      const baseY = h + 4;
      for (const b of blades) {
        const bx = b.xRatio * w;
        // Sóng gió chạy từ trái sang phải
        const gust =
          Math.sin(t * 1.55 - b.xRatio * 6.5 + b.phase * 0.3) * (10 + b.height * 0.14) +
          Math.sin(t * 2.8 - b.xRatio * 12) * 3.5;
        const tipX = bx + b.lean + gust;
        const tipY = baseY - b.height;
        const ctrlX = bx + (b.lean + gust) * 0.32;
        const ctrlY = baseY - b.height * 0.55;

        const grad = ctx.createLinearGradient(bx, baseY, tipX, tipY);
        grad.addColorStop(0, b.color1);
        grad.addColorStop(1, b.color2);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(bx - b.width, baseY);
        ctx.quadraticCurveTo(ctrlX - b.width * 0.4, ctrlY, tipX, tipY);
        ctx.quadraticCurveTo(ctrlX + b.width * 0.4, ctrlY, bx + b.width, baseY);
        ctx.closePath();
        ctx.fill();

        // Vẽ hoa dại trên đỉnh ngọn cỏ
        if (b.flower === "daisy") {
          ctx.save();
          ctx.translate(tipX, tipY);
          ctx.fillStyle = "rgba(255, 252, 240, 0.94)";
          for (let p = 0; p < 6; p++) {
            const a = (p / 6) * Math.PI * 2 + gust * 0.015;
            ctx.beginPath();
            ctx.ellipse(Math.cos(a) * 4.5, Math.sin(a) * 4.5, 3.6, 1.8, a, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = "#facc15";
          ctx.beginPath();
          ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (b.flower === "poppy") {
          ctx.save();
          ctx.translate(tipX, tipY);
          ctx.fillStyle = "rgba(249, 115, 56, 0.95)";
          ctx.beginPath();
          ctx.arc(0, 0, 5.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fef08a";
          ctx.beginPath();
          ctx.arc(0, 0, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (b.flower === "lupine") {
          for (let k = 0; k < 5; k++) {
            const lx = bx + (tipX - bx) * (0.68 + k * 0.08);
            const ly = baseY - b.height * (0.68 + k * 0.08);
            ctx.fillStyle = k % 2 === 0 ? "rgba(167, 139, 250, 0.9)" : "rgba(244, 165, 210, 0.9)";
            ctx.beginPath();
            ctx.arc(lx + (k % 2 ? 2.5 : -2.5), ly, 3.2 - k * 0.35, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 2. Cánh hoa anh đào & lá liễu bay trong làn gió
      for (const p of petals) {
        p.sway += 0.026;
        p.x += p.vx + Math.sin(p.sway) * 0.55;
        p.y += p.vy;
        p.rot += p.vrot;

        if (p.y > h + 20) {
          p.y = -15;
          p.x = Math.random() * w * 0.85;
        }
        if (p.x > w + 20) {
          p.x = -15;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle =
          p.kind === "sakura" ? "rgba(255, 204, 224, 0.78)" : "rgba(154, 208, 92, 0.72)";
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.kind === "sakura" ? p.size * 0.56 : p.size * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
