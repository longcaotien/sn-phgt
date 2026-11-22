import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import RainCanvas from "../RainCanvas";
import { avatar, bossArena, bossEnrage, bossIdle, heroKneel, heroStand } from "./assets";
import { PlayerBehaviorTracker, type PredictionSnapshot, type SkillKind } from "./bossAI";
import BossVfxCanvas, { type VfxBurst } from "./BossVfxCanvas";

export const BOSS_MAX_HP = 360;
const BAR_HP = 120;
const LANE_X = [17, 50, 83];
const LANE_NAMES = ["TRÁI", "GIỮA", "PHẢI"];

export type BossStats = {
  counters: number;
  bestCombo: number;
  misses: number;
  hpLeft: number;
  crits: number;
  maxAdapt: number;
};

type Props = {
  hp: number;
  maxHp: number;
  /** Tiến độ boss còn lại khi hồi sinh */
  startHp: number;
  onProgress: (hp: number) => void;
  onDamage: () => boolean;
  onHeal: (n: number) => void;
  onVictory: (stats: BossStats) => void;
};

type Skill = { kind: SkillKind; id: number; mode: "telegraph" | "active" | "counter"; aiLocked?: boolean };
type Feedback = { id: number; text: string; sub?: string; kind: "crit" | "perfect" | "good" | "bad" | "warn" };

const SKILL_INFO: Record<
  SkillKind,
  { name: string; tag: string; hint: string; counterHint?: string; color: string }
> = {
  gaze: {
    name: "TRỪNG PHẠT · NHÌN THẲNG",
    tag: "GAZE OF GOD",
    hint: "NÉ SANG LÀN AN TOÀN",
    color: "#ff4a2a",
  },
  laugh: {
    name: "CUỒNG TIẾNG CƯỜI",
    tag: "MADNESS ROAR",
    hint: "GIỮ ĐỂ KÍCH HOẠT KHIÊN",
    color: "#ffb03d",
  },
  fist: {
    name: "NẮM ĐẤM THẦN",
    tag: "DIVINE FIST",
    hint: "NHẤN ĐÚNG VÙNG SÁNG ĐỂ PHẢN CÔNG",
    color: "#ff2d6b",
  },
  judgment: {
    name: "PHÁN XÉT KÉP · ĐỌC VỊ",
    tag: "AI JUDGMENT",
    hint: "NÉ TIA PHÁN XÉT → PHẢN ĐÒN NGAY",
    counterHint: "PHẢN CÔNG CHỚP NHOÁNG! NHẤN [SPACE]",
    color: "#c04aff",
  },
};

const BOSS_FORMS = {
  calm: { eyes: [[43.0, 31.6], [56.5, 31.6]] as [number, number][], mouth: [50, 39.2] as [number, number] },
  rage: { eyes: [[41.9, 38.0], [58.5, 38.0]] as [number, number][], mouth: [50, 44.4] as [number, number] },
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function SkillGlyph({ kind, color }: { kind: SkillKind; color: string }) {
  if (kind === "gaze") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke={color} strokeWidth="2">
        <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6Z" />
        <circle cx="12" cy="12" r="2.8" fill={color} />
      </svg>
    );
  }
  if (kind === "laugh") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke={color} strokeWidth="2">
        <circle cx="12" cy="12" r="3" fill={color} />
        <path d="M7.5 7.5a6.5 6.5 0 0 1 9 0M5 5a10 10 0 0 1 14 0M7.5 16.5a6.5 6.5 0 0 0 9 0" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "judgment") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke={color} strokeWidth="2">
        <polygon points="12,2 21,12 12,22 3,12" />
        <circle cx="12" cy="12" r="3" fill={color} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke={color} strokeWidth="2">
      <path d="M13 2L4 14h7l-1 8 10-12h-7l0-8z" fill={color} />
    </svg>
  );
}

