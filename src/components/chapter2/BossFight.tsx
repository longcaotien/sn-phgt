import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import RainCanvas from "../RainCanvas";
import { avatar, bossArena, bossEnrage, bossIdle, heroKneel, heroStand } from "./assets";

export const BOSS_MAX_HP = 300;
const HIT_DMG = 50;
const BAR_HP = 100;
const LANE_X = [17, 50, 83];

export type BossStats = { counters: number; bestCombo: number; misses: number; hpLeft: number };

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

type SkillKind = "gaze" | "laugh" | "fist";
type Skill = { kind: SkillKind; id: number; mode: "telegraph" | "active" };
type Feedback = { id: number; text: string; sub?: string; kind: "perfect" | "good" | "bad" };

const SKILL_INFO: Record<
  SkillKind,
  { name: string; tag: string; hint: string; color: string; glyph: string }
> = {
  gaze: {
    name: "TRỪNG PHẠT · NHÌN THẲNG",
    tag: "GAZE OF THE GOD",
    hint: "DI CHUYỂN SANG LÀN AN TOÀN",
    color: "#ff4a2a",
    glyph: "◉",
  },
  laugh: {
    name: "CUỒNG TIẾNG CƯỜI",
    tag: "MADNESS LAUGH",
    hint: "GIỮ ĐỂ CHỊU ĐÒN",
    color: "#ffb03d",
    glyph: "◈",
  },
  fist: {
    name: "NẮM ĐẤM THẦN",
    tag: "GOD'S FIST",
    hint: "NHẤN ĐÚNG NHỊP ĐỂ PHẢN CÔNG",
    color: "#ff2d6b",
    glyph: "✦",
  },
};

