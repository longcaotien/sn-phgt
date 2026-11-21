import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import RainCanvas from "../RainCanvas";
import Statue, { type Attack, type Gaze } from "./Statue";
import { avatar, hall, heroKneel, heroStand, s1, s2, s3 } from "./assets";

type Phase = "title" | "quest" | "pray" | "awaken" | "dodge" | "dead" | "clear";
type Threat = { lanes: number[]; mode: "warn" | "strike"; id: number };
type Pop = { id: number; text: string; kind: "perfect" | "dodge" | "hit" };

const MAX_HP = 3;
const TOTAL_WAVES = 12;
const LANE_X = [17, 50, 83];

const STATUES = [
  { src: s1, x: 17, eye: [54, 6.5] as [number, number], bottom: "33%", height: "min(58svh, 62vw)" },
  { src: s2, x: 50, eye: [50, 8.5] as [number, number], bottom: "35%", height: "min(52svh, 58vw)" },
  { src: s3, x: 83, eye: [49, 10] as [number, number], bottom: "33%", height: "min(58svh, 62vw)" },
];

const SINGLES = [[0], [1], [2]];
const DOUBLES = [
  [0, 1],
  [1, 2],
  [0, 2],
];

function makePattern(i: number, prev: number[] | null): number[] {
  const pool = i < 3 ? SINGLES : i >= 9 ? [...DOUBLES, ...DOUBLES, ...SINGLES] : [...SINGLES, ...DOUBLES];
  let p = pool[Math.floor(Math.random() * pool.length)];
  let guard = 0;
  while (prev && JSON.stringify(prev) === JSON.stringify(p) && guard++ < 8) {
    p = pool[Math.floor(Math.random() * pool.length)];
  }
  return p;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function Chapter2({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("title");
  const [hp, setHp] = useState(MAX_HP);
  const [lane, setLane] = useState(1);
  const [gauge, setGauge] = useState(0);
  const [holding, setHolding] = useState(false);
  const [gaze, setGaze] = useState<{ statue: number; mode: Gaze } | null>(null);
  const [threat, setThreat] = useState<Threat | null>(null);
  const [wave, setWave] = useState(0);
  const [awake, setAwake] = useState(false);
  const [shattered, setShattered] = useState(false);
  const [reward, setReward] = useState(false);
  const [perfects, setPerfects] = useState(0);
  const [pop, setPop] = useState<Pop | null>(null);
  const [ghosts, setGhosts] = useState<{ id: number; lane: number }[]>([]);
  const [shakeKey, setShakeKey] = useState(0);
  const [strikeKey, setStrikeKey] = useState(0);
  const [hitKey, setHitKey] = useState(0);
  const [runId, setRunId] = useState(0);

  const phaseRef = useRef<Phase>("title");
  const hpRef = useRef(MAX_HP);
  const laneRef = useRef(1);
  const holdRef = useRef(false);
  const threatRef = useRef<Threat | null>(null);
  const escapeRef = useRef(0);
  const invulnRef = useRef(0);
  const deathFrom = useRef<"pray" | "dodge">("pray");
  const idRef = useRef(0);
  const popTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tilt = useAnimationControls();

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const showPop = useCallback((text: string, kind: Pop["kind"]) => {
    clearTimeout(popTimer.current);
    setPop({ id: ++idRef.current, text, kind });
    popTimer.current = setTimeout(() => setPop(null), 900);
  }, []);

  const damage = useCallback(() => {
    const now = performance.now();
    if (now < invulnRef.current) return false;
    invulnRef.current = now + 900;
    hpRef.current -= 1;
    setHp(hpRef.current);
    setHitKey((k) => k + 1);
    setShakeKey((k) => k + 1);
    return true;
  }, []);

  const setThreatBoth = (t: Threat | null) => {
    threatRef.current = t;
    setThreat(t);
  };

  const moveTo = useCallback(
    (target: number) => {
      if (phaseRef.current !== "dodge") return;
      const n = Math.max(0, Math.min(2, target));
      const old = laneRef.current;
      if (n === old) return;
      laneRef.current = n;
      setLane(n);
      const th = threatRef.current;
      if (th && th.mode === "warn" && th.lanes.includes(old) && !th.lanes.includes(n)) {
        escapeRef.current = performance.now();
      }
      tilt.start({ rotate: [(n > old ? 1 : -1) * 9, 0], transition: { duration: 0.5, ease: "easeOut" } });
      const id = ++idRef.current;
      setGhosts((g) => [...g, { id, lane: old }]);
      setTimeout(() => setGhosts((g) => g.filter((x) => x.id !== id)), 600);
    },
    [tilt]
  );

  // ---------- Chết ----------
  useEffect(() => {
    if (hp <= 0 && (phase === "pray" || phase === "dodge")) {
      deathFrom.current = phase;
      setPhase("dead");
      setThreatBoth(null);
      setGaze(null);
    }
  }, [hp, phase]);

  // ---------- Tiêu đề -> nhiệm vụ ----------
  useEffect(() => {
    if (phase !== "title") return;
    const t = setTimeout(() => setPhase("quest"), 3800);
    return () => clearTimeout(t);
  }, [phase]);

  // ---------- Cầu nguyện ----------
  useEffect(() => {
    if (phase !== "pray") return;
    let raf = 0;
    let last = performance.now();
    let g = 0;
    setGauge(0);
    let nextGaze = last + 2600;
    let gz: { statue: number; start: number; mode: "warn" | "on"; hit: boolean } | null = null;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g += (holdRef.current ? 24 : -15) * dt;
      g = Math.max(0, Math.min(100, g));
      setGauge(g);

      if (!gz && now > nextGaze) {
        gz = { statue: Math.floor(Math.random() * 3), start: now, mode: "warn", hit: false };
        setGaze({ statue: gz.statue, mode: "warn" });
      }
      if (gz) {
        const e = now - gz.start;
        if (gz.mode === "warn" && e > 800) {
          gz.mode = "on";
          setGaze({ statue: gz.statue, mode: "on" });
        }
        if (gz.mode === "on") {
          if (!holdRef.current && !gz.hit) {
            gz.hit = true;
            damage();
          }
          if (e > 2100) {
            gz = null;
            setGaze(null);
            nextGaze = now + 1400 + Math.random() * 1300;
          }
        }
      }

      if (g >= 100) {
        setGaze(null);
        setPhase("awaken");
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, runId, damage]);

  // ---------- Thức tỉnh ----------
  useEffect(() => {
    if (phase !== "awaken") return;
    setAwake(true);
    setShakeKey((k) => k + 1);
    setStrikeKey((k) => k + 1);
    const t = setTimeout(() => setPhase("dodge"), 3400);
    return () => clearTimeout(t);
  }, [phase]);

  // ---------- Né đòn ----------
  useEffect(() => {
    if (phase !== "dodge") return;
    let cancelled = false;
    laneRef.current = 1;
    setLane(1);
    setWave(0);
    setThreatBoth(null);
    setPerfects(0);

    (async () => {
      await sleep(1000);
      let prev: number[] | null = null;
      let perfectCount = 0;
      for (let i = 0; i < TOTAL_WAVES; i++) {
        if (cancelled) return;
        setWave(i + 1);
        const warn = Math.max(760, 1350 - i * 55);
        const lanes = makePattern(i, prev);
        prev = lanes;
        setThreatBoth({ lanes, mode: "warn", id: i });
        await sleep(warn);
        if (cancelled) return;

        const strike: Threat = { lanes, mode: "strike", id: i };
        setThreatBoth(strike);
        setStrikeKey((k) => k + 1);
        setShakeKey((k) => k + 1);
        const hit = lanes.includes(laneRef.current);
        if (hit) {
          if (damage()) showPop("-1 HP", "hit");
        } else if (performance.now() - escapeRef.current < 520) {
          perfectCount++;
          setPerfects(perfectCount);
          showPop("NÉ HOÀN HẢO!", "perfect");
        } else {
          showPop("NÉ!", "dodge");
        }
        await sleep(480);
        if (cancelled) return;
        setThreatBoth(null);
        await sleep(520);
      }
      if (!cancelled && hpRef.current > 0) setPhase("clear");
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, runId, damage, showPop]);

  // ---------- Chiến thắng ----------
  useEffect(() => {
    if (phase !== "clear") return;
    setThreatBoth(null);
    setAwake(false);
    setShattered(true);
    setStrikeKey((k) => k + 1);
    setShakeKey((k) => k + 1);
    const t = setTimeout(() => setReward(true), 2800);
    return () => clearTimeout(t);
  }, [phase]);

  // ---------- Phím ----------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (phaseRef.current === "pray" && !holdRef.current) {
          holdRef.current = true;
          setHolding(true);
        }
        return;
      }
      if (phaseRef.current !== "dodge") return;
      const k = e.key.toLowerCase();
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
  }, [moveTo]);

  // ---------- Hành động ----------
  const startPray = () => {
    hpRef.current = MAX_HP;
    setHp(MAX_HP);
    holdRef.current = false;
    setHolding(false);
    setPhase("pray");
    setRunId((r) => r + 1);
  };

  const revive = () => {
    hpRef.current = MAX_HP;
    invulnRef.current = performance.now() + 1200;
    setHp(MAX_HP);
    holdRef.current = false;
    setHolding(false);
    setThreatBoth(null);
    setPhase(deathFrom.current);
    setRunId((r) => r + 1);
  };

  const replay = () => {
    setReward(false);
    setShattered(false);
    setAwake(false);
    setPerfects(0);
    setWave(0);
    laneRef.current = 1;
    setLane(1);
    startPray();
  };

  const onStagePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== "dodge") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    moveTo(x < 1 / 3 ? 0 : x < 2 / 3 ? 1 : 2);
  };

  const revealed = phase !== "title";
  const standing = phase === "awaken" || phase === "dodge" || (phase === "dead" && deathFrom.current === "dodge") || phase === "clear";
  const dim = phase === "title";

  const subtitle = useMemo(() => {
    if (phase === "pray") {
      if (gaze?.mode === "on") return { text: "ĐỪNG NGẨNG ĐẦU!", danger: true };
      if (gaze?.mode === "warn") return { text: "Có thứ gì đó… vừa cử động.", danger: false };
      return { text: "「Hãy cầu nguyện. Kẻ nào ngẩng đầu sẽ bị trừng phạt.」", danger: false };
    }
    if (phase === "awaken") return { text: "Các tượng thần… đã thức tỉnh.", danger: true };
    if (phase === "dodge") return { text: "Né khỏi vùng đỏ trước khi tượng thần giáng đòn!", danger: false };
    return null;
  }, [phase, gaze]);

  const rank = hp >= MAX_HP && perfects >= 6 ? "S" : hp >= 2 ? "A" : "B";

  const confetti = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 3,
        dur: 3.5 + Math.random() * 3,
        size: 5 + Math.random() * 7,
        color: ["#4fa8ff", "#a855ff", "#ffd86b", "#e6f1ff"][i % 4],
      })),
    []
  );

  return (
    <motion.div
      className="fixed inset-0 overflow-hidden bg-[#02030a] select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      <div key={shakeKey} className={`absolute inset-0 ${shakeKey ? "shake" : ""}`}>
        {/* ======= Bối cảnh sảnh đền ======= */}
        <motion.div
          className="absolute left-1/2 top-1/2 aspect-video"
          style={{
            width: "max(100vw, 177.78svh)",
            x: "-50%",
            y: "-50%",
            filter: awake ? "hue-rotate(125deg) saturate(1.5) brightness(1.1)" : "none",
            transition: "filter 2s ease",
          }}
          initial={{ opacity: 0, scale: 1.3 }}
          animate={{ opacity: dim ? 0 : 1, scale: phase === "dodge" || phase === "awaken" ? 1.05 : 1 }}
          transition={{ duration: dim ? 0.5 : 4, ease: "easeOut" }}
        >
          <img src={hall} alt="" className="h-full w-full object-cover" draggable={false} />
          {[29, 71].map((l) => (
            <div key={l}>
              <div
                className="flame absolute mix-blend-screen"
                style={{
                  left: `${l}%`,
                  top: "19%",
                  width: "5.5%",
                  height: "13%",
                  background: "radial-gradient(ellipse at 50% 70%, rgba(190,225,255,.95), rgba(70,120,255,.55) 40%, rgba(40,60,255,0) 70%)",
                  filter: "blur(5px)",
                }}
              />
              <div
                className="absolute mix-blend-screen"
                style={{
                  left: `${l}%`,
                  top: "22%",
                  width: "26%",
                  height: "46%",
                  transform: "translate(-50%,-50%)",
                  background: "radial-gradient(ellipse, rgba(70,110,255,.28), transparent 65%)",
                }}
              />
            </div>
          ))}
        </motion.div>

        {/* Ánh đỏ Hồng Ngục */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-[2000ms]"
          style={{
            opacity: awake ? 1 : 0,
            background:
              "radial-gradient(ellipse at 50% 85%, rgba(255,40,20,.45), transparent 60%), radial-gradient(ellipse at 50% 30%, rgba(120,0,20,.35), transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[36%]"
          style={{ background: "linear-gradient(to top, rgba(2,3,10,.65), transparent)" }}
        />

        {/* ======= Các làn né ======= */}
        {(phase === "dodge" || phase === "dead") &&
          [0, 1, 2].map((i) => {
            const st = threat && threat.lanes.includes(i) ? threat.mode : null;
            return (
              <div
                key={i}
                className="pointer-events-none absolute z-[5]"
                style={{ left: `${LANE_X[i]}%`, top: "64%", bottom: 0, width: "30%", transform: "translateX(-50%)" }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    clipPath: "polygon(34% 0, 66% 0, 100% 100%, 0 100%)",
                    background:
                      st === "strike"
                        ? "linear-gradient(to bottom, rgba(255,255,255,.95), rgba(255,120,60,.85) 40%, rgba(255,30,30,.5))"
                        : st === "warn"
                        ? "linear-gradient(to bottom, rgba(255,40,40,.15), rgba(255,40,40,.65))"
                        : lane === i
                        ? "linear-gradient(to bottom, rgba(90,160,255,.04), rgba(90,160,255,.2))"
                        : "linear-gradient(to bottom, rgba(90,160,255,.0), rgba(90,160,255,.07))",
                    transition: st === "strike" ? "none" : "background .25s",
                  }}
                />
                {st === "warn" && (
                  <div
                    className="lane-warn absolute inset-0"
                    style={{
                      clipPath: "polygon(34% 0, 66% 0, 100% 100%, 0 100%)",
                      boxShadow: "inset 0 0 50px rgba(255,0,0,.8)",
                      background: "repeating-linear-gradient(to bottom, rgba(255,60,60,.25) 0 10px, transparent 10px 24px)",
                    }}
                  />
                )}
                {st === "strike" && (
                  <div
                    key={`ring${threat?.id}`}
                    className="ring absolute left-1/2 top-[2%] h-24 w-48 rounded-[50%] border-4 border-orange-200"
                    style={{ boxShadow: "0 0 40px 10px rgba(255,120,40,.9)" }}
                  />
                )}
              </div>
            );
          })}

        {/* ======= Tượng thần ======= */}
        {STATUES.map((s, i) => {
          const attack: Attack = threat && threat.lanes.includes(i) ? threat.mode : "none";
          const g: Gaze = gaze && gaze.statue === i ? gaze.mode : "none";
          return (
            <Statue
              key={i}
              {...s}
              revealed={revealed}
              revealDelay={1.2 + i * 0.7}
              awake={awake}
              shattered={shattered}
              gaze={g}
              attack={attack}
            />
          );
        })}

        {/* ======= Người chơi ======= */}
        {ghosts.map((gh) => (
          <motion.div
            key={gh.id}
            className="pointer-events-none absolute z-[18]"
            style={{ left: `${LANE_X[gh.lane]}%`, bottom: "3%", height: "min(34svh, 52vw)", aspectRatio: "2/3", x: "-50%" }}
            initial={{ opacity: 0.55 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
          >
            <img src={heroStand} alt="" className="h-full w-full object-contain" style={{ filter: "drop-shadow(0 0 14px #4fa8ff) brightness(1.6) saturate(2)" }} />
          </motion.div>
        ))}

        {phase !== "title" && phase !== "quest" && (
          <motion.div
            className="pointer-events-none absolute z-20"
            style={{ height: "min(34svh, 52vw)", aspectRatio: "2/3", x: "-50%" }}
            initial={{ left: "50%", bottom: "11%", opacity: 0 }}
            animate={{
              left: `${LANE_X[phase === "pray" || phase === "awaken" ? 1 : lane]}%`,
              bottom: phase === "pray" ? "11%" : "3%",
              opacity: 1,
            }}
            transition={{
              left: { type: "spring", stiffness: 520, damping: 34 },
              bottom: { duration: 1.2 },
              opacity: { duration: 1 },
            }}
          >
            {/* hào quang */}
            <div
              className="absolute -inset-x-1/3 bottom-0 h-1/2 rounded-[50%] blur-xl transition-all duration-500"
              style={{
                background:
                  phase === "pray"
                    ? `radial-gradient(ellipse, rgba(100,170,255,${0.15 + gauge / 130}), transparent 70%)`
                    : "radial-gradient(ellipse, rgba(110,80,255,.45), transparent 70%)",
              }}
            />
            <motion.div className="relative h-full w-full" animate={tilt}>
              <motion.img
                src={heroKneel}
                alt="Jin Woo"
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain"
                animate={{
                  opacity: standing ? 0 : 1,
                  y: holding ? "1.5%" : "-2.5%",
                  filter: `drop-shadow(0 0 ${8 + gauge / 4}px rgba(80,150,255,${0.5 + gauge / 200}))`,
                }}
                transition={{ duration: 0.4 }}
              />
              <motion.img
                src={heroStand}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain"
                animate={{ opacity: standing ? 1 : 0, filter: "drop-shadow(0 0 14px rgba(90,150,255,.8))" }}
                transition={{ duration: 0.6 }}
              />
            </motion.div>
          </motion.div>
        )}

        {/* thông báo né */}
        <AnimatePresence>
          {pop && (
            <motion.div
              key={pop.id}
              className="pointer-events-none absolute z-30 font-sys text-lg font-black tracking-widest sm:text-2xl"
              style={{
                left: `${LANE_X[lane]}%`,
                bottom: "36%",
                x: "-50%",
                color: pop.kind === "hit" ? "#ff5a5a" : pop.kind === "perfect" ? "#ffd86b" : "#7cc4ff",
                textShadow: `0 0 16px ${pop.kind === "hit" ? "#f00" : pop.kind === "perfect" ? "#ffb300" : "#4fa8ff"}`,
              }}
              initial={{ opacity: 0, y: 10, scale: 0.6 }}
              animate={{ opacity: 1, y: -24, scale: 1 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.35 }}
            >
              {pop.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* tàn lửa + sương */}
        <RainCanvas rain={false} intensity={1} />
        <div className="mist pointer-events-none absolute -inset-x-20 bottom-0 h-1/3 bg-[radial-gradient(ellipse_at_center,rgba(120,140,255,0.16),transparent_65%)]" />
      </div>

      {/* Hiệu ứng toàn màn hình */}
      <div key={`s${strikeKey}`} className={`pointer-events-none absolute inset-0 z-30 bg-white mix-blend-screen opacity-0 ${strikeKey ? "strike-flash" : ""}`} />
      <div
        key={`h${hitKey}`}
        className={`pointer-events-none absolute inset-0 z-30 opacity-0 ${hitKey ? "hit-flash" : ""}`}
        style={{ boxShadow: "inset 0 0 160px 40px rgba(255,0,0,.9)", background: "rgba(255,0,0,.18)" }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-30 transition-opacity duration-300"
        style={{ opacity: gaze?.mode === "on" ? 1 : 0, boxShadow: "inset 0 0 200px 30px rgba(255,0,0,.55)" }}
      />
      <div className="pointer-events-none absolute inset-0 z-[25] shadow-[inset_0_0_200px_rgba(0,0,0,0.95)]" />
      <div
        className="pointer-events-none absolute inset-0 z-[25] opacity-[0.06]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 3px)" }}
      />

      {/* Vùng chạm né đòn */}
      {phase === "dodge" && (
        <div className="absolute inset-x-0 bottom-0 top-[45%] z-[26] touch-none" onPointerDown={onStagePointer} />
      )}

      {/* ======= HUD ======= */}
      {(phase === "pray" || phase === "dodge" || phase === "awaken" || phase === "dead") && (
        <>
          <div className="absolute left-3 top-3 z-40 flex items-center gap-3 sm:left-6 sm:top-5">
            <div
              className="h-11 w-11 rounded-full border border-sky-400 shadow-[0_0_14px_rgba(79,168,255,.8)] sm:h-14 sm:w-14"
              style={{ backgroundImage: `url(${avatar})`, backgroundSize: "260%", backgroundPosition: "58% 20%" }}
            />
            <div>
              <div className="font-sys text-[10px] font-bold tracking-[0.2em] text-sky-200 text-glow sm:text-xs">SUNG JIN WOO</div>
              <div className="mt-1.5 flex gap-1.5">
                {Array.from({ length: MAX_HP }).map((_, i) => (
                  <div
                    key={i}
                    className="h-2 w-8 skew-x-[-20deg] transition-all duration-300 sm:w-11"
                    style={{
                      background: i < hp ? "linear-gradient(90deg,#4fa8ff,#a855ff)" : "rgba(255,255,255,.1)",
                      boxShadow: i < hp ? "0 0 10px #4fa8ff" : "none",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="absolute right-3 top-3 z-40 text-right font-sys text-[10px] tracking-[0.25em] text-sky-300/80 sm:right-6 sm:top-5">
            <div className="text-glow">HỒNG NGỤC</div>
            <div className="mt-1 text-[8px] text-sky-200/50">DUNGEON KÉP</div>
          </div>

          {(phase === "dodge" || phase === "awaken") && (
            <div className="absolute left-1/2 top-3 z-40 -translate-x-1/2 text-center sm:top-5">
              <div className="font-sys text-[10px] tracking-[0.35em] text-red-300 sm:text-xs" style={{ textShadow: "0 0 12px #f33" }}>
                ĐỢT {String(wave).padStart(2, "0")} / {TOTAL_WAVES}
              </div>
              <div className="mx-auto mt-2 h-1 w-32 overflow-hidden rounded-full bg-white/10 sm:w-48">
                <motion.div
                  className="h-full bg-gradient-to-r from-red-500 to-orange-300"
                  animate={{ width: `${(wave / TOTAL_WAVES) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Phụ đề */}
      <AnimatePresence mode="wait">
        {subtitle && phase !== "dead" && (
          <motion.div
            key={subtitle.text}
            className="pointer-events-none absolute inset-x-0 top-[13%] z-40 px-6 text-center"
            initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <span
              className={`inline-block px-4 py-2 text-sm font-semibold sm:text-lg ${
                subtitle.danger ? "font-sys text-red-300" : "text-sky-100"
              }`}
              style={{
                textShadow: subtitle.danger ? "0 0 18px #f00" : "0 0 14px rgba(79,168,255,.8)",
                background: "linear-gradient(90deg,transparent,rgba(0,0,0,.55),transparent)",
              }}
            >
              {subtitle.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Điều khiển cầu nguyện */}
      <AnimatePresence>
        {phase === "pray" && (
          <motion.div
            className="absolute inset-x-0 bottom-3 z-40 flex flex-col items-center gap-2 px-6 sm:bottom-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
          >
            <div className="w-full max-w-sm">
              <div className="mb-1 flex justify-between font-sys text-[9px] tracking-[0.3em] text-sky-300">
                <span>NGHI LỄ CẦU NGUYỆN</span>
                <span>{Math.floor(gauge)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-sky-950 ring-1 ring-sky-500/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-500 shadow-[0_0_14px_#4fa8ff]"
                  style={{ width: `${gauge}%` }}
                />
              </div>
            </div>
            <button
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                holdRef.current = true;
                setHolding(true);
              }}
              onPointerUp={() => {
                holdRef.current = false;
                setHolding(false);
              }}
              onPointerCancel={() => {
                holdRef.current = false;
                setHolding(false);
              }}
              onContextMenu={(e) => e.preventDefault()}
              className={`touch-none select-none border px-8 py-3 font-sys text-xs font-bold tracking-[0.3em] transition sm:text-sm ${
                holding
                  ? "scale-95 border-sky-300 bg-sky-500/40 text-white shadow-[0_0_40px_rgba(79,168,255,.9)]"
                  : "border-sky-500/60 bg-sky-950/60 text-sky-200"
              }`}
            >
              {holding ? "ĐANG CÚI ĐẦU…" : "GIỮ ĐỂ CẦU NGUYỆN"}
            </button>
            <div className="hidden font-sys text-[9px] tracking-[0.25em] text-sky-300/50 sm:block">HOẶC GIỮ PHÍM [SPACE]</div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "dodge" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-40 text-center font-sys text-[9px] tracking-[0.25em] text-sky-300/60">
          ◀ ▶ HOẶC A / D · CHẠM VÀO LÀN ĐỂ NÉ
        </div>
      )}

      {/* ======= Thẻ tiêu đề ======= */}
      <AnimatePresence>
        {phase === "title" && (
          <motion.div
            key="title"
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#02030a] text-center"
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          >
            <RainCanvas rain={false} />
            <motion.div
              initial={{ opacity: 0, letterSpacing: "1em" }}
              animate={{ opacity: 1, letterSpacing: "0.5em" }}
              transition={{ duration: 1.6 }}
              className="font-sys text-xs text-sky-300 text-glow sm:text-sm"
            >
              CHƯƠNG II
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, scale: 1.4, filter: "blur(18px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ delay: 0.8, duration: 1.5, ease: "easeOut" }}
              className="mt-4 font-sys text-5xl font-black text-white sm:text-8xl"
              style={{ textShadow: "0 0 20px #f33, 0 0 60px #a00" }}
            >
              HỒNG NGỤC
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.0, duration: 1 }}
              className="mt-5 text-xs uppercase tracking-[0.4em] text-violet-200/80 sm:text-sm"
            >
              Hầm ngục kép · Ba tượng thần
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======= Bảng nhiệm vụ ======= */}
      <AnimatePresence>
        {phase === "quest" && (
          <motion.div
            key="quest"
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 2.8, duration: 0.8 }}
          >
            <motion.div
              initial={{ scaleY: 0.05, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ delay: 3, duration: 0.55, ease: [0.2, 0.9, 0.25, 1] }}
              className="sys-panel w-full max-w-md p-1"
            >
              <div className="border border-sky-400/30 p-5 sm:p-7">
                <div className="text-center font-sys text-[11px] tracking-[0.4em] text-sky-300 text-glow">[ NHIỆM VỤ ]</div>
                <div className="my-3 h-px border-run" />
                <h3 className="text-center font-sys text-lg font-bold text-white sm:text-xl">SỐNG SÓT</h3>
                <p className="mt-1 text-center text-xs text-sky-100/60">Dungeon Kép · Hồng Ngục</p>
                <ol className="mt-4 space-y-2 text-sm leading-relaxed text-sky-100/85">
                  <li><b className="text-sky-300">1.</b> Quỳ gối và cầu nguyện trước ba tượng thần.</li>
                  <li><b className="text-sky-300">2.</b> Khi tượng thần nhìn xuống, <b className="text-red-300">tuyệt đối không ngẩng đầu</b>.</li>
                  <li><b className="text-sky-300">3.</b> Khi chúng thức tỉnh, hãy né qua {TOTAL_WAVES} đợt trừng phạt.</li>
                </ol>
                <p className="mt-4 text-center text-xs text-red-300/90">Thất bại: <b>CÁI CHẾT</b></p>
                <button
                  onClick={startPray}
                  className="mt-5 w-full border border-sky-400 bg-sky-500/20 py-3 font-sys text-sm font-bold tracking-[0.4em] text-white transition hover:bg-sky-500/40 hover:shadow-[0_0_30px_rgba(79,168,255,.8)] active:scale-95"
                >
                  BƯỚC VÀO
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======= Chết ======= */}
      <AnimatePresence>
        {phase === "dead" && (
          <motion.div
            key="dead"
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 px-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
          >
            <div className="absolute inset-0 shadow-[inset_0_0_250px_rgba(180,0,0,.8)]" />
            <motion.h2
              initial={{ scale: 1.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="relative font-sys text-4xl font-black text-red-500 sm:text-7xl"
              style={{ textShadow: "0 0 30px #f00" }}
            >
              BẠN ĐÃ CHẾT
            </motion.h2>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="relative mt-6 flex flex-col items-center"
            >
              <p className="font-sys text-[11px] tracking-[0.3em] text-sky-300">[ HỆ THỐNG ] BẠN CÓ MUỐN HỒI SINH?</p>
              <button
                onClick={revive}
                className="mt-4 border border-sky-400 bg-sky-500/20 px-10 py-3 font-sys text-sm font-bold tracking-[0.4em] text-white transition hover:bg-sky-500/40 hover:shadow-[0_0_30px_rgba(79,168,255,.8)] active:scale-95"
              >
                HỒI SINH
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======= Phần thưởng ======= */}
      <AnimatePresence>
        {phase === "clear" && reward && (
          <motion.div
            key="reward"
            className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-6 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            {confetti.map((c, i) => (
              <span
                key={i}
                className="pointer-events-none absolute top-0 rounded-sm"
                style={{
                  left: `${c.left}%`,
                  width: c.size,
                  height: c.size * 1.6,
                  background: c.color,
                  boxShadow: `0 0 10px ${c.color}`,
                  animation: `fall ${c.dur}s linear ${c.delay}s infinite`,
                }}
              />
            ))}
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.2 }}
              className="sys-panel relative w-full max-w-lg p-1"
            >
              <div className="border border-sky-400/30 p-6 text-center sm:p-8">
                <div className="font-sys text-[11px] tracking-[0.4em] text-sky-300 text-glow">[ DUNGEON ĐÃ HOÀN THÀNH ]</div>
                <motion.h2
                  initial={{ letterSpacing: "0.8em", opacity: 0 }}
                  animate={{ letterSpacing: "0.2em", opacity: 1 }}
                  transition={{ delay: 0.5, duration: 1.2 }}
                  className="mt-3 font-sys text-4xl font-black text-white text-glow sm:text-5xl"
                >
                  LEVEL UP!
                </motion.h2>
                <div className="my-4 h-px border-run" />

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["HP CÒN LẠI", `${hp}/${MAX_HP}`],
                    ["NÉ HOÀN HẢO", String(perfects)],
                    ["XẾP HẠNG", rank],
                  ].map(([k, v]) => (
                    <div key={k} className="border border-sky-500/30 bg-sky-950/40 py-2">
                      <div className="font-sys text-xl font-bold text-white text-glow sm:text-2xl">{v}</div>
                      <div className="font-sys text-[8px] tracking-[0.2em] text-sky-300/80">{k}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded border border-violet-400/40 bg-violet-950/30 p-4">
                  <div className="font-sys text-[10px] tracking-[0.3em] text-violet-300">PHẦN THƯỞNG ĐẶC BIỆT</div>
                  <p className="mt-2 text-base font-bold text-white sm:text-lg">
                    Chúc mừng sinh nhật <span className="text-sky-300 text-glow">Phạm Hoàng Gia Trí</span> 🎂
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-sky-100/80">
                    Sinh nhật 30/11 – bạn đã vượt qua Hồng Ngục và bước sang một cấp độ mới. Chúc bạn tuổi mới thật mạnh mẽ,
                    bản lĩnh, gặp nhiều may mắn và mọi mục tiêu đều được <b className="text-violet-300">ARISE</b>!
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={replay}
                    className="flex-1 border border-sky-400 bg-sky-500/20 py-3 font-sys text-xs font-bold tracking-[0.3em] text-white transition hover:bg-sky-500/40 active:scale-95"
                  >
                    CHƠI LẠI
                  </button>
                  <button
                    onClick={onExit}
                    className="flex-1 border border-violet-400/70 bg-violet-950/40 py-3 font-sys text-xs font-bold tracking-[0.3em] text-white transition hover:bg-violet-700/40 active:scale-95"
                  >
                    VỀ TRANG ĐẦU
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
