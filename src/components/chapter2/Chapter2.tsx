import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import RainCanvas from "../RainCanvas";
import { GoldenKeyIcon } from "../PortalGate";
import Statue, { type Attack, type Gaze } from "./Statue";
import BossFight, { BOSS_MAX_HP, type BossStats } from "./BossFight";
import { PlayerBehaviorTracker, type PredictionSnapshot } from "./bossAI";
import { avatar, bossIdle, hall, heroKneel, heroStand, s1, s2, s3 } from "./assets";

type Phase = "title" | "quest" | "pray" | "awaken" | "dodge" | "boss" | "dead" | "clear";

/**
 * Kho dự đoán AI dùng useSyncExternalStore: khi AI cập nhật dự đoán (mỗi lần
 * đổi làn, mỗi đợt, hoặc kết quả Gemini trả về) CHỈ thẻ hiển thị re-render —
 * không còn re-render toàn bộ Chapter2 (3 tượng + 3 canvas + toàn bộ HUD).
 */
let predSnapshot: PredictionSnapshot | null = null;
const predListeners = new Set<() => void>();

function setPredSnapshot(next: PredictionSnapshot) {
  predSnapshot = next;
  predListeners.forEach((l) => l());
}

function usePrediction(): PredictionSnapshot | null {
  return useSyncExternalStore(
    (cb) => {
      predListeners.add(cb);
      return () => predListeners.delete(cb);
    },
    () => predSnapshot,
    () => predSnapshot
  );
}

/** Thẻ ML đọc vị: chỉ component này re-render khi AI cập nhật dự đoán. */
const MlReadBadge = memo(function MlReadBadge() {
  const pred = usePrediction();
  if (!pred) return null;
  return (
    <div className="mt-1 inline-flex items-center gap-1 rounded-sm border border-violet-400/35 bg-[#12061e]/85 px-2 py-0.5 font-sys text-[7px] tracking-[0.14em] text-violet-200">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
      <span>
        {pred.warmedUp
          ? `ML ĐỌC VỊ ${pred.adaptRate}% · MẪU ${pred.samples} · [${LANE_NAMES[pred.predictedLane]}]`
          : `ML THU THẬP ${pred.samples}/3`}
      </span>
      {pred.geminiStatus === "active" && (
        <span className="border border-cyan-400/50 bg-cyan-950/60 px-1 text-[6.5px] text-cyan-200">
          + GEMINI
        </span>
      )}
    </div>
  );
});
type Threat = { lanes: number[]; mode: "warn" | "strike"; id: number; aiLocked?: boolean };
type Pop = { id: number; text: string; kind: "perfect" | "dodge" | "hit" | "warn" };

const MAX_HP = 3;
const TOTAL_WAVES = 12;
const LANE_X = [17, 50, 83];
const LANE_NAMES = ["TRÁI", "GIỮA", "PHẢI"];