const BOSS_FORMS = {
  calm: { eyes: [[41.4, 17.4], [58.6, 17.4]] as [number, number][], mouth: [50, 25.2] as [number, number] },
  rage: { eyes: [[40.6, 26.6], [59.4, 26.6]] as [number, number][], mouth: [50, 34.6] as [number, number] },
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
  const [enraged, setEnraged] = useState(startHp <= 200);
  const [phaseCut, setPhaseCut] = useState(false);
  const [finalCut, setFinalCut] = useState(false);
  const [dying, setDying] = useState(false);
  const [win, setWin] = useState(false);
  const [tapWindow, setTapWindow] = useState<{ id: number; dur: number } | null>(null);
  const [durs, setDurs] = useState({ tele: 860, active: 1400 });
  const [flashKey, setFlashKey] = useState(0);
  const [redKey, setRedKey] = useState(0);
  const [hitKey, setHitKey] = useState(0);
  const [slashKey, setSlashKey] = useState(0);
  const [strikeKey, setStrikeKey] = useState(0);
  const [laughKey, setLaughKey] = useState(0);

  const laneRef = useRef(1);
  const holdRef = useRef(false);
  const gaugeRef = useRef(0);
  const hpRef = useRef(hp);
  const deadRef = useRef(false);
  const skillRef = useRef<Skill | null>(null);
  const startHpRef = useRef(startHp);
  const idRef = useRef(0);
  const fbTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tapResolver = useRef<((ok: boolean) => void) | null>(null);
  const tapStartRef = useRef(0);
  const tapDurRef = useRef(1);

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
      tapResolver.current?.(false);
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
    fbTimer.current = setTimeout(() => setFeedback(null), 1150);
  }, []);

  const setHold = useCallback((v: boolean) => {
    holdRef.current = v;
    setHolding(v);
  }, []);

  const moveTo = useCallback((target: number) => {
    const n = Math.max(0, Math.min(2, target));
    if (n === laneRef.current) return;
    laneRef.current = n;
    setLane(n);
  }, []);

  const tapNow = useCallback(() => {
    const resolver = tapResolver.current;
    if (!resolver) return;
    tapResolver.current = null;
    const p = (performance.now() - tapStartRef.current) / tapDurRef.current;
    resolver(p >= 0.46 && p <= 0.74);
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
      const g = Math.max(0, Math.min(100, gaugeRef.current + (bracing ? 90 : -70) * dt));
      gaugeRef.current = g;
      // chỉ cập nhật React khi thanh nội lực thực sự thay đổi → tránh re-render mỗi frame
      if (Math.abs(g - painted) >= 1 || (g === 0 && painted !== 0) || (g === 100 && painted !== 100)) {
        painted = g;
        setGauge(g);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---------- bàn phím ----------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.code === "Space" || k === "enter") {
        e.preventDefault();
        const s = skillRef.current;
        if (!s || s.mode !== "active" || deadRef.current) return;
        if (s.kind === "fist") tapNow();
        else if (s.kind === "laugh" && !holdRef.current) setHold(true);
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
    let lastKind: SkillKind | null = null;
    let enrageShown = seqHp <= 200;
    let finalShown = seqHp <= 100;

    const alive = () => !cancelled && !deadRef.current && seqHp > 0;
    const wait = async (ms: number) => {
      await sleep(ms);
      return alive();
    };

    const resolveTap = (dur: number) =>
      new Promise<boolean>((resolve) => {
        tapStartRef.current = performance.now();
        tapDurRef.current = dur;
        const timer = setTimeout(() => {
          if (tapResolver.current) {
            tapResolver.current = null;
            resolve(false);
          }
        }, dur);
        tapResolver.current = (ok: boolean) => {
          clearTimeout(timer);
          resolve(ok);
        };
      });

    (async () => {
      if (startHpRef.current >= BOSS_MAX_HP) {
        await sleep(2450);
        if (cancelled) return;
        setIntro(false);
        if (!(await wait(500))) return;
      } else {
        if (!(await wait(900))) return;
      }

      while (alive()) {
        const stage = seqHp > 200 ? 0 : seqHp > 100 ? 1 : 2;
        const speed = stage === 0 ? 1 : stage === 1 ? 0.87 : 0.74;
        const pool = (["gaze", "laugh", "fist"] as SkillKind[]).filter((k) => k !== lastKind);
        const kind = pool[Math.floor(Math.random() * pool.length)];
        lastKind = kind;
        const id = ++idRef.current;
        const activeMs = Math.round((kind === "fist" ? 1420 : kind === "laugh" ? 1520 : 1380) * speed);
        const teleMs = Math.round(860 * speed);
        setDurs({ tele: teleMs, active: activeMs });

        const dLanes = kind === "gaze" ? pickDangerLanes() : [];
        setDanger(dLanes);
        setSkill({ kind, id, mode: "telegraph" });
        await bossControls.start({
          y: [0, -14, 0],
          scale: [1, 1.035, 1],
          transition: { duration: 0.55, ease: "easeOut" },
        });
        if (!(await wait(teleMs))) return;

        setSkill({ kind, id, mode: "active" });
        if (kind === "gaze") {
          shake(5);
        }
        if (kind === "laugh") {
          setLaughKey((k) => k + 1);
          shake(13);
        }
        if (kind === "fist") {
          setTapWindow({ id, dur: activeMs });
          shake(5);
        }

        let ok = false;
        if (kind === "gaze") {
          await sleep(activeMs);
          if (cancelled) return;
          setStrikeKey((k) => k + 1);
          shake(laneRef.current !== undefined && !dLanes.includes(laneRef.current) ? 7 : 16);
          ok = !dLanes.includes(laneRef.current);
          await sleep(240);
        } else if (kind === "laugh") {
          await sleep(activeMs);
          if (cancelled) return;
          ok = holdRef.current && gaugeRef.current >= 40;
          shake(ok ? 9 : 15);
          setStrikeKey((k) => k + 1);
        } else {
          ok = await resolveTap(activeMs);
          if (cancelled) return;
          shake(ok ? 14 : 12);
        }

        setSkill(null);
        setTapWindow(null);
        setDanger([]);
        setHold(false);
        if (!alive()) return;

        if (ok) {
          seqHp = Math.max(0, seqHp - HIT_DMG);
          counters += 1;
          comboTrack += 1;
          bestCombo = Math.max(bestCombo, comboTrack);
          setBossHp(seqHp);
          onProgress(seqHp);
          setCombo(comboTrack);
          setSlashKey((k) => k + 1);
          setFlashKey((k) => k + 1);
          setHitKey((k) => k + 1);
          showFb("PHẢN CÔNG!", comboTrack >= 2 ? `${comboTrack} COMBO · -${HIT_DMG} HP` : `-${HIT_DMG} HP`, "perfect");

          if (seqHp <= 0) {
            setDying(true);
            await sleep(1100);
            if (cancelled) return;
            setDying(false);
            setWin(true);
            setFlashKey((k) => k + 1);
            await sleep(2500);
            if (!cancelled) onVictory({ counters, bestCombo, misses, hpLeft: hpRef.current });
            return;
          }

          if (seqHp % BAR_HP === 0) {
            onHeal(1);
            showFb("PHÁ KHIÊN!", "+1 HP · Boss choáng", "good");
            shake(18);
            setRedKey((k) => k + 1);
            await sleep(1150);
            if (!alive()) return;
            if (seqHp === 200 && !enrageShown) {
              enrageShown = true;
              setEnraged(true);
              setPhaseCut(true);
              setRedKey((k) => k + 1);
              shake(22);
              await sleep(1900);
              setPhaseCut(false);
            }
            if (seqHp === 100 && !finalShown) {
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
          setHitKey((k) => k + 1);
          shake(20);
          showFb(applied ? "TRÚNG ĐÒN!" : "SUÝT TRÚNG!", applied ? "-1 HP" : "MIỄN THƯƠNG", "bad");
        }

        if (!alive()) return;
        await sleep(820);
      }
    })();

    return () => {
      cancelled = true;
      tapResolver.current?.(false);
      tapResolver.current = null;
    };
  }, [bossControls, onDamage, onHeal, onProgress, onVictory, sceneShake, setHold, shake, showFb]);

  const stage = bossHp > 200 ? 1 : bossHp > 100 ? 2 : 3;
  const form = enraged ? BOSS_FORMS.rage : BOSS_FORMS.calm;
  const activeSkill = skill?.mode === "active" ? skill.kind : null;
  const info = skill ? SKILL_INFO[skill.kind] : null;

  const ghostAura = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: 8 + Math.random() * 84,
        delay: Math.random() * 3.5,
        dur: 6 + Math.random() * 5,
        size: 2 + Math.random() * 4,
        red: i % 3 !== 0,
      })),
    []
  );

  const onStagePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (deadRef.current) return;
    const s = skillRef.current;
    if (!s || s.mode !== "active") return;
    if (s.kind === "gaze") {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      moveTo(x < 1 / 3 ? 0 : x < 2 / 3 ? 1 : 2);
    } else if (s.kind === "fist") {
      tapNow();
    }
  };

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-[#050307] select-none"
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
                ? "saturate(1.45) hue-rotate(-10deg) brightness(0.82) contrast(1.1)"
                : "saturate(0.85) brightness(0.62) contrast(1.05)",
              transition: "filter 2.4s ease",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#05030a]/80 via-transparent to-[#05030a]/95" />
          <div
            className="absolute inset-0 transition-opacity duration-[2000ms]"
            style={{
              opacity: enraged ? 1 : 0.45,
              background:
                "radial-gradient(ellipse at 50% 62%, rgba(255,48,24,.24), transparent 58%), radial-gradient(ellipse at 50% 10%, rgba(90,20,120,.35), transparent 65%)",
            }}
          />
        </motion.div>

        {/* vòng trận pháp dưới sàn */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] overflow-hidden">
          <div
            className="rune-spin absolute left-1/2 top-[18%] h-[74vh] w-[74vh] -translate-x-1/2 rounded-full border border-red-500/25"
            style={{ boxShadow: "0 0 70px rgba(255,40,20,.18) inset, 0 0 50px rgba(255,40,20,.12)" }}
          />
          <div className="rune-spin-rev absolute left-1/2 top-[24%] h-[58vh] w-[58vh] -translate-x-1/2 rounded-full border border-dashed border-sky-400/20" />
          <div
            className="absolute left-1/2 top-[32%] h-[44vh] w-[44vh] -translate-x-1/2 rounded-full border border-violet-400/20"
            style={{ background: "radial-gradient(circle, rgba(120,40,255,.14), transparent 68%)" }}
          />
        </div>

        {/* tàn lửa */}
        <div className="pointer-events-none absolute inset-0 z-[4] opacity-80">
          <RainCanvas rain={false} intensity={1.4} />
        </div>
        {ghostAura.map((g, i) => (
          <span
            key={i}
            className="pointer-events-none absolute bottom-0 z-[4] rounded-full"
            style={{
              left: `${g.left}%`,
              width: g.size,
              height: g.size,
              background: g.red ? "#ff5a3a" : "#7cc4ff",
              boxShadow: `0 0 ${g.size * 5}px ${g.size}px ${g.red ? "rgba(255,70,40,.7)" : "rgba(90,160,255,.6)"}`,
              animation: `floatUp ${g.dur}s linear ${g.delay}s infinite`,
            }}
          />
        ))}

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
              className="boss-aura absolute left-1/2 top-[30%] h-[62%] w-[132%] -translate-x-1/2 rounded-[50%] blur-2xl"
              style={{
                background: enraged
                  ? "radial-gradient(ellipse, rgba(255,40,20,.5), rgba(120,0,20,.22) 55%, transparent 72%)"
                  : "radial-gradient(ellipse, rgba(70,140,255,.34), rgba(70,40,160,.16) 55%, transparent 72%)",
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
                  ? "drop-shadow(0 0 55px rgba(255,60,30,.55)) contrast(1.06)"
                  : "drop-shadow(0 0 55px rgba(120,180,255,.45))",
                WebkitMaskImage: "radial-gradient(ellipse 62% 58% at 50% 42%, #000 62%, transparent 86%)",
                maskImage: "radial-gradient(ellipse 62% 58% at 50% 42%, #000 62%, transparent 86%)",
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
                  width: activeSkill === "gaze" ? "17%" : "9%",
                  height: activeSkill === "gaze" ? "3.4%" : "2.4%",
                  transform: "translate(-50%,-50%)",
                  background:
                    activeSkill === "gaze"
                      ? "radial-gradient(ellipse, #fff 0%, rgba(255,80,40,1) 28%, rgba(255,0,0,.55) 55%, transparent 78%)"
                      : "radial-gradient(ellipse, rgba(255,90,60,1), rgba(255,20,20,.7) 40%, transparent 76%)",
                  boxShadow: activeSkill === "gaze" ? "0 0 60px 18px rgba(255,50,20,.85)" : "0 0 26px 6px rgba(255,40,20,.6)",
                  filter: "blur(1px)",
                  transition: "all .3s",
                }}
              />
            ))}
            {/* miệng cười */}
            <div
              className="absolute rounded-full mix-blend-screen"
              style={{
                left: `${form.mouth[0]}%`,
                top: `${form.mouth[1]}%`,
                width: enraged ? "24%" : "20%",
                height: "3.6%",
                transform: "translate(-50%,-50%)",
                background: enraged
                  ? "radial-gradient(ellipse, rgba(255,150,60,.85), rgba(255,50,20,.35) 55%, transparent 78%)"
                  : "radial-gradient(ellipse, rgba(160,210,255,.55), rgba(80,140,255,.22) 55%, transparent 78%)",
                filter: "blur(4px)",
                opacity: activeSkill === "laugh" ? 1 : 0.55,
                transition: "all .4s",
              }}
            />
          </motion.div>
        </motion.div>

        {/* sóng xung kích khi cười */}
        <AnimatePresence>
          {activeSkill === "laugh" && (
            <div key={`laugh-${laughKey}`} className="pointer-events-none absolute inset-0 z-[14]">
              <div className="shockwave absolute left-1/2 top-[46%] h-[46vh] w-[46vh]" />
              <div
                className="shockwave absolute left-1/2 top-[46%] h-[46vh] w-[46vh]"
                style={{ animationDelay: "0.45s" }}
              />
              <div
                className="shockwave absolute left-1/2 top-[46%] h-[46vh] w-[46vh]"
                style={{ animationDelay: "0.9s" }}
              />
            </div>
          )}
        </AnimatePresence>

        {/* ====== Làn né / cột trừng phạt ====== */}
        {(skill?.kind === "gaze" || strikeKey > 0) &&
          [0, 1, 2].map((i) => {
            const isDanger = danger.includes(i);
            if (!isDanger && skill?.kind !== "gaze") return null;
            return (
              <div
                key={`lane-${i}`}
                className="pointer-events-none absolute z-[13]"
                style={{ left: `${LANE_X[i]}%`, top: "52%", bottom: 0, width: "32%", transform: "translateX(-50%)" }}
              >
                {isDanger ? (
                  <>
                    <div
                      className="absolute inset-0"
                      style={{
                        clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)",
                        background:
                          skill?.mode === "active"
                            ? "linear-gradient(to bottom, rgba(255,255,255,.9), rgba(255,110,40,.75) 35%, rgba(255,20,20,.42))"
                            : "linear-gradient(to bottom, rgba(255,40,30,.12), rgba(255,40,30,.5))",
                        filter: skill?.mode === "active" ? "blur(1px)" : "none",
                        transition: "background .18s",
                      }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)",
                        background:
                          "repeating-linear-gradient(to bottom, rgba(255,90,60,.28) 0 12px, transparent 12px 26px)",
                        boxShadow: "inset 0 0 60px rgba(255,0,0,.75)",
                      }}
                    />
                    {skill?.mode === "active" && (
                      <div
                        key={`beam-${skill.id}-${i}`}
                        className="absolute inset-x-0 top-0 h-full"
                        style={{
                          background:
                            "linear-gradient(to bottom, rgba(255,255,255,.95), rgba(255,130,60,.72) 32%, rgba(255,20,20,.28))",
                          clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)",
                          mixBlendMode: "screen",
                          animation: "eyeFlicker .28s linear infinite",
                        }}
                      />
                    )}
                  </>
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)",
                      background: "linear-gradient(to bottom, rgba(90,200,255,.05), rgba(90,200,255,.18))",
                      boxShadow: "inset 0 0 40px rgba(80,180,255,.25)",
                    }}
                  >
                    <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 font-sys text-[10px] tracking-[0.3em] text-sky-200/90">
                      AN TOÀN
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        {/* ====== Người chơi ====== */}
        <motion.div
          className="absolute z-20"
          style={{ height: "min(32svh, 50vw)", aspectRatio: "2/3", x: "-50%", bottom: "2%" }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0, left: `${LANE_X[lane]}%` }}
          transition={{
            left: { type: "spring", stiffness: 500, damping: 32 },
            opacity: { duration: 0.8 },
            y: { duration: 0.8 },
          }}
        >
          <div
            className="absolute -inset-x-1/3 bottom-0 h-1/2 rounded-[50%] blur-xl"
            style={{
              background: holding
                ? "radial-gradient(ellipse, rgba(255,180,80,.45), transparent 70%)"
                : "radial-gradient(ellipse, rgba(110,90,255,.45), transparent 70%)",
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
                ? "drop-shadow(0 0 20px rgba(255,190,90,.85))"
                : "drop-shadow(0 0 18px rgba(110,150,255,.85))",
            }}
            transition={{ duration: 0.25 }}
          />
          {slashKey > 0 && (
            <div key={`slash-${slashKey}`} className="pointer-events-none absolute inset-0 z-30">
              <div
                className="slash-rail absolute left-1/2 top-1/2 h-[6px] w-[420%] rounded-full"
                style={{
                  background: "linear-gradient(90deg, transparent, #fff, #7cc4ff, transparent)",
                  boxShadow: "0 0 40px 8px rgba(120,190,255,.9)",
                }}
              />
              <div
                className="slash-sweep absolute left-1/2 top-1/2 h-[180%] w-[520%] rounded-full"
                style={{
                  background: "conic-gradient(from 200deg, transparent 0deg, rgba(255,255,255,.95) 18deg, transparent 40deg)",
                  filter: "blur(2px)",
                  opacity: 0.9,
                }}
              />
            </div>
          )}
        </motion.div>

        {/* vệt chém vào boss */}
        {slashKey > 0 && (
          <div key={`bossSlash-${slashKey}`} className="pointer-events-none absolute inset-0 z-[16]">
            <div
              className="slash-sweep absolute left-1/2 top-[40%] h-[26vh] w-[120vw]"
              style={{
                background:
                  "linear-gradient(0deg, transparent 38%, rgba(255,255,255,.95) 50%, transparent 62%)",
                filter: "blur(1px)",
              }}
            />
          </div>
        )}

        {/* ====== HUD ====== */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 px-3 pt-3 sm:px-6 sm:pt-5">
          {/* người chơi */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="h-10 w-10 rounded-full border border-sky-400/80 shadow-[0_0_16px_rgba(79,168,255,.8)] sm:h-12 sm:w-12"
              style={{ backgroundImage: `url(${avatar})`, backgroundSize: "260%", backgroundPosition: "58% 20%" }}
            />
            <div>
              <div className="font-sys text-[9px] font-bold tracking-[0.2em] text-sky-200 text-glow sm:text-[10px]">
                SUNG JIN WOO
              </div>
              <div className="mt-1 flex gap-1">
                {Array.from({ length: maxHp }).map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 w-6 skew-x-[-20deg] transition-all duration-300 sm:w-8"
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
            <div className="font-sys text-[8px] tracking-[0.32em] text-red-300/90 sm:text-[10px]">
              BOSS · CẤP SSS
            </div>
            <div
              className="mt-0.5 font-sys text-[9px] font-black leading-[1.2] tracking-[0.08em] text-white sm:text-base sm:tracking-[0.18em]"
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
                    className={`relative h-2 overflow-hidden border border-red-500/40 bg-red-950/60 sm:h-2.5 ${hitKey ? "boss-bar-hit" : ""}`}
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
            <div
              className="mt-1.5 flex items-center justify-center gap-3 font-sys text-[9px] tracking-[0.22em] text-red-100/90 sm:text-[10px]"
              style={{ textShadow: "0 0 10px rgba(255,50,20,.8)" }}
            >
              <span>PHA {stage} / 3</span>
              <span className="text-red-400">◆</span>
              <span>{Math.max(0, bossHp)} / {BOSS_MAX_HP}</span>
            </div>
          </div>

          {/* combo */}
          <div className="min-w-[58px] text-right sm:min-w-[90px]">
            <div className="font-sys text-[8px] tracking-[0.25em] text-violet-300/80">COMBO</div>
            <div key={combo} className={`font-sys text-xl font-black text-white sm:text-3xl ${combo >= 2 ? "combo-pop" : ""}`}>
              <span style={{ textShadow: "0 0 18px #a855ff" }}>×{combo}</span>
            </div>
            <div className="mt-1 font-sys text-[8px] tracking-[0.2em] text-sky-300/60">HỒNG NGỤC</div>
          </div>
        </div>

        {/* ====== Thẻ kỹ năng ====== */}
        <AnimatePresence>
          {skill && info && (
            <motion.div
              key={`card-${skill.id}`}
              className="pointer-events-none absolute left-1/2 top-[23%] z-40 w-[90%] max-w-sm -translate-x-1/2 px-2 sm:left-6 sm:top-[26%] sm:w-[21rem] sm:max-w-none sm:translate-x-0"
              initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="sys-cut relative overflow-hidden border px-4 py-2.5 text-center"
                style={{
                  borderColor: `${info.color}88`,
                  background: "linear-gradient(180deg, rgba(20,4,8,.88), rgba(6,2,6,.92))",
                  boxShadow: `0 0 30px ${info.color}55, inset 0 0 30px ${info.color}22`,
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-[2px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${info.color}, transparent)` }}
                />
                <div className="flex items-center justify-center gap-2 font-sys text-[8px] tracking-[0.32em]" style={{ color: info.color }}>
                  <span className="animate-pulse">{info.glyph}</span>
                  <span className="whitespace-nowrap">KỸ NĂNG ĐẶC BIỆT</span>
                  <span className="hidden whitespace-nowrap opacity-60 sm:inline">· {info.tag}</span>
                </div>
                <div className="mt-1 whitespace-nowrap font-sys text-[13px] font-black tracking-[0.08em] text-white sm:text-[15px]" style={{ textShadow: `0 0 18px ${info.color}` }}>
                  {info.name}
                </div>
                <div className="mt-1 text-[9px] font-semibold leading-tight tracking-[0.14em] text-white/80 sm:text-[10px]">
                  ▸ {skill.mode === "telegraph" ? `CHUẨN BỊ · ${info.hint}` : info.hint}
                </div>
                <div className="mt-2 h-[3px] w-full overflow-hidden bg-white/10">
                  <motion.div
                    key={`${skill.id}-${skill.mode}`}
                    className="h-full origin-left"
                    style={{ background: info.color, boxShadow: `0 0 12px ${info.color}` }}
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: 0 }}
                    transition={{ duration: (skill.mode === "telegraph" ? durs.tele : durs.active) / 1000, ease: "linear" }}
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
              className="pointer-events-none absolute inset-x-0 top-[40%] z-40 text-center"
              initial={{ opacity: 0, scale: 0.5, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: -6 }}
              exit={{ opacity: 0, scale: 1.1, y: -32 }}
              transition={{ duration: 0.28 }}
            >
              <div
                className="font-sys text-2xl font-black tracking-[0.2em] sm:text-4xl"
                style={{
                  color: feedback.kind === "bad" ? "#ff5a5a" : feedback.kind === "good" ? "#ffd86b" : "#9ad4ff",
                  textShadow:
                    feedback.kind === "bad"
                      ? "0 0 22px #f00, 0 0 60px #900"
                      : feedback.kind === "good"
                      ? "0 0 22px #ffb300, 0 0 60px #ff6a00"
                      : "0 0 22px #4fa8ff, 0 0 60px #6a5cff",
                }}
              >
                {feedback.text}
              </div>
              {feedback.sub && (
                <div className="mt-1 font-sys text-[9px] tracking-[0.35em] text-white/70 sm:text-[11px]">{feedback.sub}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ====== Thanh nhịp NẮM ĐẤM THẦN ====== */}
        <AnimatePresence>
          {tapWindow && (
            <motion.div
              className="pointer-events-none absolute inset-x-0 bottom-[32%] z-40 px-5"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="mx-auto max-w-sm">
                <div className="sys-panel-danger sys-cut px-3 py-2.5">
                  <div className="mb-1.5 flex items-center justify-between font-sys text-[8px] tracking-[0.28em]">
                    <span className="text-red-200/90">NHỊP PHẢN CÔNG</span>
                    <span className="animate-pulse text-amber-300">NHẤN [SPACE]</span>
                  </div>
                  <div className="relative h-5 overflow-hidden border border-red-400/50 bg-red-950/70">
                    <div
                      className="zone-glow absolute inset-y-0 flex items-center justify-center"
                      style={{
                        left: "46%",
                        width: "28%",
                        background: "linear-gradient(90deg, rgba(255,170,50,.25), rgba(255,220,110,.9), rgba(255,170,50,.25))",
                        boxShadow: "0 0 26px rgba(255,190,70,.95)",
                      }}
                    >
                      <span className="font-sys text-[7px] font-bold tracking-[0.1em] text-[#3a1500]">PERFECT</span>
                    </div>
                    <motion.div
                      className="absolute inset-y-0 w-[3px] bg-white"
                      style={{ boxShadow: "0 0 16px 4px #fff" }}
                      initial={{ left: "0%" }}
                      animate={{ left: "100%" }}
                      transition={{ duration: tapWindow.dur / 1000, ease: "linear" }}
                    />
                    <div
                      className="pointer-events-none absolute inset-0 opacity-40"
                      style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 14px, rgba(0,0,0,.7) 14px 15px)" }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ====== Điều khiển ====== */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-40 flex flex-col items-center gap-2 px-4">
          {activeSkill === "laugh" ? (
            <>
              <div className="w-full max-w-xs">
                <div className="mb-1 flex justify-between font-sys text-[8px] tracking-[0.28em] text-amber-200/90">
                  <span>NỘI LỰC · CHỊU ĐÒN</span>
                  <span>{Math.floor(gauge)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-amber-400/40 bg-amber-950/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 to-red-400 shadow-[0_0_14px_#ffae42] transition-[width] duration-75"
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
                    : "border-amber-400/60 bg-amber-950/50 text-amber-100"
                }`}
              >
                {holding ? "ĐANG CHỊU ĐÒN…" : "GIỮ ĐỂ CHỊU ĐÒN"}
              </button>
            </>
          ) : activeSkill === "fist" ? (
            <button
              onPointerDown={tapNow}
              className="press-pulse pointer-events-auto touch-none border border-red-400 bg-red-500/20 px-9 py-2.5 font-sys text-[10px] font-bold tracking-[0.32em] text-white sm:text-xs"
            >
              PHẢN CÔNG · [SPACE]
            </button>
          ) : activeSkill === "gaze" ? (
            <div className="font-sys text-[9px] tracking-[0.28em] text-red-200/85">
              ◀ ▶ / A · D — CHẠM VÀO LÀN ĐỂ NÉ
            </div>
          ) : (
            <div className="font-sys text-[9px] tracking-[0.3em] text-white/40">THEO DÕI KỸ NĂNG CỦA BOSS…</div>
          )}
        </div>

        {/* ====== Lớp phủ hiệu ứng ====== */}
        <div
          className="pointer-events-none absolute inset-0 z-[15]"
          style={{ background: "radial-gradient(ellipse at 50% 55%, transparent 40%, rgba(255,20,10,.25) 100%)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 z-[15] opacity-40"
          style={{ background: "linear-gradient(180deg, transparent 55%, rgba(255,30,10,.18))" }}
        />
        <div className="pointer-events-none absolute inset-0 z-[17] shadow-[inset_0_0_220px_rgba(0,0,0,.95)]" />
        <div
          className="pointer-events-none absolute inset-0 z-[17] opacity-[0.05]"
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
        <div
          key={`s-${strikeKey}`}
          className={`pointer-events-none absolute inset-0 z-[26] ${strikeKey ? "red-bloom" : "opacity-0"}`}
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,120,60,.5), transparent 70%)" }}
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
            <div className="pointer-events-none absolute inset-0 opacity-45">
              <motion.img
                src={bossIdle}
                alt=""
                className="h-full w-full object-cover object-top"
                initial={{ scale: 1.35, opacity: 0 }}
                animate={{ scale: 1.05, opacity: 0.55 }}
                transition={{ duration: 3.2, ease: "easeOut" }}
                style={{ mixBlendMode: "screen", filter: "saturate(.5) brightness(.9)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#04020a] via-[#04020a]/60 to-[#04020a]/30" />
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
              <div className="mt-4 font-sys text-[10px] tracking-[0.4em] text-red-200/70 sm:text-xs">
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
                className="mt-4 max-w-md text-xs leading-relaxed text-red-100/70 sm:text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 1 }}
              >
                “Kẻ nào còn đứng trong sảnh đường này… sẽ cười cùng ta mãi mãi.”
              </motion.p>
              <motion.div
                className="mt-5 flex items-center gap-2 font-sys text-[9px] tracking-[0.35em] text-amber-300/90"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 0.8 }}
              >
                <span className="h-1.5 w-1.5 animate-pulse bg-red-500" />
                NÉ · CHỊU ĐÒN · PHẢN CÔNG
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
              <div className="font-sys text-[10px] tracking-[0.5em] text-amber-300">PHA 2 · BOSS CUỒNG NỘ</div>
              <div
                className="mt-2 font-sys text-4xl font-black tracking-[0.16em] text-white sm:text-7xl"
                style={{ textShadow: "0 0 30px #ff2a10, 0 0 90px #900" }}
              >
                CUỒNG NỘ
              </div>
              <div className="mt-3 font-sys text-[10px] tracking-[0.35em] text-red-200/80">TỐC ĐỘ · SÁT THƯƠNG · TĂNG VỌT</div>
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
              <div className="mt-3 font-sys text-[9px] tracking-[0.32em] text-red-100/80">THANH MÁU CUỐI · KHÔNG THỂ LÙI BƯỚC</div>
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
            <div className="absolute inset-0 white-bloom pointer-events-none bg-white mix-blend-screen" />
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

function pickDangerLanes() {
  const all = [0, 1, 2];
  const safe = all[Math.floor(Math.random() * 3)];
  return all.filter((l) => l !== safe);
}