export default function BossFight({ hp, maxHp, startHp, onProgress, onDamage, onHeal, onVictory }: Props) {
  const [bossHp, setBossHp] = useState(startHp);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [danger, setDanger] = useState<number[]>([]);
  const [lane, setLane] = useState(1);
  const [holding, setHolding] = useState(false);
  const [gauge, setGauge] = useState(0);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [intro, setIntro] = useState(startHp >= BOSS_MAX_HP);
  const [enraged, setEnraged] = useState(startHp <= 240);
  const [phaseCut, setPhaseCut] = useState(false);
  const [finalCut, setFinalCut] = useState(false);
  const [dying, setDying] = useState(false);
  const [win, setWin] = useState(false);
  const [tapWindow, setTapWindow] = useState<{ id: number; dur: number; isCounter?: boolean } | null>(null);
  const [durs, setDurs] = useState({ tele: 860, active: 1400 });
  const [prediction, setPrediction] = useState<PredictionSnapshot>({
    predictedLane: 1,
    confidence: 0.35,
    reason: "ĐANG QUÉT MẪU DI CHUYỂN…",
    adaptRate: 35,
  });
  const [vfxBurst, setVfxBurst] = useState<VfxBurst | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [redKey, setRedKey] = useState(0);
  const [hitKey, setHitKey] = useState(0);

  const trackerRef = useRef(new PlayerBehaviorTracker());
  const laneRef = useRef(1);
  const holdRef = useRef(false);
  const gaugeRef = useRef(0);
  const hpRef = useRef(hp);
  const deadRef = useRef(false);
  const skillRef = useRef<Skill | null>(null);
  const startHpRef = useRef(startHp);
  const idRef = useRef(0);
  const threatStartRef = useRef(0);
  const fbTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tapResolver = useRef<((res: "perfect" | "good" | "miss") => void) | null>(null);
  const tapStartRef = useRef(0);
  const tapDurRef = useRef(1);
  const tapCounterRef = useRef(false);

  const sceneShake = useAnimationControls();
  const bossControls = useAnimationControls();

  useEffect(() => {
    skillRef.current = skill;
  }, [skill]);

  useEffect(() => {
    hpRef.current = hp;
    const dead = hp <= 0;
    deadRef.current = dead;
    if (dead) {
      tapResolver.current?.("miss");
      tapResolver.current = null;
    }
  }, [hp]);

  const shake = useCallback(
    (power = 10) => {
      sceneShake.start({
        x: [0, -power, power * 0.8, -power * 0.6, power * 0.35, 0],
        y: [0, power * 0.6, -power * 0.7, power * 0.4, -power * 0.2, 0],
        transition: { duration: 0.44, ease: "easeOut" },
      });
    },
    [sceneShake]
  );

  const showFb = useCallback((text: string, sub: string | undefined, kind: Feedback["kind"]) => {
    clearTimeout(fbTimer.current);
    setFeedback({ id: ++idRef.current, text, sub, kind });
    fbTimer.current = setTimeout(() => setFeedback(null), 1250);
  }, []);

  const triggerBurst = useCallback((type: VfxBurst["type"], extra?: { lane?: number; lanes?: number[] }) => {
    setVfxBurst({ id: ++idRef.current, type, ...extra });
  }, []);

  const setHold = useCallback((v: boolean) => {
    holdRef.current = v;
    setHolding(v);
  }, []);

  const moveTo = useCallback((target: number) => {
    const n = Math.max(0, Math.min(2, target));
    const old = laneRef.current;
    if (n === old) return;
    laneRef.current = n;
    setLane(n);
    const reaction = threatStartRef.current > 0 ? performance.now() - threatStartRef.current : undefined;
    trackerRef.current.recordMove(old, n, reaction);
    setPrediction(trackerRef.current.predict(n));
  }, []);

  const tapNow = useCallback(() => {
    const resolver = tapResolver.current;
    if (!resolver) return;
    tapResolver.current = null;
    const p = (performance.now() - tapStartRef.current) / tapDurRef.current;
    if (tapCounterRef.current) {
      if (p >= 0.36 && p <= 0.68) resolver("perfect");
      else if (p >= 0.24 && p <= 0.82) resolver("good");
      else resolver("miss");
    } else {
      if (p >= 0.49 && p <= 0.65) resolver("perfect");
      else if (p >= 0.38 && p <= 0.78) resolver("good");
      else resolver("miss");
    }
  }, []);

  // ---------- đồng hồ nội lực khi chịu đòn ----------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let painted = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const bracing = holdRef.current && skillRef.current?.kind === "laugh" && skillRef.current.mode === "active";
      const drainRate = bossHp <= 240 ? -92 : -72;
      const g = Math.max(0, Math.min(100, gaugeRef.current + (bracing ? 96 : drainRate) * dt));
      gaugeRef.current = g;
      if (Math.abs(g - painted) >= 1 || (g === 0 && painted !== 0) || (g === 100 && painted !== 100)) {
        painted = g;
        setGauge(g);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [bossHp]);

  // ---------- bàn phím ----------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.code === "Space" || k === "enter") {
        e.preventDefault();
        const s = skillRef.current;
        if (!s || deadRef.current) return;
        if ((s.kind === "fist" && s.mode === "active") || (s.kind === "judgment" && s.mode === "counter")) {
          tapNow();
        } else if (s.kind === "laugh" && s.mode === "active" && !holdRef.current) {
          setHold(true);
        }
        return;
      }
      if (k === "arrowleft" || k === "a") moveTo(laneRef.current - 1);
      else if (k === "arrowright" || k === "d") moveTo(laneRef.current + 1);
      else if (k === "1") moveTo(0);
      else if (k === "2") moveTo(1);
      else if (k === "3") moveTo(2);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        holdRef.current = false;
        setHolding(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [moveTo, setHold, tapNow]);

  // ---------- diễn biến trận đấu ----------
  useEffect(() => {
    let cancelled = false;
    let seqHp = startHpRef.current;
    let comboTrack = 0;
    let bestCombo = 0;
    let counters = 0;
    let misses = 0;
    let crits = 0;
    let maxAdapt = 35;
    let lastKind: SkillKind | null = null;
    let enrageShown = seqHp <= 240;
    let finalShown = seqHp <= 120;

    const alive = () => !cancelled && !deadRef.current && seqHp > 0;
    const wait = async (ms: number) => {
      await sleep(ms);
      return alive();
    };

    const resolveTap = (dur: number, isCounter = false) =>
      new Promise<"perfect" | "good" | "miss">((resolve) => {
        tapStartRef.current = performance.now();
        tapDurRef.current = dur;
        tapCounterRef.current = isCounter;
        const timer = setTimeout(() => {
          if (tapResolver.current) {
            tapResolver.current = null;
            resolve("miss");
          }
        }, dur);
        tapResolver.current = (res) => {
          clearTimeout(timer);
          resolve(res);
        };
      });

    (async () => {
      if (startHpRef.current >= BOSS_MAX_HP) {
        await sleep(2550);
        if (cancelled) return;
        setIntro(false);
        if (!(await wait(550))) return;
      } else {
        if (!(await wait(850))) return;
      }

      while (alive()) {
        const stage: 1 | 2 | 3 = seqHp > 240 ? 1 : seqHp > 120 ? 2 : 3;
        const speed = trackerRef.current.getSpeedMultiplier(stage);
        const kind = trackerRef.current.pickBossSkill(lastKind, stage);
        lastKind = kind;
        const id = ++idRef.current;

        const teleMs = Math.round((kind === "judgment" ? 780 : 840) * speed);
        const activeMs = Math.round(
          (kind === "fist" ? 1360 : kind === "laugh" ? 1500 : kind === "judgment" ? 1150 : 1280) * speed
        );
        setDurs({ tele: teleMs, active: activeMs });

        let dLanes: number[] = [];
        let snap = trackerRef.current.predict(laneRef.current);
        let aiLocked = false;

        if (kind === "gaze" || kind === "judgment") {
          const picked = trackerRef.current.pickTargetedLanes(laneRef.current, 2, stage === 1 ? 0.7 : 0.88);
          dLanes = picked.lanes;
          snap = picked.predicted;
          aiLocked = snap.confidence >= 0.45;
          setPrediction(snap);
          maxAdapt = Math.max(maxAdapt, snap.adaptRate);
          threatStartRef.current = performance.now();
        } else {
          trackerRef.current.recordStay(laneRef.current);
        }

        setDanger(dLanes);
        setSkill({ kind, id, mode: "telegraph", aiLocked });
        await bossControls.start({
          y: [0, -14, 0],
          scale: [1, 1.035, 1],
          transition: { duration: 0.48, ease: "easeOut" },
        });

        // Giai đoạn 3: Boss đọc vị hướng né sớm và đổi hướng mắt 1 lần (còn 680ms công bằng để phản ứng)
        if (kind === "gaze" && stage === 3 && Math.random() < 0.45) {
          if (!(await wait(Math.round(teleMs * 0.58)))) return;
          if (!dLanes.includes(laneRef.current)) {
            const retarget = trackerRef.current.pickTargetedLanes(laneRef.current, 2, 0.92);
            dLanes = retarget.lanes;
            setDanger(dLanes);
            setPrediction(retarget.predicted);
            threatStartRef.current = performance.now();
            showFb("ĐỌC VỊ!", "BOSS ĐỔI HƯỚNG TRỪNG PHẠT", "warn");
            shake(7);
            if (!(await wait(Math.round(680 * speed)))) return;
          } else {
            if (!(await wait(Math.round(teleMs * 0.42)))) return;
          }
        } else {
          if (!(await wait(teleMs))) return;
        }

        setSkill({ kind, id, mode: "active", aiLocked });
        if (kind === "gaze") shake(6);
        if (kind === "laugh") shake(12);
        if (kind === "fist") {
          setTapWindow({ id, dur: activeMs });
          shake(6);
        }
        if (kind === "judgment") shake(8);

        let hitOutcome: "crit" | "good" | "miss" = "miss";
        let dmgDealt = 0;
        let subLabel: string | undefined;

        if (kind === "gaze") {
          await sleep(activeMs);
          if (cancelled) return;
          triggerBurst("gazeImpact", { lanes: dLanes });
          const survived = !dLanes.includes(laneRef.current);
          shake(survived ? 8 : 18);
          if (survived) {
            const brokeRead = laneRef.current !== snap.predictedLane && aiLocked;
            hitOutcome = brokeRead ? "crit" : "good";
            dmgDealt = brokeRead ? 50 : 40;
            subLabel = brokeRead ? `PHÁ ĐỌC VỊ! · -${dmgDealt} HP` : `-${dmgDealt} HP`;
          }
          trackerRef.current.recordSkill("gaze", survived);
          await sleep(220);
        } else if (kind === "laugh") {
          await sleep(activeMs);
          if (cancelled) return;
          const ok = holdRef.current && gaugeRef.current >= 50;
          if (ok) {
            const fullShield = gaugeRef.current >= 85;
            hitOutcome = fullShield ? "crit" : "good";
            dmgDealt = fullShield ? 58 : 45;
            subLabel = fullShield ? `NỘI LỰC TUYỆT ĐỐI! · -${dmgDealt} HP` : `-${dmgDealt} HP`;
          }
          trackerRef.current.recordSkill("laugh", ok);
          shake(ok ? 9 : 16);
        } else if (kind === "fist") {
          const tapRes = await resolveTap(activeMs, false);
          if (cancelled) return;
          hitOutcome = tapRes === "perfect" ? "crit" : tapRes;
          if (tapRes === "perfect") {
            dmgDealt = 65;
            subLabel = `CHÍ MẠNG! · -${dmgDealt} HP`;
          } else if (tapRes === "good") {
            dmgDealt = 45;
            subLabel = `-${dmgDealt} HP`;
          }
          trackerRef.current.recordSkill("fist", tapRes !== "miss");
          shake(tapRes === "perfect" ? 18 : tapRes === "good" ? 12 : 15);
        } else {
          // judgment: né làn đọc vị -> phản công chớp nhoáng
          await sleep(activeMs);
          if (cancelled) return;
          triggerBurst("gazeImpact", { lanes: dLanes });
          const dodged = !dLanes.includes(laneRef.current);
          if (!dodged) {
            hitOutcome = "miss";
            trackerRef.current.recordSkill("judgment", false);
          } else {
            const counterDur = Math.round(920 * speed);
            setDurs((d) => ({ ...d, active: counterDur }));
            setDanger([]);
            setSkill({ kind: "judgment", id, mode: "counter", aiLocked });
            setTapWindow({ id: id + 1, dur: counterDur, isCounter: true });
            const tapRes = await resolveTap(counterDur, true);
            if (cancelled) return;
            hitOutcome = tapRes === "perfect" ? "crit" : tapRes;
            if (tapRes === "perfect") {
              dmgDealt = 65;
              subLabel = `PHÁ PHÁN XÉT! · -${dmgDealt} HP`;
            } else if (tapRes === "good") {
              dmgDealt = 50;
              subLabel = `-${dmgDealt} HP`;
            }
            trackerRef.current.recordSkill("judgment", tapRes !== "miss");
            shake(tapRes !== "miss" ? 16 : 14);
          }
        }

        threatStartRef.current = 0;
        setSkill(null);
        setTapWindow(null);
        setDanger([]);
        setHold(false);
        if (!alive()) return;

        if (hitOutcome !== "miss") {
          seqHp = Math.max(0, seqHp - dmgDealt);
          counters += 1;
          if (hitOutcome === "crit") crits += 1;
          comboTrack += 1;
          bestCombo = Math.max(bestCombo, comboTrack);
          setBossHp(seqHp);
          onProgress(seqHp);
          setCombo(comboTrack);

          triggerBurst(hitOutcome === "crit" ? "crit" : "slash");
          setFlashKey((k) => k + 1);
          setHitKey((k) => k + 1);

          await bossControls.start({
            x: [0, -10, 8, -4, 0],
            filter: ["brightness(2.2)", "brightness(1)"],
            transition: { duration: 0.28 },
          });

          showFb(
            hitOutcome === "crit" ? "CHÍ MẠNG!" : "PHẢN CÔNG!",
            comboTrack >= 2 ? `${comboTrack} COMBO · ${subLabel}` : subLabel,
            hitOutcome === "crit" ? "crit" : "perfect"
          );

          if (seqHp <= 0) {
            setDying(true);
            triggerBurst("phase");
            await sleep(1200);
            if (cancelled) return;
            setDying(false);
            setWin(true);
            setFlashKey((k) => k + 1);
            await sleep(2500);
            if (!cancelled) onVictory({ counters, bestCombo, misses, hpLeft: hpRef.current, crits, maxAdapt });
            return;
          }

          // Phá vỡ một thanh máu (240 hoặc 120)
          const crossedBar =
            (seqHp <= 240 && !enrageShown) || (seqHp <= 120 && !finalShown);
          if (crossedBar) {
            onHeal(1);
            showFb("PHÁ KHIÊN!", "+1 HP · BOSS CHOÁNG", "good");
            triggerBurst("phase");
            shake(20);
            setRedKey((k) => k + 1);
            await sleep(1100);
            if (!alive()) return;

            if (seqHp <= 240 && !enrageShown) {
              enrageShown = true;
              setEnraged(true);
              setPhaseCut(true);
              setRedKey((k) => k + 1);
              shake(22);
              await sleep(1900);
              setPhaseCut(false);
            } else if (seqHp <= 120 && !finalShown) {
              finalShown = true;
              setFinalCut(true);
              setRedKey((k) => k + 1);
              shake(26);
              await sleep(2100);
              setFinalCut(false);
            }
          }
        } else {
          comboTrack = 0;
          misses += 1;
          setCombo(0);
          if (deadRef.current) return;
          const applied = onDamage();
          triggerBurst("playerHit", { lane: laneRef.current });
          setHitKey((k) => k + 1);
          shake(22);
          showFb(applied ? "TRÚNG ĐÒN!" : "SUÝT TRÚNG!", applied ? "-1 HP" : "MIỄN THƯƠNG", "bad");
        }

        if (!alive()) return;
        await sleep(740);
      }
    })();

    return () => {
      cancelled = true;
      tapResolver.current?.("miss");
      tapResolver.current = null;
    };
  }, [bossControls, onDamage, onHeal, onProgress, onVictory, sceneShake, setHold, shake, showFb, triggerBurst]);

  const stage = bossHp > 240 ? 1 : bossHp > 120 ? 2 : 3;
  const form = enraged ? BOSS_FORMS.rage : BOSS_FORMS.calm;
  const activeSkill = skill && skill.mode !== "telegraph" ? skill : null;
  const info = skill ? SKILL_INFO[skill.kind] : null;

  const onStagePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (deadRef.current) return;
    const s = skillRef.current;
    if (!s) return;
    if ((s.kind === "fist" && s.mode === "active") || (s.kind === "judgment" && s.mode === "counter")) {
      tapNow();
    } else if (s.kind === "gaze" || (s.kind === "judgment" && s.mode !== "counter")) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      moveTo(x < 1 / 3 ? 0 : x < 2 / 3 ? 1 : 2);
    }
  };

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-[#040208] select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9 }}
    >
      <motion.div className="absolute inset-0" animate={sceneShake}>
        {/* ====== Bối cảnh đấu trường ====== */}
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.18, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 3.2, ease: "easeOut" }}
        >
          <img
            src={bossArena}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
            style={{
              filter: enraged
                ? "saturate(1.45) hue-rotate(-14deg) brightness(0.75) contrast(1.12)"
                : "saturate(0.85) brightness(0.55) contrast(1.08)",
              transition: "filter 2.4s ease",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#04020a]/85 via-transparent to-[#04020a]/95" />
          <div
            className="absolute inset-0 transition-opacity duration-[2000ms]"
            style={{
              opacity: enraged ? 1 : 0.45,
              background:
                "radial-gradient(ellipse at 50% 60%, rgba(255,44,24,.28), transparent 58%), radial-gradient(ellipse at 50% 10%, rgba(95,20,140,.35), transparent 65%)",
            }}
          />
        </motion.div>

        {/* vòng trận pháp dưới sàn */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] overflow-hidden">
          <div
            className="rune-spin absolute left-1/2 top-[18%] h-[74vh] w-[74vh] -translate-x-1/2 rounded-full border border-red-500/25"
            style={{ boxShadow: "0 0 70px rgba(255,40,20,.18) inset, 0 0 50px rgba(255,40,20,.12)" }}
          />
          <div className="rune-spin-rev absolute left-1/2 top-[24%] h-[58vh] w-[58vh] -translate-x-1/2 rounded-full border border-dashed border-sky-400/25" />
          <div
            className="absolute left-1/2 top-[32%] h-[44vh] w-[44vh] -translate-x-1/2 rounded-full border border-violet-400/25"
            style={{ background: "radial-gradient(circle, rgba(120,40,255,.15), transparent 68%)" }}
          />
        </div>

        {/* tàn lửa nhẹ */}
        <div className="pointer-events-none absolute inset-0 z-[4] opacity-75">
          <RainCanvas rain={false} intensity={1.2} />
        </div>

        {/* ====== Boss ====== */}
        <motion.div
          className="absolute left-1/2 z-10"
          style={{ bottom: "19%", height: "min(78svh, 118vw)", aspectRatio: "768 / 1376", x: "-50%" }}
          initial={{ opacity: 0, y: "9%", scale: 1.12 }}
          animate={
            dying
              ? { opacity: 0, y: "14%", scale: 0.92, filter: "brightness(2.6) blur(8px)" }
              : { opacity: 1, y: 0, scale: 1, filter: "brightness(1)" }
          }
          transition={dying ? { duration: 1 } : { duration: 2.2, ease: "easeOut" }}
        >
          <motion.div className="relative h-full w-full" animate={bossControls}>
            {/* hào quang sau lưng */}
            <div
              className="boss-aura absolute left-1/2 top-[26%] h-[68%] w-[136%] -translate-x-1/2 rounded-[50%] blur-2xl"
              style={{
                background: enraged
                  ? "radial-gradient(ellipse, rgba(255,42,20,.55), rgba(130,0,25,.25) 55%, transparent 74%)"
                  : "radial-gradient(ellipse, rgba(70,155,255,.38), rgba(75,40,170,.2) 55%, transparent 74%)",
              }}
            />
            <img
              src={enraged ? bossEnrage : bossIdle}
              alt="Tượng thần mỉm cười"
              draggable={false}
              className="boss-breath relative h-full w-full object-contain"
              style={{
                mixBlendMode: "screen",
                filter: enraged
                  ? "drop-shadow(0 0 55px rgba(255,55,25,.6)) contrast(1.08)"
                  : "drop-shadow(0 0 50px rgba(95,180,255,.5)) contrast(1.06)",
                WebkitMaskImage:
                  "linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 10%, #000 72%, transparent 94%)",
                WebkitMaskComposite: "source-in",
                maskImage:
                  "linear-gradient(to right, transparent 0%, #000 12%, #000 88%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 10%, #000 72%, transparent 94%)",
                maskComposite: "intersect",
                transition: "filter 2s ease",
              }}
            />
            {/* mắt phát sáng */}
            {form.eyes.map(([ex, ey], i) => (
              <div
                key={i}
                className={`absolute rounded-full mix-blend-screen ${activeSkill ? "" : "eye-burn"}`}
                style={{
                  left: `${ex}%`,
                  top: `${ey}%`,
                  width: skill?.kind === "gaze" || skill?.kind === "judgment" ? "15%" : "8%",
                  height: skill?.kind === "gaze" || skill?.kind === "judgment" ? "3.2%" : "2.1%",
                  transform: "translate(-50%,-50%)",
                  background:
                    skill?.kind === "judgment"
                      ? "radial-gradient(ellipse, #fff 0%, #d946ef 35%, rgba(180,30,255,.5) 60%, transparent 80%)"
                      : skill?.kind === "gaze"
                      ? "radial-gradient(ellipse, #fff 0%, rgba(255,80,40,1) 30%, rgba(255,0,0,.55) 55%, transparent 78%)"
                      : "radial-gradient(ellipse, rgba(255,95,60,1), rgba(255,20,20,.65) 42%, transparent 76%)",
                  boxShadow:
                    skill?.kind === "gaze" || skill?.kind === "judgment"
                      ? "0 0 55px 16px rgba(255,50,20,.9)"
                      : "0 0 24px 6px rgba(255,40,20,.55)",
                  filter: "blur(1px)",
                  transition: "all .28s",
                }}
              />
            ))}
            {/* miệng cười */}
            <div
              className="absolute rounded-full mix-blend-screen"
              style={{
                left: `${form.mouth[0]}%`,
                top: `${form.mouth[1]}%`,
                width: enraged ? "22%" : "18%",
                height: "3.4%",
                transform: "translate(-50%,-50%)",
                background: enraged
                  ? "radial-gradient(ellipse, rgba(255,150,60,.85), rgba(255,50,20,.35) 55%, transparent 78%)"
                  : "radial-gradient(ellipse, rgba(160,210,255,.55), rgba(80,140,255,.22) 55%, transparent 78%)",
                filter: "blur(4px)",
                opacity: skill?.kind === "laugh" ? 1 : 0.45,
                transition: "all .35s",
              }}
            />
          </motion.div>
        </motion.div>

        {/* ====== Làn chỉ dẫn sạch đẹp dưới sàn ====== */}
        {(skill?.kind === "gaze" || (skill?.kind === "judgment" && skill.mode !== "counter")) &&
          [0, 1, 2].map((i) => {
            const isDanger = danger.includes(i);
            const isPred = prediction.predictedLane === i && prediction.confidence >= 0.48;
            return (
              <div
                key={`floor-${i}`}
                className="pointer-events-none absolute bottom-0 z-[13] h-[24%] w-[28%] -translate-x-1/2"
                style={{ left: `${LANE_X[i]}%` }}
              >
                <div
                  className="absolute inset-x-2 bottom-3 h-20 rounded-xl border transition-all duration-200"
                  style={{
                    borderColor: isDanger
                      ? skill.kind === "judgment"
                        ? "rgba(216,70,239,0.75)"
                        : "rgba(255,70,45,0.75)"
                      : "rgba(79,168,255,0.65)",
                    background: isDanger
                      ? skill.kind === "judgment"
                        ? "radial-gradient(ellipse at 50% 60%, rgba(192,38,211,0.32), transparent 72%)"
                        : "radial-gradient(ellipse at 50% 60%, rgba(255,45,25,0.34), transparent 72%)"
                      : "radial-gradient(ellipse at 50% 60%, rgba(79,168,255,0.22), transparent 72%)",
                    boxShadow: isDanger
                      ? "0 0 28px rgba(255,40,20,0.45), inset 0 0 24px rgba(255,40,20,0.25)"
                      : "0 0 24px rgba(79,168,255,0.35), inset 0 0 20px rgba(79,168,255,0.18)",
                  }}
                >
                  <div className="flex h-full flex-col items-center justify-center">
                    <span
                      className={`font-sys text-[9px] font-bold tracking-[0.26em] sm:text-[10px] ${
                        isDanger ? "text-red-200" : "text-sky-200"
                      }`}
                    >
                      {isDanger ? (isPred ? "BẮT BÀI!" : "NGUY HIỂM") : "AN TOÀN"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

        {/* ====== Canvas VFX 60fps ====== */}
        <BossVfxCanvas
          skill={skill}
          danger={danger}
          lane={lane}
          holding={holding}
          enraged={enraged}
          burst={vfxBurst}
          eyeCoords={form.eyes}
          mouthCoord={form.mouth}
        />

        {/* ====== Người chơi ====== */}
        <motion.div
          className="absolute z-20"
          style={{ height: "min(30svh, 46vw)", aspectRatio: "2/3", x: "-50%", bottom: "3%" }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0, left: `${LANE_X[lane]}%` }}
          transition={{
            left: { type: "spring", stiffness: 520, damping: 32 },
            opacity: { duration: 0.8 },
            y: { duration: 0.8 },
          }}
        >
          <div
            className="absolute -inset-x-1/3 bottom-0 h-1/2 rounded-[50%] blur-xl"
            style={{
              background: holding
                ? "radial-gradient(ellipse, rgba(255,190,90,.55), transparent 70%)"
                : "radial-gradient(ellipse, rgba(110,95,255,.5), transparent 70%)",
            }}
          />
          <motion.img
            src={holding ? heroKneel : heroStand}
            alt="Người chơi"
            draggable={false}
            className="relative h-full w-full object-contain"
            animate={{
              y: holding ? "1.5%" : 0,
              filter: holding
                ? "drop-shadow(0 0 22px rgba(255,190,90,.9))"
                : "drop-shadow(0 0 18px rgba(110,160,255,.85))",
            }}
            transition={{ duration: 0.25 }}
          />
        </motion.div>

        {/* ====== HUD ====== */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 px-3 pt-3 sm:px-6 sm:pt-4">
          {/* người chơi */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div
              className="h-9 w-9 rounded-full border border-sky-400/80 shadow-[0_0_16px_rgba(79,168,255,.8)] sm:h-12 sm:w-12"
              style={{ backgroundImage: `url(${avatar})`, backgroundSize: "260%", backgroundPosition: "58% 20%" }}
            />
            <div>
              <div className="font-sys text-[8px] font-bold tracking-[0.16em] text-sky-200 text-glow sm:text-[10px] sm:tracking-[0.2em]">
                SUNG JIN WOO
              </div>
              <div className="mt-1 flex gap-1">
                {Array.from({ length: maxHp }).map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 w-5 skew-x-[-20deg] transition-all duration-300 sm:w-8"
                    style={{
                      background: i < hp ? "linear-gradient(90deg,#4fa8ff,#a855ff)" : "rgba(255,255,255,.12)",
                      boxShadow: i < hp ? "0 0 10px #4fa8ff" : "none",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* boss */}
          <div className="min-w-0 flex-1 px-1 text-center sm:max-w-md">
            <div className="font-sys text-[8px] tracking-[0.26em] text-red-300/90 sm:text-[10px]">
              BOSS · CẤP SSS
            </div>
            <div
              className="mt-0.5 font-sys text-[10px] font-black leading-tight tracking-[0.06em] text-white sm:text-base sm:tracking-[0.16em]"
              style={{ textShadow: "0 0 16px #ff2a10, 0 0 40px rgba(255,0,0,.7)" }}
            >
              TƯỢNG THẦN MỈM CƯỜI
            </div>
            <div className="mt-1.5 space-y-1">
              {[0, 1, 2].map((i) => {
                const fill = clamp01((bossHp - (2 - i) * BAR_HP) / BAR_HP);
                const broken = fill <= 0;
                return (
                  <div
                    key={`${i}-${hitKey}`}
                    className={`relative h-2 overflow-hidden border border-red-500/40 bg-red-950/65 sm:h-2.5 ${hitKey ? "boss-bar-hit" : ""}`}
                    style={{ clipPath: "polygon(0 0, 100% 0, calc(100% - 6px) 100%, 6px 100%)" }}
                  >
                    <motion.div
                      className="h-full"
                      animate={{ width: `${fill * 100}%` }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      style={{
                        background:
                          i === 2
                            ? "linear-gradient(90deg,#ff2d1a,#ffb03d)"
                            : i === 1
                            ? "linear-gradient(90deg,#ff3b2f,#ff8a3d)"
                            : "linear-gradient(90deg,#ff5a3a,#ffd0a0)",
                        boxShadow: "0 0 14px rgba(255,60,30,.9)",
                      }}
                    />
                    {!broken && (
                      <div
                        className="pointer-events-none absolute inset-0 opacity-30"
                        style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 18px, rgba(0,0,0,.8) 18px 20px)" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 font-sys text-[8px] tracking-[0.18em] text-red-100/90 sm:text-[10px]">
              <span>PHA {stage} / 3</span>
              <span className="text-red-400">◆</span>
              <span>{Math.max(0, bossHp)} / {BOSS_MAX_HP}</span>
            </div>
            {/* Chỉ báo AI đọc vị */}
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-sm border border-violet-400/35 bg-[#12061e]/80 px-2 py-0.5 font-sys text-[7px] tracking-[0.16em] text-violet-200 backdrop-blur-sm sm:text-[8px]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  prediction.adaptRate >= 60 ? "animate-ping bg-red-400" : "bg-violet-400"
                }`}
              />
              <span>AI ĐỌC VỊ {prediction.adaptRate}%</span>
              <span className="hidden text-violet-300/60 sm:inline">· {prediction.reason}</span>
              <span className="text-amber-300">[{LANE_NAMES[prediction.predictedLane]}]</span>
            </div>
          </div>

          {/* combo */}
          <div className="min-w-[52px] shrink-0 text-right sm:min-w-[90px]">
            <div className="font-sys text-[8px] tracking-[0.25em] text-violet-300/80">COMBO</div>
            <div key={combo} className={`font-sys text-xl font-black text-white sm:text-3xl ${combo >= 2 ? "combo-pop" : ""}`}>
              <span style={{ textShadow: "0 0 18px #a855ff" }}>×{combo}</span>
            </div>
            <div className="mt-0.5 font-sys text-[8px] tracking-[0.2em] text-sky-300/60">HỒNG NGỤC</div>
          </div>
        </div>

        {/* ====== Thẻ kỹ năng ====== */}
        <AnimatePresence>
          {skill && info && (
            <motion.div
              key={`card-${skill.id}-${skill.mode === "counter" ? "c" : "a"}`}
              className="pointer-events-none absolute left-1/2 top-[20.5%] z-40 w-[92%] max-w-sm -translate-x-1/2 px-2 sm:left-6 sm:top-[25%] sm:w-[21.5rem] sm:max-w-none sm:translate-x-0"
              initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
              transition={{ duration: 0.26 }}
            >
              <div
                className="sys-cut relative overflow-hidden border px-4 py-2.5 backdrop-blur-md"
                style={{
                  borderColor: `${info.color}88`,
                  background: "linear-gradient(180deg, rgba(20,5,12,.88), rgba(6,2,8,.94))",
                  boxShadow: `0 0 32px ${info.color}45, inset 0 0 32px ${info.color}18`,
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-[2px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${info.color}, transparent)` }}
                />
                <div className="flex items-center justify-between gap-2 font-sys text-[8px] tracking-[0.24em]" style={{ color: info.color }}>
                  <div className="flex items-center gap-1.5">
                    <SkillGlyph kind={skill.kind} color={info.color} />
                    <span>KỸ NĂNG BOSS</span>
                  </div>
                  {skill.aiLocked ? (
                    <span className="border border-red-400/50 bg-red-950/60 px-1.5 py-0.5 text-[7px] text-red-200">
                      AI ĐỌC VỊ
                    </span>
                  ) : (
                    <span className="opacity-60">{info.tag}</span>
                  )}
                </div>
                <div
                  className="mt-1 font-sys text-[12px] font-black tracking-[0.06em] text-white sm:text-[15px]"
                  style={{ textShadow: `0 0 16px ${info.color}` }}
                >
                  {info.name}
                </div>
                <div className="mt-1 text-[9px] font-semibold leading-tight tracking-[0.1em] text-white/85 sm:text-[10px]">
                  ▸{" "}
                  {skill.mode === "counter" && info.counterHint
                    ? info.counterHint
                    : skill.mode === "telegraph"
                    ? `CHUẨN BỊ · ${info.hint}`
                    : info.hint}
                </div>
                <div className="mt-2 h-[3px] w-full overflow-hidden bg-white/10">
                  <motion.div
                    key={`${skill.id}-${skill.mode}`}
                    className="h-full origin-left"
                    style={{ background: info.color, boxShadow: `0 0 12px ${info.color}` }}
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: 0 }}
                    transition={{
                      duration: (skill.mode === "telegraph" ? durs.tele : durs.active) / 1000,
                      ease: "linear",
                    }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ====== Phản hồi ====== */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              key={feedback.id}
              className="pointer-events-none absolute inset-x-0 top-[39%] z-40 text-center"
              initial={{ opacity: 0, scale: 0.55, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: -6 }}
              exit={{ opacity: 0, scale: 1.1, y: -32 }}
              transition={{ duration: 0.25 }}
            >
              <div
                className="font-sys text-2xl font-black tracking-[0.18em] sm:text-4xl"
                style={{
                  color:
                    feedback.kind === "bad"
                      ? "#ff5a5a"
                      : feedback.kind === "warn"
                      ? "#e879f9"
                      : feedback.kind === "crit" || feedback.kind === "good"
                      ? "#ffd86b"
                      : "#9ad4ff",
                  textShadow:
                    feedback.kind === "bad"
                      ? "0 0 24px #f00, 0 0 60px #900"
                      : feedback.kind === "warn"
                      ? "0 0 24px #c026d3, 0 0 60px #701a75"
                      : feedback.kind === "crit" || feedback.kind === "good"
                      ? "0 0 24px #ffb300, 0 0 60px #ff6a00"
                      : "0 0 24px #4fa8ff, 0 0 60px #6a5cff",
                }}
              >
                {feedback.text}
              </div>
              {feedback.sub && (
                <div className="mt-1 font-sys text-[9px] tracking-[0.3em] text-white/80 sm:text-[11px]">{feedback.sub}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ====== Thanh nhịp NẮM ĐẤM THẦN / PHẢN ĐÒN ====== */}
        <AnimatePresence>
          {tapWindow && (
            <motion.div
              className="pointer-events-none absolute inset-x-0 bottom-[31%] z-40 px-5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="mx-auto max-w-sm">
                <div className="sys-panel-danger sys-cut px-3.5 py-2.5">
                  <div className="mb-1.5 flex items-center justify-between font-sys text-[8px] tracking-[0.25em]">
                    <span className="text-red-200/90">
                      {tapWindow.isCounter ? "PHẢN ĐÒN PHÁN XÉT" : "NHỊP PHẢN CÔNG"}
                    </span>
                    <span className="animate-pulse text-amber-300">NHẤN [SPACE] / CHẠM</span>
                  </div>
                  <div className="relative h-5 overflow-hidden border border-red-400/50 bg-red-950/75">
                    {/* Vùng GOOD */}
                    <div
                      className="absolute inset-y-0"
                      style={{
                        left: tapWindow.isCounter ? "24%" : "38%",
                        width: tapWindow.isCounter ? "58%" : "40%",
                        background: "rgba(79,168,255,0.22)",
                        borderLeft: "1px solid rgba(124,196,255,0.5)",
                        borderRight: "1px solid rgba(124,196,255,0.5)",
                      }}
                    />
                    {/* Vùng PERFECT */}
                    <div
                      className="zone-glow absolute inset-y-0 flex items-center justify-center"
                      style={{
                        left: tapWindow.isCounter ? "36%" : "49%",
                        width: tapWindow.isCounter ? "32%" : "16%",
                        background:
                          "linear-gradient(90deg, rgba(255,170,50,.35), rgba(255,225,120,.95), rgba(255,170,50,.35))",
                        boxShadow: "0 0 26px rgba(255,190,70,.95)",
                      }}
                    >
                      <span className="font-sys text-[7px] font-black tracking-[0.08em] text-[#3a1500]">CRIT</span>
                    </div>
                    <motion.div
                      className="absolute inset-y-0 w-[3px] bg-white"
                      style={{ boxShadow: "0 0 16px 4px #fff" }}
                      initial={{ left: "0%" }}
                      animate={{ left: "100%" }}
                      transition={{ duration: tapWindow.dur / 1000, ease: "linear" }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ====== Điều khiển ====== */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex flex-col items-center gap-2 px-4">
          {activeSkill?.kind === "laugh" ? (
            <>
              <div className="w-full max-w-xs">
                <div className="mb-1 flex justify-between font-sys text-[8px] tracking-[0.26em] text-amber-200/90">
                  <span>NỘI LỰC KHIÊN (≥50% ĐỠ · ≥85% CHÍ MẠNG)</span>
                  <span>{Math.floor(gauge)}%</span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full border border-amber-400/40 bg-amber-950/60">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-white/60" />
                  <div className="absolute inset-y-0 left-[85%] w-px bg-amber-200" />
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-amber-300 to-red-400 shadow-[0_0_14px_#ffae42] transition-[width] duration-75"
                    style={{ width: `${gauge}%` }}
                  />
                </div>
              </div>
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setHold(true);
                }}
                onPointerUp={() => setHold(false)}
                onPointerCancel={() => setHold(false)}
                className={`pointer-events-auto touch-none border px-7 py-2.5 font-sys text-[10px] font-bold tracking-[0.3em] transition sm:text-xs ${
                  holding
                    ? "scale-95 border-amber-200 bg-amber-500/40 text-white shadow-[0_0_36px_rgba(255,180,70,.9)]"
                    : "border-amber-400/60 bg-amber-950/60 text-amber-100"
                }`}
              >
                {holding ? "ĐANG BẬT KHIÊN…" : "GIỮ ĐỂ BẬT KHIÊN"}
              </button>
            </>
          ) : (activeSkill?.kind === "fist" && activeSkill.mode === "active") ||
            (activeSkill?.kind === "judgment" && activeSkill.mode === "counter") ? (
            <button
              onPointerDown={tapNow}
              className="press-pulse pointer-events-auto touch-none border border-red-400 bg-red-500/25 px-9 py-2.5 font-sys text-[10px] font-bold tracking-[0.32em] text-white backdrop-blur-sm sm:text-xs"
            >
              PHẢN CÔNG · [SPACE]
            </button>
          ) : skill?.kind === "gaze" || (skill?.kind === "judgment" && skill.mode !== "counter") ? (
            <div className="font-sys text-[9px] tracking-[0.26em] text-red-200/90">
              ◀ ▶ / A · D — CHẠM VÀO LÀN AN TOÀN
            </div>
          ) : (
            <div className="font-sys text-[9px] tracking-[0.3em] text-white/40">BOSS ĐANG QUAN SÁT BƯỚC DI CHUYỂN…</div>
          )}
        </div>

        {/* ====== Lớp phủ hiệu ứng ====== */}
        <div
          className="pointer-events-none absolute inset-0 z-[15]"
          style={{ background: "radial-gradient(ellipse at 50% 55%, transparent 42%, rgba(255,20,10,.22) 100%)" }}
        />
        <div className="pointer-events-none absolute inset-0 z-[17] shadow-[inset_0_0_220px_rgba(0,0,0,.95)]" />
        <div
          className="pointer-events-none absolute inset-0 z-[17] opacity-[0.04]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 3px)" }}
        />

        {/* flash / đòn đánh */}
        <div
          key={`f-${flashKey}`}
          className={`pointer-events-none absolute inset-0 z-[26] bg-white mix-blend-screen ${flashKey ? "white-bloom" : "opacity-0"}`}
        />
        <div
          key={`r-${redKey}`}
          className={`pointer-events-none absolute inset-0 z-[26] ${redKey ? "red-bloom" : "opacity-0"}`}
          style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(255,40,20,.55), rgba(120,0,0,.85))" }}
        />
        <div
          key={`h-${hitKey}`}
          className={`pointer-events-none absolute inset-0 z-[26] ${hitKey ? "hit-flash" : "opacity-0"}`}
          style={{ boxShadow: "inset 0 0 170px 40px rgba(255,0,0,.9)", background: "rgba(255,0,0,.16)" }}
        />
      </motion.div>

      {/* vùng chạm né / phản công */}
      <div className="absolute inset-x-0 bottom-0 top-[46%] z-[27] touch-none" onPointerDown={onStagePointer} />

      {/* ====== Intro boss ====== */}
      <AnimatePresence>
        {intro && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#04020a]/95 px-5 text-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="pointer-events-none absolute inset-0 opacity-55">
              <motion.img
                src={bossIdle}
                alt=""
                className="h-full w-full object-cover object-[50%_26%]"
                initial={{ scale: 1.35, opacity: 0 }}
                animate={{ scale: 1.05, opacity: 0.65 }}
                transition={{ duration: 3.2, ease: "easeOut" }}
                style={{ mixBlendMode: "screen", filter: "saturate(.8) brightness(1)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#04020a] via-[#04020a]/55 to-[#04020a]/30" />
            </div>

            <motion.div
              className="relative z-10 flex flex-col items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9 }}
            >
              <div className="font-sys text-[9px] tracking-[0.5em] text-red-400/90 sm:text-[11px]">
                [ HỆ THỐNG · CẢNH BÁO CỰC ĐỘ ]
              </div>
              <div className="mt-3 h-px w-40 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
              <div className="mt-4 font-sys text-[10px] tracking-[0.4em] text-red-200/75 sm:text-xs">
                SINH VẬT CẤP SSS ĐÃ XUẤT HIỆN
              </div>
              <h2
                className="boss-glitch mt-3 font-sys text-3xl font-black tracking-[0.14em] text-white sm:text-6xl"
                style={{ textShadow: "0 0 24px #ff2d1a, 0 0 70px #7a0000" }}
              >
                TƯỢNG THẦN
                <br />
                MỈM CƯỜI
              </h2>
              <motion.p
                className="mt-4 max-w-md text-xs leading-relaxed text-red-100/75 sm:text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 1 }}
              >
                “Ta nhìn thấu từng bước chạy trốn của ngươi. Hãy xem ngươi trụ được bao lâu.”
              </motion.p>
              <motion.div
                className="mt-5 flex items-center gap-2 font-sys text-[9px] tracking-[0.3em] text-amber-300/90"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 0.8 }}
              >
                <span className="h-1.5 w-1.5 animate-pulse bg-red-500" />
                NÉ · CHỊU ĐÒN · PHẢN CÔNG · PHÁ ĐỌC VỊ
              </motion.div>
            </motion.div>

            <div className="absolute inset-x-0 top-0 h-[7%] bg-black" />
            <div className="absolute inset-x-0 bottom-0 h-[7%] bg-black" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== Cutscene cuồng nộ ====== */}
      <AnimatePresence>
        {phaseCut && (
          <motion.div
            className="absolute inset-0 z-[48] flex items-center justify-center overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <motion.div
              className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,50,20,.55),rgba(40,0,0,.96)_70%)]"
              initial={{ scale: 0.4 }}
              animate={{ scale: 1.5 }}
              transition={{ duration: 1.8, ease: "easeOut" }}
            />
            <motion.div
              className="relative text-center"
              initial={{ scale: 2.4, opacity: 0, filter: "blur(24px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.7, ease: [0.2, 0.9, 0.2, 1] }}
            >
              <div className="font-sys text-[10px] tracking-[0.5em] text-amber-300">PHA 2 · MỞ KHÓA PHÁN XÉT KÉP</div>
              <div
                className="mt-2 font-sys text-4xl font-black tracking-[0.16em] text-white sm:text-7xl"
                style={{ textShadow: "0 0 30px #ff2a10, 0 0 90px #900" }}
              >
                CUỒNG NỘ
              </div>
              <div className="mt-3 font-sys text-[10px] tracking-[0.35em] text-red-200/85">
                AI ĐỌC VỊ TĂNG TỐC · TỨ THỦ THỨC TỈNH
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== Điệu cười tử thần (pha cuối) ====== */}
      <AnimatePresence>
        {finalCut && (
          <motion.div
            className="absolute inset-0 z-[48] flex items-center justify-center overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.img
              src={bossEnrage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-top"
              initial={{ scale: 1.05, filter: "brightness(.6) blur(0px)" }}
              animate={{ scale: 1.45, filter: "brightness(.95) contrast(1.15)" }}
              transition={{ duration: 2.4, ease: "easeInOut" }}
              style={{ mixBlendMode: "screen" }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,transparent_25%,rgba(60,0,0,.85)_75%)]" />
            <motion.div
              className="relative z-10 px-6 text-center"
              initial={{ opacity: 0, scale: 1.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, duration: 0.9 }}
            >
              <div className="font-sys text-[9px] tracking-[0.5em] text-red-300 sm:text-[11px]">KỸ NĂNG TỐI THƯỢNG</div>
              <div
                className="boss-glitch mt-2 font-sys text-3xl font-black tracking-[0.14em] text-white sm:text-6xl"
                style={{ textShadow: "0 0 26px #ff2a10, 0 0 80px #900" }}
              >
                ĐIỆU CƯỜI TỬ THẦN
              </div>
              <div className="mx-auto mt-3 h-px w-40 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
              <div className="mt-3 font-sys text-[9px] tracking-[0.32em] text-red-100/80">
                THANH MÁU CUỐI · CẨN THẬN ĐÒN ĐỔI HƯỚNG
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== Boss gục ngã ====== */}
      <AnimatePresence>
        {win && (
          <motion.div
            className="absolute inset-0 z-[49] flex flex-col items-center justify-center bg-black/70 px-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="white-bloom pointer-events-none absolute inset-0 bg-white mix-blend-screen" />
            <motion.div
              initial={{ scale: 1.6, opacity: 0, filter: "blur(18px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              transition={{ delay: 0.2, duration: 0.9 }}
            >
              <div className="font-sys text-[10px] tracking-[0.5em] text-amber-300">[ THÔNG BÁO HỆ THỐNG ]</div>
              <h2
                className="mt-3 font-sys text-3xl font-black tracking-[0.14em] text-white sm:text-6xl"
                style={{ textShadow: "0 0 26px #ffd86b, 0 0 80px #ff7a00" }}
              >
                BOSS ĐÃ BỊ ĐÁNH BẠI
              </h2>
              <div className="mx-auto mt-4 h-px w-56 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
              <p className="mt-4 font-sys text-[10px] tracking-[0.35em] text-amber-100/80 sm:text-xs">
                NỤ CƯỜI CỦA THẦN LINH ĐÃ TẮT
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* chữ ký dưới cùng */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[45] flex items-center justify-between px-4 pb-1 font-sys text-[7px] tracking-[0.25em] text-white/25">
        <span>HỒNG NGỤC · TẦNG SÂU NHẤT</span>
        <span>AWAITING THE MONARCH</span>
      </div>
    </motion.div>
  );
}
