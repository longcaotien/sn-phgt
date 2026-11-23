import { useEffect, useRef } from "react";
import { createFrameLoop, getMaxDpr, particleScale } from "../../utils/perf";

type LayerMode = "back" | "front";

/**
 * Hệ thống hiệu ứng thiên nhiên anime chuyển động mượt, tối ưu cho máy yếu:
 * - layer="back": Tia nắng hoàng hôn, sương nắng mặt hồ, sóng lấp lánh, chim bay xa, dây liễu rủ, đom đóm.
 * - layer="front": Cỏ & hoa dại mềm mại tiền cảnh uốn theo gió, cánh hoa anh đào & bokeh ánh nắng bay.
 *
 * Tối ưu:
 * - Không còn `createLinearGradient` / `createRadialGradient` trong vòng lặp vẽ
 *   (trước đây tạo hàng trăm gradient mỗi frame -> GC + tụt fps).
 * - Các lớp tĩnh (tia nắng, sương) được "nướng" 1 lần ra offscreen canvas.
 * - Hạt sáng dùng sprite nướng sẵn + drawImage.
 * - Dùng chung 1 RAF loop, tự dừng khi tab ẩn, giới hạn DPR.
 */
export default function NatureCanvas({ layer = "back" }: { layer?: LayerMode }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let dpr = getMaxDpr();
    let w = window.innerWidth;
    let h = window.innerHeight;

    const resizeCanvas = () => {
      dpr = getMaxDpr();
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

    /** Bướm & ong bay lượn gần camera (thêm sinh động cho tiền cảnh) */
    let flutter: {
      x: number;
      y: number;
      ph: number;
      sp: number;
      amp: number;
      size: number;
      kind: "butterfly" | "bee";
      hue: string;
    }[] = [];

    /** Tia sáng thần tiên (god rays) toả xuống từ tán lá */
    let godRays: { xRatio: number; ph: number; w: number; a: number }[] = [];

    let blades: {
      xRatio: number;
      height: number;
      width: number;
      lean: number;
      phase: number;
      color: string;
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

    /** Hệ số mật độ hạt theo cấu hình máy */
    const density = particleScale;

    // ---------- Sprite nướng sẵn ----------
    const makeDot = (rgb: string, softness = 0.35) => {
      const S = 32;
      const c = document.createElement("canvas");
      c.width = c.height = S;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grad.addColorStop(0, `rgba(${rgb},1)`);
      grad.addColorStop(softness, `rgba(${rgb},0.45)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, S, S);
      return c;
    };
    const dotWarm = makeDot("255,244,185", 0.45);
    const dotDust = makeDot("255,242,200", 0.4);
    const dotBokeh = makeDot("255,236,178", 0.5);

    /** Sprite vệt sáng ngang (thay cho createLinearGradient mỗi khung hình) */
    const makeGlintSprite = () => {
      const W = 64;
      const H = 8;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d")!;
      const grad = g.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, "rgba(255,232,160,0)");
      grad.addColorStop(0.5, "rgba(255,245,205,1)");
      grad.addColorStop(1, "rgba(255,232,160,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      return c;
    };
    const glintSprite = makeGlintSprite();

    /** Lớp tĩnh: tia nắng + sương nắng (vẽ 1 lần mỗi khi resize) */
    let staticBack: HTMLCanvasElement | null = null;

    const buildStaticBack = () => {
      const sc = document.createElement("canvas");
      sc.width = Math.max(1, Math.floor(w * dpr));
      sc.height = Math.max(1, Math.floor(h * dpr));
      const g = sc.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      // 1. Tia nắng hoàng hôn
      const sunX = w * 0.59;
      const sunY = h * 0.37;
      for (let i = 0; i < 4; i++) {
        const angle = 2.42 + i * 0.17;
        const len = Math.max(w, h) * 0.9;
        const spread = 0.08 + (i % 2) * 0.03;
        const pulse = 0.05;

        const grad = g.createLinearGradient(sunX, sunY, sunX + Math.cos(angle) * len, sunY + Math.sin(angle) * len);
        grad.addColorStop(0, `rgba(255, 234, 175, ${pulse * 1.5})`);
        grad.addColorStop(0.5, `rgba(255, 212, 128, ${pulse * 0.65})`);
        grad.addColorStop(1, "rgba(255, 200, 110, 0)");

        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(sunX, sunY);
        g.lineTo(sunX + Math.cos(angle - spread) * len, sunY + Math.sin(angle - spread) * len);
        g.lineTo(sunX + Math.cos(angle + spread) * len, sunY + Math.sin(angle + spread) * len);
        g.closePath();
        g.fill();
      }

      // 2. Sương nắng mỏng
      const mistGrad = g.createLinearGradient(w * 0.35, h * 0.56, w * 0.95, h * 0.64);
      mistGrad.addColorStop(0, "rgba(255, 228, 178, 0)");
      mistGrad.addColorStop(0.5, "rgba(255, 232, 190, 0.09)");
      mistGrad.addColorStop(1, "rgba(255, 228, 178, 0)");
      g.fillStyle = mistGrad;
      g.fillRect(0, h * 0.48, w, h * 0.22);

      staticBack = sc;
    };

    const rebuildScene = () => {
      if (layer === "back") {
        fireflies = Array.from({ length: Math.max(10, Math.round(28 * density)) }, () => ({
          x: Math.random() * w,
          y: h * (0.22 + Math.random() * 0.7),
          r: 1.4 + Math.random() * 2.4,
          vx: (Math.random() - 0.5) * 0.24,
          vy: -0.1 - Math.random() * 0.22,
          phase: Math.random() * Math.PI * 2,
          speed: 0.018 + Math.random() * 0.02,
        }));

        sunDust = Array.from({ length: Math.max(14, Math.round(42 * density)) }, () => ({
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

        const strandCount = Math.max(10, Math.round(24 * density));
        willowStrands = Array.from({ length: strandCount }, (_, i) => {
          const t = i / Math.max(1, strandCount - 1);
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

        flutter = Array.from({ length: Math.max(4, Math.round(8 * density)) }, (_, i) => ({
          x: Math.random() * w,
          y: h * (0.35 + Math.random() * 0.45),
          ph: Math.random() * Math.PI * 2,
          sp: 0.35 + Math.random() * 0.5,
          amp: 16 + Math.random() * 34,
          size: 9 + Math.random() * 7,
          kind: i % 3 === 0 ? "bee" : "butterfly",
          hue: ["#ffd66e", "#ffb3d1", "#c8e6ff", "#ffe9a8"][i % 4],
        }));

        godRays = Array.from({ length: 6 }, (_, i) => ({
          xRatio: 0.42 + i * 0.07 + (Math.random() - 0.5) * 0.03,
          ph: Math.random() * Math.PI * 2,
          w: 0.04 + Math.random() * 0.05,
          a: 0.05 + Math.random() * 0.06,
        }));

        buildStaticBack();
      } else {
        const count = Math.round((w < 640 ? 90 : 175) * (density < 1 ? 0.72 : 1));
        const darkColors = ["#182c14", "#1f3719", "#25401d"];
        const midColors = ["#335420", "#456826", "#5a7c2d"];
        const sunColors = ["#7c9838", "#96aa45", "#b2ba56"];

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

          // Trước đây mỗi lá tạo 1 LinearGradient/khung hình. Nay trộn sẵn 1 màu
          // (chênh lệch thị giác gần như không thấy vì alpha thấp + chuyển động gió).
          const c1 = depth < 0.4 ? darkColors[i % 3] : midColors[i % 3];
          const c2 = depth < 0.4 ? midColors[i % 3] : sunColors[i % 3];

          return {
            xRatio,
            height,
            width: 1.8 + depth * 2.1,
            lean: (Math.random() - 0.35) * 11,
            phase: Math.random() * Math.PI * 2,
            color: mixHex(c1, c2, 0.5),
            flower,
            alpha: 0.72 + depth * 0.25,
          };
        });

        petals = Array.from({ length: Math.round((w < 640 ? 18 : 30) * Math.max(0.4, density)) }, (_, i) => ({
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

    let resizeRaf = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeCanvas();
        rebuildScene();
      });
    };
    window.addEventListener("resize", onResize);

    const startTime = performance.now();

    const drawBack = (t: number) => {
      // 1. Tia nắng (lớp nướng sẵn) — nhấp nháy rất nhẹ bằng globalAlpha
      if (staticBack) {
        ctx.globalAlpha = 0.82 + 0.18 * Math.sin(t * 0.45);
        ctx.drawImage(staticBack, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      // 2. Mặt hồ gợn sóng & ánh kim cương lấp lánh (sprite thay vì gradient)
      ctx.globalCompositeOperation = "lighter";
      for (const g of sunGlints) {
        const wave = Math.sin(t * g.sp + g.ph);
        if (wave < -0.15) continue;
        const gx = g.xRatio * w + Math.sin(t * 0.9 + g.ph) * 6;
        const gy = g.yRatio * h;
        ctx.globalAlpha = (wave + 0.15) * 0.22;
        ctx.drawImage(glintSprite, gx - g.w / 2, gy, g.w, 2.2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // 2b. Tia sáng thần tiên (god rays) — rẻ: chỉ 6 dải gradient mờ
      ctx.globalCompositeOperation = "lighter";
      for (const r of godRays) {
        const sway = Math.sin(t * 0.28 + r.ph) * 0.012;
        const x0 = (r.xRatio + sway) * w;
        const alpha = r.a * (0.65 + 0.35 * Math.sin(t * 0.5 + r.ph));
        const gx = ctx.createLinearGradient(x0, 0, x0 - h * 0.32, h);
        gx.addColorStop(0, `rgba(255, 240, 190, ${alpha})`);
        gx.addColorStop(0.55, `rgba(255, 226, 160, ${alpha * 0.45})`);
        gx.addColorStop(1, "rgba(255, 210, 130, 0)");
        ctx.fillStyle = gx;
        ctx.beginPath();
        ctx.moveTo(x0 - r.w * w, 0);
        ctx.lineTo(x0 + r.w * w, 0);
        ctx.lineTo(x0 + r.w * w - h * 0.3, h);
        ctx.lineTo(x0 - r.w * w - h * 0.3, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // 3. Đàn chim bay chầm chậm phía chân trời
      ctx.strokeStyle = "rgba(85, 62, 58, 0.45)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const b of birds) {
        b.x += b.speed;
        b.wingPh += 0.085;
        if (b.x > w + 40) b.x = w * 0.35;
        const by = b.y + Math.sin(t * 0.6 + b.wingPh * 0.2) * 5;
        const flap = Math.sin(b.wingPh) * 4.5 * b.scale;
        const span = 7 * b.scale;

        ctx.moveTo(b.x - span, by + flap);
        ctx.quadraticCurveTo(b.x - span * 0.45, by - 3 * b.scale, b.x, by);
        ctx.quadraticCurveTo(b.x + span * 0.45, by - 3 * b.scale, b.x + span, by + flap);
      }
      ctx.stroke();

      // 4. Cành liễu rủ uốn lượn theo gió (không dùng save/restore cho từng lá)
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
        const leafAngle = wind * 0.015;
        ctx.beginPath();
        for (let k = 1; k <= s.leaves; k++) {
          const lt = k / s.leaves;
          const omt = 1 - lt;
          const lx = omt * omt * sx + 2 * omt * lt * cx + lt * lt * ex;
          const ly = omt * omt * sy + 2 * omt * lt * cy + lt * lt * ey;
          const side = k % 2 === 0 ? 1 : -1;
          // ellipse(x, y, rx, ry, rotation, start, end) => gộp nhiều lá vào 1 path
          ctx.ellipse(lx + side * 2.4, ly, 4.4, 1.4, side * 0.52 + leafAngle, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // 5. Bụi nắng hoàng hôn (sprite)
      ctx.globalCompositeOperation = "lighter";
      for (const d of sunDust) {
        d.ph += 0.015;
        d.x += d.vx;
        d.y += d.vy + Math.sin(d.ph) * 0.1;
        if (d.x > w + 10) d.x = -10;
        const alpha = d.a * (0.5 + 0.5 * Math.sin(d.ph));
        const size = d.r * 4;
        ctx.globalAlpha = alpha;
        ctx.drawImage(dotDust, d.x - size / 2, d.y - size / 2, size, size);
      }

      // 6. Đom đóm ấm áp (sprite)
      for (const f of fireflies) {
        f.phase += f.speed;
        f.x += f.vx + Math.sin(f.phase * 0.7) * 0.2;
        f.y += f.vy + Math.cos(f.phase * 0.5) * 0.12;

        if (f.y < h * 0.15) f.y = h * 0.92;
        if (f.x < -20) f.x = w + 20;
        if (f.x > w + 20) f.x = -20;

        const alpha = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(f.phase));
        const size = f.r * 10;
        ctx.globalAlpha = alpha;
        ctx.drawImage(dotWarm, f.x - size / 2, f.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;

      // 7. Bướm & ong bay lượn (vẽ hình học, không dùng ảnh)
      for (const f of flutter) {
        f.ph += f.sp * 0.016;
        const fx = f.x + Math.sin(f.ph * 1.7) * f.amp;
        const fy = f.y + Math.cos(f.ph * 1.1) * f.amp * 0.55;
        const wing = 0.45 + 0.55 * Math.abs(Math.sin(f.ph * 7));
        ctx.globalAlpha = 0.85;
        if (f.kind === "bee") {
          ctx.fillStyle = "#ffcf4d";
          ctx.beginPath();
          ctx.ellipse(fx, fy, f.size * 0.36, f.size * 0.26, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(60,40,10,0.75)";
          ctx.beginPath();
          ctx.ellipse(fx + f.size * 0.08, fy, f.size * 0.1, f.size * 0.24, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.beginPath();
          ctx.ellipse(fx - f.size * 0.1, fy - f.size * 0.22, f.size * 0.22 * wing, f.size * 0.1, -0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = f.hue;
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(
              fx + side * f.size * 0.3 * wing,
              fy,
              f.size * 0.34 * wing,
              f.size * 0.28,
              side * 0.5,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
          ctx.fillStyle = "rgba(80,50,20,0.7)";
          ctx.beginPath();
          ctx.ellipse(fx, fy, f.size * 0.07, f.size * 0.24, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const drawFront = (t: number) => {
      // 1. Thảm cỏ mềm mại ở rìa đáy
      const baseY = h + 4;
      const gustSpeed = t * 1.45;

      // Hai nhóm màu để giảm số lần đổi fillStyle (giữ cảm giác nhiều tông).
      for (const b of blades) {
        const bx = b.xRatio * w;
        const gust =
          Math.sin(gustSpeed - b.xRatio * 6 + b.phase * 0.3) * (8 + b.height * 0.14) +
          Math.sin(t * 2.5 - b.xRatio * 11) * 2.8;
        const tipX = bx + b.lean + gust;
        const tipY = baseY - b.height;
        const ctrlX = bx + (b.lean + gust) * 0.34;
        const ctrlY = baseY - b.height * 0.55;

        ctx.globalAlpha = b.alpha;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(bx - b.width, baseY);
        ctx.quadraticCurveTo(ctrlX - b.width * 0.35, ctrlY, tipX, tipY);
        ctx.quadraticCurveTo(ctrlX + b.width * 0.35, ctrlY, bx + b.width, baseY);
        ctx.closePath();
        ctx.fill();

        if (b.flower === "daisy") {
          ctx.globalAlpha = 1;
          ctx.fillStyle = "rgba(255, 252, 242, 0.92)";
          ctx.beginPath();
          const rot = gust * 0.015;
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2 + rot;
            ctx.ellipse(tipX + Math.cos(a) * 3.8, tipY + Math.sin(a) * 3.8, 3.1, 1.5, a, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.fillStyle = "#facc15";
          ctx.beginPath();
          ctx.arc(tipX, tipY, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (b.flower === "poppy") {
          ctx.globalAlpha = 1;
          ctx.fillStyle = "rgba(249, 115, 56, 0.92)";
          ctx.beginPath();
          ctx.arc(tipX, tipY, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fef08a";
          ctx.beginPath();
          ctx.arc(tipX, tipY, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

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
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = p.alpha * 2.2;
          const size = p.size * 2;
          ctx.drawImage(dotBokeh, p.x - size / 2, p.y - size / 2, size, size);
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = p.kind === "sakura" ? "rgba(255, 204, 224, 0.78)" : "rgba(154, 208, 92, 0.7)";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size, p.kind === "sakura" ? p.size * 0.56 : p.size * 0.35, p.rot, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    // Lớp nền chạy 45fps (đủ mượt cho hiệu ứng nền, tiết kiệm ~25% GPU),
    // lớp tiền cảnh chạy 60fps.
    const interval = layer === "back" ? 1 / 45 : 0;
    let acc = 0;

    const draw = (now: number, dt: number) => {
      if (interval > 0) {
        acc += dt;
        if (acc < interval) return;
        acc = 0;
      }
      const t = (now - startTime) * 0.001;
      ctx.clearRect(0, 0, w, h);
      if (layer === "back") drawBack(t);
      else drawFront(t);
    };

    const stop = createFrameLoop(draw);

    return () => {
      stop();
      cancelAnimationFrame(resizeRaf);
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

/** Trộn 2 màu hex -> chuỗi rgb (dùng 1 lần lúc dựng scene) */
function mixHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  const n = parseInt(v.length === 3 ? v.replace(/(.)/g, "$1$1") : v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