const STATUES = [
  { src: s1, x: 17, eye: [54, 6.5] as [number, number], bottom: "33%", height: "min(58svh, 62vw)" },
  { src: s2, x: 50, eye: [50, 8.5] as [number, number], bottom: "35%", height: "min(52svh, 58vw)" },
  { src: s3, x: 83, eye: [49, 10] as [number, number], bottom: "33%", height: "min(58svh, 62vw)" },
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Props = {
  onExit: () => void;
  onCollectKey?: () => void;
  initialPhase?: Phase;
  initialWave?: number;
  initialBossHp?: number;
};

export default function Chapter2({
  onExit,
  onCollectKey,
  initialPhase = "title",
  initialWave = 0,
  initialBossHp = BOSS_MAX_HP,
}: Props) {
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [hp, setHp] = useState(MAX_HP);
  const [lane, setLane] = useState(1);
  const [gauge, setGauge] = useState(0);
  const [holding, setHolding] = useState(false);
  const [gaze, setGaze] = useState<{ statue: number; mode: Gaze } | null>(null);
  const [threat, setThreat] = useState<Threat | null>(null);
  const [wave, setWave] = useState(initialWave);
  const [awake, setAwake] = useState(initialPhase === "dodge" || initialPhase === "boss" || initialPhase === "clear");
  const [shattered, setShattered] = useState(initialPhase === "clear");
  const [reward, setReward] = useState(initialPhase === "clear");
  const [perfects, setPerfects] = useState(0);
  const [pop, setPop] = useState<Pop | null>(null);
  const [ghosts, setGhosts] = useState<{ id: number; lane: number }[]>([]);
  const [strikeKey, setStrikeKey] = useState(0);
  const [hitKey, setHitKey] = useState(0);
  const [runId, setRunId] = useState(0);
  const [bossRun, setBossRun] = useState(0);
  const [bossStats, setBossStats] = useState<BossStats | null>(() =>
    initialPhase === "clear" ? { counters: 12, crits: 5, misses: 1, bestCombo: 8, hpLeft: 3, maxAdapt: 74 } : null
  );
  const dodgeTrackerRef = useRef<PlayerBehaviorTracker | null>(null);
  if (!dodgeTrackerRef.current) dodgeTrackerRef.current = new PlayerBehaviorTracker(true);
  /** Dự đoán mới nhất — đọc bằng ref nên không gây re-render. */
  const predRef = useRef<PredictionSnapshot>(dodgeTrackerRef.current!.predict(1));
  const publishPred = useCallback((snap: PredictionSnapshot) => {
    predRef.current = snap;
    setPredSnapshot(snap);
  }, []);

  // Đồng bộ kho ngoài mỗi khi component mount lại (đổi trận / hồi sinh).
  useEffect(() => {
    setPredSnapshot(predRef.current);
  }, []);

  const phaseRef = useRef<Phase>(initialPhase);
  const hpRef = useRef(MAX_HP);
  const laneRef = useRef(1);
  const holdRef = useRef(false);
  const threatRef = useRef<Threat | null>(null);
  const escapeRef = useRef(0);
  const threatWarnAtRef = useRef(0);
  const invulnRef = useRef(0);
  const deathFrom = useRef<"pray" | "dodge" | "boss">("pray");
  const bossProgressRef = useRef(initialBossHp);
  const startWaveRef = useRef(initialWave);
  const fastQuestRef = useRef(initialPhase === "quest");
  const idRef = useRef(0);
  const popTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tilt = useAnimationControls();
  const sceneShake = useAnimationControls();

  const triggerShake = useCallback(
    (power = 11) => {
      sceneShake.start({
        x: [0, -power, power * 0.8, -power * 0.6, power * 0.35, 0],
        y: [0, power * 0.55, -power * 0.65, power * 0.35, -power * 0.2, 0],
        transition: { duration: 0.42, ease: "easeOut" },
      });
    },
    [sceneShake]
  );

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const onKeyChange = () => {
      if (!dodgeTrackerRef.current) return;
      dodgeTrackerRef.current.refreshGeminiState();
      publishPred(dodgeTrackerRef.current.predict(laneRef.current));
    };
    window.addEventListener("sl-gemini-key-changed", onKeyChange);
    return () => window.removeEventListener("sl-gemini-key-changed", onKeyChange);
  }, []);

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
    triggerShake(13);
    return true;
  }, [triggerShake]);

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
      const reaction = threatWarnAtRef.current > 0 ? performance.now() - threatWarnAtRef.current : undefined;
      dodgeTrackerRef.current!.recordMove(old, n, reaction, true);
      publishPred(dodgeTrackerRef.current!.predict(n));
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
    if (hp <= 0 && (phase === "pray" || phase === "dodge" || phase === "boss")) {
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
    let painted = -1;
    let lastPaint = 0;
    setGauge(0);
    let nextGaze = last + 2200;
    let gz: { statue: number; start: number; mode: "warn" | "on"; hit: boolean } | null = null;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g += (holdRef.current ? 22 : -18) * dt;
      g = Math.max(0, Math.min(100, g));
      // Chỉ setState khi giá trị nguyên thay đổi: trước đây gọi setGauge mỗi
      // frame khiến TOÀN BỘ cây Chapter2 re-render 60 lần/giây (nguyên nhân lag).
      // Giới hạn ~15 lần/giây (đủ mượt cho thanh % và hào quang) thay vì 60.
      const rounded = Math.round(g);
      if (rounded !== painted && now - lastPaint >= 66) {
        painted = rounded;
        lastPaint = now;
        setGauge(rounded);
      }

      if (!gz && now > nextGaze) {
        gz = { statue: Math.floor(Math.random() * 3), start: now, mode: "warn", hit: false };
        setGaze({ statue: gz.statue, mode: "warn" });
      }
      if (gz) {
        const e = now - gz.start;
        if (gz.mode === "warn" && e > 740) {
          gz.mode = "on";
          setGaze({ statue: gz.statue, mode: "on" });
        }
        if (gz.mode === "on") {
          if (!holdRef.current && !gz.hit) {
            gz.hit = true;
            damage();
          }
          if (e > 2050) {
            gz = null;
            setGaze(null);
            nextGaze = now + (Math.random() < 0.35 ? 850 : 1350 + Math.random() * 1100);
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
    triggerShake(14);
    setStrikeKey((k) => k + 1);
    const t = setTimeout(() => setPhase("dodge"), 3400);
    return () => clearTimeout(t);
  }, [phase, triggerShake]);

  // ---------- Né đòn ----------
  useEffect(() => {
    if (phase !== "dodge") return;
    let cancelled = false;
    const tracker = dodgeTrackerRef.current!;
    tracker.beginBattle();
    laneRef.current = 1;
    setLane(1);
    const firstWave = startWaveRef.current;
    startWaveRef.current = 0;
    setWave(firstWave);
    setThreatBoth(null);
    setPerfects(0);

    (async () => {
      await sleep(950);
      let perfectCount = 0;
      for (let i = firstWave; i < TOTAL_WAVES; i++) {
        if (cancelled) return;
        setWave(i + 1);
        const warn = Math.max(690, 1220 - i * 48);

        // Đội hình đòn đánh đa dạng dần theo đợt:
        //   đợt 1-2: 1 tia
        //   đợt 3-8: 2 tia — sát nhau HOẶC hai bên (hai bên trước đây không có)
        //   đợt 9-12: thỉnh thoảng ĐỢT KÉP (né nhịp 1 rồi phải né tiếp nhịp 2)
        const adaptiveChance = i < 3 ? 0.45 : i < 7 ? 0.72 : 0.9;
        const isDouble = i >= 8 && Math.random() < (i >= 10 ? 0.5 : 0.32);
        const oneLane = i < 2;

        const picked = tracker.pickTargetedLanes(laneRef.current, oneLane ? 1 : 2, adaptiveChance, {
          wave: i,
          // "2 tia hai bên" mở từ đợt 3 (trước đây không bao giờ xuất hiện)
          allowSplit: i >= 2,
        });
        const double = isDouble ? tracker.pickDoubleStrike(laneRef.current, 0.9, i) : null;
        let lanes = double ? double.first : picked.lanes;
        publishPred(double ? double.predicted : picked.predicted);
        threatWarnAtRef.current = performance.now();
        const aiLocked = (double ? double.aiUsed : picked.aiUsed) && i >= 2;
        setThreatBoth({ lanes, mode: "warn", id: i, aiLocked });
        if (double) showPop("ĐỢT KÉP!", "warn");

        // Đợt 9 & 11: tượng thần đọc vị bước né sớm và đổi hướng 1 lần (vẫn cho 580ms phản ứng)
        if ((i === 8 || i === 10) && !double && picked.predicted.warmedUp) {
          await sleep(Math.round(warn * 0.55));
          if (cancelled) return;
          if (!lanes.includes(laneRef.current)) {
            const retarget = tracker.pickTargetedLanes(laneRef.current, 2, 0.92, {
              wave: i,
              allowSplit: true,
              allowFull: false,
            });
            lanes = retarget.lanes;
            publishPred(retarget.predicted);
            threatWarnAtRef.current = performance.now();
            setThreatBoth({ lanes, mode: "warn", id: i, aiLocked: true });
            showPop("ĐỔI HƯỚNG!", "warn");
            await sleep(580);
          } else {
            await sleep(Math.round(warn * 0.45));
          }
        } else {
          await sleep(warn);
        }
        if (cancelled) return;

        const strike: Threat = { lanes, mode: "strike", id: i, aiLocked };
        setThreatBoth(strike);
        setStrikeKey((k) => k + 1);
        triggerShake(10);
        const hit = lanes.includes(laneRef.current);
        if (hit) {
          if (damage()) showPop("-1 HP", "hit");
        } else if (performance.now() - escapeRef.current < 520) {
          perfectCount++;
          setPerfects(perfectCount);
          showPop(aiLocked ? "PHÁ ĐỌC VỊ!" : "NÉ HOÀN HẢO!", "perfect");
        } else {
          showPop("NÉ!", "dodge");
        }
        tracker.recordStay(laneRef.current, true);
        publishPred(tracker.predict(laneRef.current));
        tracker.maybeSyncGemini(laneRef.current, 1, "gaze", (s) => {
          if (!cancelled) publishPred(s);
        });

        // ---- Nhịp 2 của ĐỢT KÉP: đánh đúng làn vừa an toàn, buộc né tiếp ----
        if (double) {
          await sleep(300);
          if (cancelled) return;
          const saved = [0, 1, 2].filter((l) => !double.second.includes(l))[0];
          const warn2 = 620;
          threatWarnAtRef.current = performance.now();
          setThreatBoth({ lanes: double.second, mode: "warn", id: i, aiLocked: true });
          showPop(saved !== undefined && saved === laneRef.current ? "NÉ TIẾP!" : "ĐỔI LÀN!", "warn");
          await sleep(warn2);
          if (cancelled) return;
          setThreatBoth({ lanes: double.second, mode: "strike", id: i, aiLocked: true });
          setStrikeKey((k) => k + 1);
          triggerShake(10);
          if (double.second.includes(laneRef.current)) {
            if (damage()) showPop("-1 HP", "hit");
          } else if (performance.now() - escapeRef.current < 520) {
            perfectCount++;
            setPerfects(perfectCount);
            showPop("PHÁ ĐỢT KÉP!", "perfect");
          } else {
            showPop("NÉ!", "dodge");
          }
          tracker.recordStay(laneRef.current, true);
          await sleep(400);
          if (cancelled) return;
          setThreatBoth(null);
        }

        threatWarnAtRef.current = 0;
        await sleep(460);
        if (cancelled) return;
        setThreatBoth(null);
        await sleep(450);
      }
      if (!cancelled && hpRef.current > 0) setPhase("boss");
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, runId, damage, showPop, triggerShake]);

  // ---------- Chiến thắng ----------
  useEffect(() => {
    if (phase !== "clear") return;
    setThreatBoth(null);
    setAwake(false);
    setShattered(true);
    setStrikeKey((k) => k + 1);
    triggerShake(16);
    const t = setTimeout(() => setReward(true), 2000);
    return () => clearTimeout(t);
  }, [phase, triggerShake]);

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
  const heal = useCallback((n: number) => {
    hpRef.current = Math.min(MAX_HP, hpRef.current + n);
    setHp(hpRef.current);
  }, []);

  const onBossProgress = useCallback((v: number) => {
    bossProgressRef.current = v;
  }, []);

  const onBossVictory = useCallback((stats: BossStats) => {
    setBossStats(stats);
    setPhase("clear");
  }, []);

  const startPray = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    hpRef.current = MAX_HP;
    setHp(MAX_HP);
    holdRef.current = false;
    setHolding(false);
    setPhase("pray");
    setRunId((r) => r + 1);
  };

  const revive = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    hpRef.current = MAX_HP;
    invulnRef.current = performance.now() + 1200;
    setHp(MAX_HP);
    holdRef.current = false;
    setHolding(false);
    setThreatBoth(null);
    setPhase(deathFrom.current);
    setRunId((r) => r + 1);
    setBossRun((r) => r + 1);
  };

  const replay = () => {
    setReward(false);
    setShattered(false);
    setAwake(false);
    setPerfects(0);
    setWave(0);
    setBossStats(null);
    bossProgressRef.current = BOSS_MAX_HP;
    setBossRun(0);
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
      return { text: "“Hãy cầu nguyện. Kẻ nào ngẩng đầu sẽ bị trừng phạt.”", danger: false };
    }
    if (phase === "awaken") return { text: "Các tượng thần… đã thức tỉnh.", danger: true };
    if (phase === "dodge") return { text: "Né khỏi vùng đỏ trước khi tượng thần giáng đòn!", danger: false };
    return null;
  }, [phase, gaze]);

  const rank = useMemo(() => {
    const lowMiss = bossStats ? bossStats.misses <= 1 : false;
    if (hp >= MAX_HP && perfects >= 5 && lowMiss) return "S+";
    if (hp >= MAX_HP && perfects >= 3) return "S";
    if (hp >= 2) return "A";
    return "B";
  }, [hp, perfects, bossStats]);

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
      <motion.div className="absolute inset-0" animate={sceneShake}>
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
            const isPred = threat?.aiLocked && predRef.current.predictedLane === i;
            return (
              <div
                key={i}
                className="pointer-events-none absolute z-[5]"
                style={{ left: `${LANE_X[i]}%`, top: "32%", bottom: 0, width: "30%", transform: "translateX(-50%)" }}
              >
                {/* Cột tia trừng phạt từ trên xuống */}
                {st === "strike" && (
                  <div
                    className="beam-strike absolute inset-x-[14%] top-0 bottom-[6%]"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,60,30,.55) 25%, rgba(255,220,160,.95) 50%, rgba(255,60,30,.55) 75%, transparent)",
                      boxShadow: "0 0 50px rgba(255,70,30,.9)",
                      filter: "blur(1px)",
                    }}
                  />
                )}
                {st === "warn" && (
                  <div
                    className="lane-warn absolute inset-x-[42%] top-0 bottom-[8%]"
                    style={{
                      background:
                        "linear-gradient(to bottom, rgba(255,40,30,.15), rgba(255,70,40,.85))",
                      boxShadow: "0 0 18px rgba(255,40,30,.7)",
                    }}
                  />
                )}
                {/* Khung làn dưới sàn */}
                <div
                  className="absolute inset-x-1 bottom-3 h-20 rounded-xl border transition-all duration-200"
                  style={{
                    borderColor:
                      st === "strike"
                        ? "rgba(255,190,110,.95)"
                        : st === "warn"
                        ? "rgba(255,65,45,.8)"
                        : lane === i
                        ? "rgba(79,168,255,.55)"
                        : "rgba(79,168,255,.15)",
                    background:
                      st === "strike"
                        ? "radial-gradient(ellipse at 50% 60%, rgba(255,110,50,.55), transparent 75%)"
                        : st === "warn"
                        ? "radial-gradient(ellipse at 50% 60%, rgba(255,40,30,.32), transparent 72%)"
                        : lane === i
                        ? "radial-gradient(ellipse at 50% 60%, rgba(79,168,255,.18), transparent 72%)"
                        : "transparent",
                    boxShadow:
                      st === "warn"
                        ? "0 0 28px rgba(255,40,20,.45), inset 0 0 22px rgba(255,40,20,.25)"
                        : "none",
                  }}
                >
                  {st === "warn" && (
                    <div className="flex h-full items-center justify-center font-sys text-[8px] font-bold tracking-[0.22em] text-red-200">
                      {isPred ? "BẮT BÀI!" : "NGUY HIỂM"}
                    </div>
                  )}
                </div>
                {st === "strike" && (
                  <div
                    key={`ring${threat?.id}`}
                    className="ring absolute bottom-6 left-1/2 h-20 w-44 rounded-[50%] border-4 border-orange-200"
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

        {phase !== "title" && phase !== "quest" && phase !== "boss" && (
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
                }}
                style={{
                  // KHÔNG animate filter theo từng frame (re-raster ảnh -> lag).
                  // Hào quang đã có lớp radial-gradient phía sau đảm nhiệm.
                  filter: "drop-shadow(0 0 12px rgba(80,150,255,0.65))",
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
                color: pop.kind === "hit" ? "#ff5a5a" : pop.kind === "warn" ? "#e879f9" : pop.kind === "perfect" ? "#ffd86b" : "#7cc4ff",
                textShadow: `0 0 16px ${pop.kind === "hit" ? "#f00" : pop.kind === "warn" ? "#c026d3" : pop.kind === "perfect" ? "#ffb300" : "#4fa8ff"}`,
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

        {/* tàn lửa + sương — giảm mật độ để nhường GPU cho hiệu ứng chính */}
        <RainCanvas rain={false} intensity={0.55} />
        <div className="mist pointer-events-none absolute -inset-x-20 bottom-0 h-1/3 bg-[radial-gradient(ellipse_at_center,rgba(120,140,255,0.16),transparent_65%)]" />
      </motion.div>

      {/* ======= BOSS CUỐI ======= */}
      {(phase === "boss" || (phase === "dead" && deathFrom.current === "boss")) && (
        <div className="absolute inset-0 z-[35]">
          <BossFight
            key={`boss-${bossRun}`}
            hp={hp}
            maxHp={MAX_HP}
            startHp={bossProgressRef.current}
            onProgress={onBossProgress}
            onDamage={damage}
            onHeal={heal}
            onVictory={onBossVictory}
          />
        </div>
      )}

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
              <div className="mx-auto mt-1.5 h-1 w-32 overflow-hidden rounded-full bg-white/10 sm:w-48">
                <motion.div
                  className="h-full bg-gradient-to-r from-red-500 to-orange-300"
                  animate={{ width: `${(wave / TOTAL_WAVES) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              {phase === "dodge" && threat && (
                <div
                  className={`mt-1 inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-sys text-[7px] tracking-[0.14em] ${
                    threat.lanes.length === 2 && threat.lanes.join(",") === "0,2"
                      ? "border-amber-300/60 bg-amber-950/60 text-amber-200"
                      : "border-sky-400/40 bg-sky-950/60 text-sky-200"
                  }`}
                >
                  <span className="h-1 w-1 rounded-full bg-current" />
                  {threat.lanes.length === 1
                    ? "ĐỘI HÌNH · 1 TIA"
                    : threat.lanes.length === 3
                    ? "ĐỘI HÌNH · TOÀN SÀN"
                    : threat.lanes.join(",") === "0,2"
                    ? "ĐỘI HÌNH · 2 TIA HAI BÊN"
                    : "ĐỘI HÌNH · 2 TIA SÁT NHAU"}
                </div>
              )}
              {phase === "dodge" && wave >= 3 && <MlReadBadge />}
            </div>
          )}
        </>
      )}

      {/* Phụ đề */}
      <AnimatePresence mode="wait">
        {subtitle && phase !== "dead" && (
          <motion.div
            key={subtitle.text}
            className="pointer-events-none absolute inset-x-0 top-[15.5%] z-40 px-6 text-center"
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
            className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#04020a] px-5 text-center"
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          >
            {/* mặt tượng thần phía sau */}
            <motion.img
              src={bossIdle}
              alt=""
              className="pointer-events-none absolute inset-x-0 top-0 h-full w-full object-cover object-[50%_26%] opacity-[0.42]"
              initial={{ scale: 1.4, opacity: 0 }}
              animate={{ scale: 1.05, opacity: 0.42 }}
              transition={{ duration: 4, ease: "easeOut" }}
              style={{ mixBlendMode: "screen", filter: "saturate(.7) brightness(.95)" }}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(255,40,20,0.22),transparent_60%)]" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#04020a] via-[#04020a]/40 to-[#04020a]/80" />
            <RainCanvas rain={false} />

            <div className="relative z-10 flex flex-col items-center">
              <motion.div
                initial={{ opacity: 0, letterSpacing: "1em" }}
                animate={{ opacity: 1, letterSpacing: "0.5em" }}
                transition={{ duration: 1.6 }}
                className="font-sys text-[10px] text-sky-300 text-glow sm:text-sm"
              >
                CHƯƠNG II
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, scale: 1.3, filter: "blur(24px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ delay: 0.7, duration: 1.6, ease: "easeOut" }}
                className="title-grad-red mt-3 font-sys text-5xl font-black tracking-[0.08em] sm:text-8xl"
              >
                HỒNG NGỤC
              </motion.h1>

              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 1.7, duration: 1 }}
                className="mt-4 h-px w-52 bg-gradient-to-r from-transparent via-red-500 to-transparent sm:w-80"
              />

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.9, duration: 1 }}
                className="mt-4 text-[11px] uppercase tracking-[0.35em] text-violet-200/85 sm:text-sm"
              >
                Hầm ngục kép · Ba tượng thần
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.4, duration: 1 }}
                className="sys-panel-danger sys-cut mt-6 flex items-center gap-3 px-4 py-2.5"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                <span className="font-sys text-[8px] tracking-[0.28em] text-red-200 sm:text-[10px]">
                  BOSS ẨN · CẤP SSS · TƯỢNG THẦN MỈM CƯỜI
                </span>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.8, 0.35, 0.8] }}
                transition={{ delay: 2.9, duration: 2.4, repeat: Infinity }}
                className="mt-5 font-sys text-[8px] tracking-[0.4em] text-sky-300/60"
              >
                ĐANG KẾT NỐI…
              </motion.p>
            </div>

            <div className="absolute inset-x-0 top-0 z-10 h-[6%] bg-black" />
            <div className="absolute inset-x-0 bottom-0 z-10 h-[6%] bg-black" />
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
            animate={{ opacity: 1, transition: { delay: fastQuestRef.current ? 0.1 : 2.8, duration: 0.7 } }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          >
            <motion.div
              initial={{ scaleY: 0.05, opacity: 0 }}
              animate={{
                scaleY: 1,
                opacity: 1,
                transition: { delay: fastQuestRef.current ? 0.18 : 3, duration: 0.55, ease: [0.2, 0.9, 0.25, 1] },
              }}
              exit={{ scaleY: 0.9, opacity: 0, transition: { duration: 0.2 } }}
              className="sys-panel w-full max-w-md p-1"
            >
              <div className="border border-sky-400/30 p-5 sm:p-7">
                <div className="text-center font-sys text-[11px] tracking-[0.4em] text-sky-300 text-glow">[ NHIỆM VỤ ĐẶC BIỆT ]</div>
                <div className="my-3 h-px border-run" />
                <h3 className="text-center font-sys text-lg font-bold text-white sm:text-xl">SỐNG SÓT</h3>
                <p className="mt-1 text-center text-xs text-sky-100/60">Dungeon Kép · Hồng Ngục</p>

                <div className="relative mt-4 overflow-hidden border border-red-500/30 bg-red-950/20">
                  <img
                    src={bossIdle}
                    alt=""
                    className="absolute inset-y-0 right-0 h-full w-2/5 object-cover object-[50%_28%] opacity-65"
                    style={{ mixBlendMode: "screen", maskImage: "linear-gradient(to right, transparent, #000 45%)" }}
                  />
                  <div className="relative p-3">
                    <div className="font-sys text-[8px] tracking-[0.35em] text-red-300">BOSS CUỐI · CẤP SSS</div>
                    <div className="mt-1 font-sys text-sm font-black tracking-[0.14em] text-white" style={{ textShadow: "0 0 16px #f00" }}>
                      TƯỢNG THẦN MỈM CƯỜI
                    </div>
                    <div className="mt-1 text-[10px] leading-relaxed text-red-100/70">
                      3 thanh máu · <b className="text-violet-300">AI đọc vị di chuyển</b> · 4 kỹ năng:{" "}
                      <b className="text-red-300">Trừng Phạt</b>, <b className="text-amber-300">Cuồng Tiếng Cười</b>,{" "}
                      <b className="text-pink-300">Nắm Đấm Thần</b>, <b className="text-fuchsia-300">Phán Xét Kép</b>.
                    </div>
                  </div>
                </div>

                <ol className="mt-4 space-y-2 text-sm leading-relaxed text-sky-100/85">
                  <li><b className="text-sky-300">1.</b> Quỳ gối và cầu nguyện trước ba tượng thần.</li>
                  <li><b className="text-sky-300">2.</b> Khi tượng thần nhìn xuống, <b className="text-red-300">tuyệt đối không ngẩng đầu</b>.</li>
                  <li><b className="text-sky-300">3.</b> Khi chúng thức tỉnh, hãy né qua {TOTAL_WAVES} đợt trừng phạt.</li>
                  <li><b className="text-sky-300">4.</b> Bước vào tầng sâu nhất và <b className="text-red-300">đánh bại boss</b> bằng cách né đòn, chịu đòn và phản công đúng nhịp.</li>
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
            className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 px-3 py-8 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            {/* hào quang vàng */}
            <div className="pointer-events-none absolute left-1/2 top-1/3 h-[70vh] w-[70vh] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,190,80,0.22),transparent_65%)] blur-2xl" />
            <div className="rune-spin pointer-events-none absolute left-1/2 top-1/2 h-[86vh] w-[86vh] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400/10" />
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
              initial={{ scale: 0.72, opacity: 0, y: 44 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 110, damping: 14, delay: 0.2 }}
              className="sys-panel sys-cut relative w-full max-w-lg p-1"
            >
              <div className="frame-sweep absolute inset-x-0 top-0 h-[2px]" />
              <div className="relative border border-sky-400/20 px-5 pb-6 pt-7 text-center sm:px-7">
                <div className="font-sys text-[10px] tracking-[0.4em] text-sky-300 text-glow">
                  [ HỒNG NGỤC · ĐÃ CHINH PHỤC ]
                </div>

                <motion.div
                  initial={{ scale: 0, rotate: -30, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.55 }}
                  className="relative mx-auto mt-4 flex h-20 w-20 items-center justify-center rounded-full sm:h-24 sm:w-24"
                  style={{
                    background: "radial-gradient(circle, rgba(255,214,120,.22), rgba(120,60,10,.15) 60%, transparent 72%)",
                    border: "1px solid rgba(255,205,110,.65)",
                    boxShadow: "0 0 34px rgba(255,190,70,.55), inset 0 0 24px rgba(255,190,70,.35)",
                  }}
                >
                  <span className="font-sys text-3xl font-black text-amber-200 sm:text-4xl" style={{ textShadow: "0 0 22px #ffb300" }}>
                    {rank}
                  </span>
                  <span className="absolute -bottom-2 bg-[#08111f] px-2 font-sys text-[7px] tracking-[0.25em] text-amber-300/90">
                    RANK
                  </span>
                </motion.div>

                <motion.h2
                  initial={{ letterSpacing: "0.7em", opacity: 0 }}
                  animate={{ letterSpacing: "0.18em", opacity: 1 }}
                  transition={{ delay: 0.45, duration: 1.1 }}
                  className="mt-5 font-sys text-4xl font-black text-white sm:text-5xl"
                  style={{ textShadow: "0 0 24px rgba(79,168,255,.9), 0 0 70px rgba(168,85,255,.6)" }}
                >
                  LEVEL UP!
                </motion.h2>

                <div className="my-4 h-px border-run" />

                {/* boss đã bị đánh bại */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.7 }}
                  className="relative overflow-hidden border border-red-500/30 bg-red-950/25 px-3 py-2.5 text-left"
                >
                  <img
                    src={bossIdle}
                    alt=""
                    className="absolute -right-2 -top-1 h-24 w-24 object-cover object-[50%_28%] opacity-40"
                    style={{ mixBlendMode: "screen", filter: "saturate(.7)" }}
                  />
                  <div className="relative flex items-center gap-2">
                    <span className="font-sys text-[8px] tracking-[0.3em] text-red-300">BOSS ĐÃ BỊ ĐÁNH BẠI</span>
                    <span className="h-px flex-1 bg-gradient-to-r from-red-500/60 to-transparent" />
                  </div>
                  <div className="relative mt-1 font-sys text-sm font-black tracking-[0.12em] text-white" style={{ textShadow: "0 0 14px #ff3a20" }}>
                    TƯỢNG THẦN MỈM CƯỜI
                  </div>
                  <div className="relative mt-1 font-sys text-[8px] tracking-[0.2em] text-red-200/75">
                    {bossStats
                      ? `${bossStats.counters} PHẢN CÔNG · ${bossStats.crits} CHÍ MẠNG · AI ĐỌC VỊ TỐI ĐA ${bossStats.maxAdapt}%`
                      : "SẠCH BÓNG TỰ TRỌNG"}
                  </div>
                </motion.div>

                <div className="mt-3 grid grid-cols-4 gap-1.5 text-center sm:gap-2">
                  {[
                    ["HP", `${hp}/${MAX_HP}`],
                    ["NÉ ĐỈNH", String(perfects)],
                    ["COMBO", bossStats ? `×${bossStats.bestCombo}` : "—"],
                    ["RANK", rank],
                  ].map(([k, v], i) => (
                    <motion.div
                      key={k}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1 + i * 0.1, duration: 0.45 }}
                      className="border border-sky-500/25 bg-sky-950/40 py-2"
                    >
                      <div className="font-sys text-lg font-bold text-white text-glow sm:text-xl">{v}</div>
                      <div className="font-sys text-[7px] tracking-[0.18em] text-sky-300/80">{k}</div>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2, duration: 0.7 }}
                  className="mt-4 rounded border border-amber-300/50 bg-gradient-to-b from-amber-950/45 via-amber-900/20 to-emerald-950/30 p-4 shadow-[0_0_28px_rgba(251,191,36,0.2)]"
                >
                  <div className="font-sys text-[9px] tracking-[0.3em] text-amber-300">[ VẬT PHẨM RƠI TỪ BOSS ]</div>
                  <div className="mt-2.5 flex items-center justify-center gap-3">
                    <motion.div
                      animate={{ rotate: [-6, 6, -6], y: [0, -5, 0] }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-amber-300/70 bg-amber-500/15 shadow-[0_0_24px_rgba(251,191,36,0.6)]"
                    >
                      <GoldenKeyIcon className="h-9 w-9" />
                    </motion.div>
                    <div className="text-left">
                      <div className="font-sys text-sm font-black tracking-[0.08em] text-amber-200 sm:text-base">
                        CHÌA KHÓA THẾ GIỚI 30/11
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-amber-100/80">
                        Dùng để mở <b className="text-white">Cánh Cổng Đóng</b> tại sảnh chính và bước vào thế giới sinh nhật{" "}
                        <b className="text-amber-200">Phạm Hoàng Gia Trí</b>.
                      </p>
                    </div>
                  </div>
                </motion.div>

                <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                  <button
                    onClick={() => (onCollectKey ? onCollectKey() : onExit())}
                    className="group relative flex-1 overflow-hidden border border-amber-300 bg-gradient-to-r from-amber-500/30 to-emerald-500/25 py-3 font-sys text-xs font-bold tracking-[0.22em] text-amber-100 transition hover:from-amber-500/45 hover:to-emerald-500/40 hover:shadow-[0_0_32px_rgba(251,191,36,0.65)] active:scale-95"
                  >
                    <span className="relative z-10">✦ NHẶT CHÌA KHÓA &amp; VỀ SẢNH</span>
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber-200/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  </button>
                  <button
                    onClick={replay}
                    className="border border-sky-400/70 bg-sky-950/50 px-5 py-3 font-sys text-xs font-bold tracking-[0.26em] text-white transition hover:bg-sky-800/50 active:scale-95"
                  >
                    CHƠI LẠI
                  </button>
                </div>

                <p className="mt-3 font-sys text-[7px] tracking-[0.3em] text-sky-300/40">
                  HỆ THỐNG · GHI NHẬN NGƯỜI CHƠI ĐÃ TRỞ THÀNH BẬC THẦY CỦA BÓNG TỐI
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
