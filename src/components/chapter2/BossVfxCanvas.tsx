import { useEffect, useRef } from "react";
import type { SkillKind } from "./bossAI";

export type VfxBurst = {
  id: number;
  type: "slash" | "crit" | "playerHit" | "phase" | "gazeImpact";
  lane?: number;
  lanes?: number[];
};

type Props = {
  skill: { kind: SkillKind; mode: "telegraph" | "active" | "counter" } | null;
  danger: number[];
  lane: number;
  holding: boolean;
  enraged: boolean;
  burst: VfxBurst | null;
  eyeCoords: [number, number][];
  mouthCoord: [number, number];
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  glow: string;
  drag?: number;
  gravity?: number;
  line?: boolean;
};

type SlashArc = {
  x: number;
  y: number;
  angle: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
};

type ShockRing = {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
  lineWidth: number;
  squashY?: number;
};

const LANE_X = [0.17, 0.5, 0.83];

export default function BossVfxCanvas({
  skill,
  danger,
  lane,
  holding,
  enraged,
  burst,
  eyeCoords,
  mouthCoord,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ skill, danger, lane, holding, enraged, eyeCoords, mouthCoord });
  const particlesRef = useRef<Particle[]>([]);
  const slashesRef = useRef<SlashArc[]>([]);
  const ringsRef = useRef<ShockRing[]>([]);
  const lastBurstId = useRef(0);

  useEffect(() => {
    stateRef.current = { skill, danger, lane, holding, enraged, eyeCoords, mouthCoord };
  }, [skill, danger, lane, holding, enraged, eyeCoords, mouthCoord]);

  // Tính toạ độ pixel tương đối của Boss dựa trên CSS:
  // bottom: 19%, height: min(78svh, 118vw), aspectRatio: 768/1376, centered horizontally
  const getBossPoints = (w: number, h: number, eyes: [number, number][], mouth: [number, number]) => {
    const bossH = Math.min(h * 0.78, w * 1.18);
    const bossW = bossH * (768 / 1376);
    const bossLeft = w * 0.5 - bossW * 0.5;
    const bossTop = h * (1 - 0.19) - bossH;
    return {
      eyes: eyes.map(([ex, ey]) => ({
        x: bossLeft + (ex / 100) * bossW,
        y: bossTop + (ey / 100) * bossH,
      })),
      mouth: {
        x: bossLeft + (mouth[0] / 100) * bossW,
        y: bossTop + (mouth[1] / 100) * bossH,
      },
      chest: {
        x: w * 0.5,
        y: bossTop + bossH * 0.52,
      },
    };
  };

  // Kích hoạt hiệu ứng nổ một lần
  useEffect(() => {
    if (!burst || burst.id === lastBurstId.current) return;
    lastBurstId.current = burst.id;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const pts = getBossPoints(w, h, stateRef.current.eyeCoords, stateRef.current.mouthCoord);

    if (burst.type === "slash" || burst.type === "crit") {
      const isCrit = burst.type === "crit";
      const cx = pts.chest.x;
      const cy = pts.chest.y;
      const count = isCrit ? 52 : 34;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (isCrit ? 280 : 200) + Math.random() * 620;
        particlesRef.current.push({
          x: cx + (Math.random() - 0.5) * 30,
          y: cy + (Math.random() - 0.5) * 30,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0,
          maxLife: 0.35 + Math.random() * 0.4,
          size: isCrit ? 2.5 + Math.random() * 3 : 2 + Math.random() * 2.5,
          color: i % 3 === 0 ? "#ffffff" : isCrit ? "#ffd86b" : i % 2 === 0 ? "#7cc4ff" : "#a855ff",
          glow: isCrit ? "#ffb03d" : "#4fa8ff",
          drag: 0.92,
          line: true,
        });
      }
      slashesRef.current.push({
        x: cx,
        y: cy,
        angle: -0.62 + (Math.random() - 0.5) * 0.25,
        radius: Math.min(w, h) * (isCrit ? 0.42 : 0.34),
        life: 0,
        maxLife: 0.34,
        color: isCrit ? "#ffd86b" : "#7cc4ff",
        width: isCrit ? 12 : 8,
      });
      if (isCrit) {
        slashesRef.current.push({
          x: cx,
          y: cy,
          angle: 0.65,
          radius: Math.min(w, h) * 0.4,
          life: 0,
          maxLife: 0.38,
          color: "#c084fc",
          width: 10,
        });
      }
      ringsRef.current.push({
        x: cx,
        y: cy,
        r: 12,
        maxR: Math.min(w, h) * (isCrit ? 0.5 : 0.36),
        life: 0,
        maxLife: 0.42,
        color: isCrit ? "rgba(255,216,107,0.95)" : "rgba(124,196,255,0.9)",
        lineWidth: isCrit ? 5 : 3,
      });
    } else if (burst.type === "playerHit") {
      const lx = w * LANE_X[burst.lane ?? stateRef.current.lane];
      const ly = h * 0.84;
      for (let i = 0; i < 32; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 140 + Math.random() * 380;
        particlesRef.current.push({
          x: lx,
          y: ly,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 80,
          life: 0,
          maxLife: 0.45 + Math.random() * 0.3,
          size: 2.5 + Math.random() * 3,
          color: i % 2 === 0 ? "#ff3b2f" : "#ff9b71",
          glow: "#ff1a1a",
          drag: 0.93,
          gravity: 340,
          line: true,
        });
      }
      ringsRef.current.push({
        x: lx,
        y: ly,
        r: 10,
        maxR: 160,
        life: 0,
        maxLife: 0.45,
        color: "rgba(255,50,40,0.9)",
        lineWidth: 4,
        squashY: 0.45,
      });
    } else if (burst.type === "gazeImpact" && burst.lanes) {
      for (const l of burst.lanes) {
        const tx = w * LANE_X[l];
        const ty = h * 0.88;
        ringsRef.current.push({
          x: tx,
          y: ty,
          r: 15,
          maxR: w * 0.22,
          life: 0,
          maxLife: 0.5,
          color: "rgba(255,90,40,0.95)",
          lineWidth: 4,
          squashY: 0.32,
        });
        for (let i = 0; i < 20; i++) {
          const ang = -Math.PI + Math.random() * Math.PI;
          const spd = 120 + Math.random() * 340;
          particlesRef.current.push({
            x: tx + (Math.random() - 0.5) * 40,
            y: ty,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 0,
            maxLife: 0.4 + Math.random() * 0.3,
            size: 2 + Math.random() * 2.5,
            color: i % 2 === 0 ? "#fff4d2" : "#ff5a2a",
            glow: "#ff3300",
            drag: 0.94,
            gravity: 220,
            line: true,
          });
        }
      }
    } else if (burst.type === "phase") {
      for (let i = 0; i < 65; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 160 + Math.random() * 580;
        particlesRef.current.push({
          x: pts.chest.x,
          y: pts.chest.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0,
          maxLife: 0.6 + Math.random() * 0.6,
          size: 2.5 + Math.random() * 3.5,
          color: i % 3 === 0 ? "#ffd86b" : "#ff3b1f",
          glow: "#ff2a00",
          drag: 0.95,
          line: true,
        });
      }
      ringsRef.current.push({
        x: pts.chest.x,
        y: pts.chest.y,
        r: 20,
        maxR: Math.max(w, h) * 0.65,
        life: 0,
        maxLife: 0.75,
        color: "rgba(255,70,30,0.95)",
        lineWidth: 6,
      });
    }
  }, [burst]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = performance.now();
    let ambientTimer = 0;

    const drawLightning = (x1: number, y1: number, x2: number, y2: number, jitter: number, color: string, width: number) => {
      const segs = 9;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const px = x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitter;
        const py = y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitter * 0.4;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) {
        raf = requestAnimationFrame(loop);
        return;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const st = stateRef.current;
      const pts = getBossPoints(w, h, st.eyeCoords, st.mouthCoord);
      const playerX = w * LANE_X[st.lane];
      const playerY = h * 0.84;

      // Hạt nền bóng tối + tàn lửa
      ambientTimer += dt;
      if (ambientTimer > 0.065 && particlesRef.current.length < 130) {
        ambientTimer = 0;
        const isShadow = Math.random() < 0.38;
        particlesRef.current.push({
          x: isShadow ? playerX + (Math.random() - 0.5) * 90 : Math.random() * w,
          y: isShadow ? h * 0.94 : h + 10,
          vx: (Math.random() - 0.5) * 28,
          vy: -(35 + Math.random() * 85),
          life: 0,
          maxLife: 1.6 + Math.random() * 2.2,
          size: isShadow ? 2 + Math.random() * 2.5 : 1.5 + Math.random() * 2.2,
          color: isShadow ? "#a855ff" : st.enraged ? "#ff5a36" : "#7cc4ff",
          glow: isShadow ? "#7c3aed" : st.enraged ? "#ff2a00" : "#4fa8ff",
          drag: 0.995,
        });
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // ------ VFX Theo Kỹ Năng ------
      if (st.skill) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.018);

        if ((st.skill.kind === "gaze" || st.skill.kind === "judgment") && st.danger.length > 0) {
          const isJudgment = st.skill.kind === "judgment";
          const isTele = st.skill.mode === "telegraph";
          const isActive = st.skill.mode === "active";

          for (let idx = 0; idx < st.danger.length; idx++) {
            const dl = st.danger[idx];
            const tx = w * LANE_X[dl];
            const ty = h * 0.9;
            const eye = pts.eyes[idx % pts.eyes.length];

            // Vòng tròn ấn ký dưới làn nguy hiểm
            ctx.save();
            ctx.translate(tx, ty);
            ctx.scale(1, 0.32);
            const ringR = Math.min(w * 0.14, 95);
            ctx.rotate(now * 0.0025 * (idx % 2 === 0 ? 1 : -1));
            ctx.beginPath();
            ctx.arc(0, 0, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = isJudgment
              ? `rgba(210, 70, 255, ${isActive ? 0.9 : 0.55 + pulse * 0.3})`
              : `rgba(255, 70, 40, ${isActive ? 0.95 : 0.5 + pulse * 0.35})`;
            ctx.lineWidth = isActive ? 4 : 2;
            ctx.setLineDash(isActive ? [] : [12, 8]);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, ringR * 0.62, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 220, 180, 0.65)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 6]);
            ctx.stroke();
            ctx.restore();

            if (isTele) {
              // Tia ngắm dự báo mảnh từ mắt boss xuống làn
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(eye.x, eye.y);
              ctx.lineTo(tx, ty);
              ctx.strokeStyle = isJudgment
                ? `rgba(216, 110, 255, ${0.45 + pulse * 0.4})`
                : `rgba(255, 80, 50, ${0.45 + pulse * 0.4})`;
              ctx.lineWidth = 2 + pulse * 2;
              ctx.setLineDash([10, 8]);
              ctx.shadowColor = isJudgment ? "#c026d3" : "#ff2a10";
              ctx.shadowBlur = 16;
              ctx.stroke();
              ctx.restore();
            } else if (isActive) {
              // Tia laser plasma khổng lồ
              const beamW = Math.min(w * 0.14, 72) + Math.sin(now * 0.04) * 6;
              ctx.save();
              const grad = ctx.createLinearGradient(eye.x, eye.y, tx, ty);
              if (isJudgment) {
                grad.addColorStop(0, "rgba(255,255,255,0.95)");
                grad.addColorStop(0.3, "rgba(220,70,255,0.75)");
                grad.addColorStop(1, "rgba(255,40,90,0.5)");
              } else {
                grad.addColorStop(0, "rgba(255,255,255,0.98)");
                grad.addColorStop(0.25, "rgba(255,110,40,0.85)");
                grad.addColorStop(1, "rgba(255,20,20,0.55)");
              }

              // Outer halo
              ctx.beginPath();
              ctx.moveTo(eye.x, eye.y);
              ctx.lineTo(tx - beamW * 0.75, ty);
              ctx.lineTo(tx + beamW * 0.75, ty);
              ctx.closePath();
              ctx.fillStyle = isJudgment ? "rgba(180,30,255,0.22)" : "rgba(255,30,10,0.24)";
              ctx.fill();

              // Mid beam
              ctx.beginPath();
              ctx.moveTo(eye.x, eye.y);
              ctx.lineTo(tx - beamW * 0.36, ty);
              ctx.lineTo(tx + beamW * 0.36, ty);
              ctx.closePath();
              ctx.fillStyle = grad;
              ctx.fill();

              // White hot core
              ctx.beginPath();
              ctx.moveTo(eye.x, eye.y);
              ctx.lineTo(tx, ty);
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 5 + pulse * 3;
              ctx.shadowColor = isJudgment ? "#e879f9" : "#ff6b3d";
              ctx.shadowBlur = 24;
              ctx.stroke();
              ctx.restore();

              // Tia sét xoắn quanh tia sáng
              if (Math.random() < 0.7) {
                drawLightning(
                  eye.x,
                  eye.y,
                  tx + (Math.random() - 0.5) * 40,
                  ty,
                  32,
                  isJudgment ? "#f0abfc" : "#ffd29d",
                  2
                );
              }
            }
          }
        }

        if (st.skill.kind === "laugh") {
          const mx = pts.mouth.x;
          const my = pts.mouth.y;
          const isActive = st.skill.mode === "active";

          // Sóng âm thanh từ miệng boss
          const ringCount = isActive ? 3 : 1;
          for (let r = 0; r < ringCount; r++) {
            const phase = ((now * 0.0014 + r / ringCount) % 1);
            const rad = 18 + phase * Math.min(w, h) * (isActive ? 0.62 : 0.28);
            ctx.save();
            ctx.beginPath();
            ctx.arc(mx, my, rad, 0, Math.PI * 2);
            ctx.strokeStyle = isActive
              ? `rgba(255, ${Math.round(90 + (1 - phase) * 110)}, 40, ${(1 - phase) * 0.75})`
              : `rgba(255, 176, 61, ${(1 - phase) * 0.45})`;
            ctx.lineWidth = (1 - phase) * (isActive ? 5 : 2.5);
            ctx.stroke();
            ctx.restore();
          }

          // Khiên bảo vệ quanh Sung Jin Woo khi đang giữ chịu đòn
          if (st.holding) {
            ctx.save();
            const shieldR = Math.min(w, h) * 0.14;
            const sg = ctx.createRadialGradient(playerX, playerY - 25, shieldR * 0.3, playerX, playerY - 25, shieldR);
            sg.addColorStop(0, "rgba(79,168,255,0.03)");
            sg.addColorStop(0.7, "rgba(79,168,255,0.22)");
            sg.addColorStop(1, "rgba(255,215,110,0.65)");
            ctx.beginPath();
            ctx.arc(playerX, playerY - 25, shieldR, Math.PI * 0.92, Math.PI * 2.08);
            ctx.fillStyle = sg;
            ctx.fill();
            ctx.strokeStyle = "rgba(180, 230, 255, 0.9)";
            ctx.lineWidth = 3;
            ctx.shadowColor = "#4fa8ff";
            ctx.shadowBlur = 18;
            ctx.stroke();
            ctx.restore();
          }
        }

        if (st.skill.kind === "fist" || (st.skill.kind === "judgment" && st.skill.mode === "counter")) {
          const isCounter = st.skill.mode === "counter";
          // Tụ lực ở trung tâm + cột chấn động giáng xuống người chơi
          const cx = pts.chest.x;
          const cy = pts.chest.y * 0.9;
          const r = 45 + pulse * 30;
          const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r * 2.4);
          grad.addColorStop(0, "rgba(255,255,255,0.9)");
          grad.addColorStop(0.35, isCounter ? "rgba(168,85,255,0.6)" : "rgba(255,45,107,0.6)");
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
          ctx.fill();

          if (st.skill.mode === "active" || isCounter) {
            // Tia tụ lực giáng từ ngực boss xuống vị trí người chơi
            const beamGrad = ctx.createLinearGradient(cx, cy, playerX, playerY - 24);
            beamGrad.addColorStop(0, "rgba(255,255,255,0.75)");
            beamGrad.addColorStop(0.4, isCounter ? "rgba(192,132,252,0.55)" : "rgba(255,45,107,0.6)");
            beamGrad.addColorStop(1, "rgba(255,220,130,0.85)");
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(playerX, playerY - 24);
            ctx.strokeStyle = beamGrad;
            ctx.lineWidth = 4 + pulse * 4;
            ctx.shadowColor = isCounter ? "#c084fc" : "#ff2d6b";
            ctx.shadowBlur = 22;
            ctx.stroke();
            ctx.restore();

            if (Math.random() < 0.55) {
              drawLightning(cx, cy, playerX, playerY - 24, 24, isCounter ? "#e9d5ff" : "#fda4af", 1.8);
            }

            // Vòng ngắm phản công đa tầng trên người chơi
            ctx.save();
            ctx.translate(playerX, playerY - 24);
            ctx.rotate(now * 0.0045);
            ctx.strokeStyle = isCounter ? "rgba(192,132,252,0.9)" : "rgba(255,70,120,0.9)";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([12, 7]);
            ctx.beginPath();
            ctx.arc(0, 0, 56 + pulse * 10, 0, Math.PI * 2);
            ctx.stroke();

            ctx.rotate(-now * 0.009);
            ctx.strokeStyle = "rgba(255,216,107,0.75)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 10]);
            ctx.beginPath();
            ctx.arc(0, 0, 38 + pulse * 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // ------ Vẽ các vòng xung kích ------
      for (let i = ringsRef.current.length - 1; i >= 0; i--) {
        const rg = ringsRef.current[i];
        rg.life += dt;
        const p = rg.life / rg.maxLife;
        if (p >= 1) {
          ringsRef.current.splice(i, 1);
          continue;
        }
        const ease = 1 - Math.pow(1 - p, 3);
        const currR = rg.r + (rg.maxR - rg.r) * ease;
        ctx.save();
        ctx.translate(rg.x, rg.y);
        if (rg.squashY) ctx.scale(1, rg.squashY);
        ctx.globalAlpha = 1 - p;
        ctx.beginPath();
        ctx.arc(0, 0, currR, 0, Math.PI * 2);
        ctx.strokeStyle = rg.color;
        ctx.lineWidth = rg.lineWidth * (1 - p * 0.6);
        ctx.shadowColor = rg.color;
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.restore();
      }

      // ------ Vẽ vệt chém anime ------
      for (let i = slashesRef.current.length - 1; i >= 0; i--) {
        const sl = slashesRef.current[i];
        sl.life += dt;
        const p = sl.life / sl.maxLife;
        if (p >= 1) {
          slashesRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(sl.x, sl.y);
        ctx.rotate(sl.angle);
        ctx.globalAlpha = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
        const len = sl.radius * (0.4 + 0.8 * Math.min(1, p * 3));
        const thick = sl.width * (1 - p * 0.75);
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.quadraticCurveTo(0, -thick * 2.2, len, 0);
        ctx.quadraticCurveTo(0, thick * 0.5, -len, 0);
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = sl.color;
        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.restore();
      }

      // ------ Vẽ các hạt ------
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const pt = particlesRef.current[i];
        pt.life += dt;
        const p = pt.life / pt.maxLife;
        if (p >= 1) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        const prevX = pt.x;
        const prevY = pt.y;
        if (pt.drag) {
          pt.vx *= Math.pow(pt.drag, dt * 60);
          pt.vy *= Math.pow(pt.drag, dt * 60);
        }
        if (pt.gravity) pt.vy += pt.gravity * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;

        ctx.save();
        ctx.globalAlpha = p < 0.15 ? p / 0.15 : 1 - p;
        ctx.shadowColor = pt.glow;
        ctx.shadowBlur = 10;
        if (pt.line) {
          ctx.beginPath();
          ctx.moveTo(prevX - pt.vx * 0.018, prevY - pt.vy * 0.018);
          ctx.lineTo(pt.x, pt.y);
          ctx.strokeStyle = pt.color;
          ctx.lineWidth = pt.size;
          ctx.lineCap = "round";
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size * (1 - p * 0.4), 0, Math.PI * 2);
          ctx.fillStyle = pt.color;
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[16] h-full w-full" />;
}
