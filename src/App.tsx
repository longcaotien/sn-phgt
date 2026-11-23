import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BootSequence from "./components/BootSequence";
import Hero from "./components/Hero";
import type { DevTarget } from "./components/DevJump";

// Chương II & Thế giới sinh nhật nặng (nhiều canvas/ảnh) => tách chunk riêng,
// chỉ tải khi người chơi thực sự bước vào. Lần đầu mở trang nhanh hơn rất nhiều.
const Chapter2 = lazy(() => import("./components/chapter2/Chapter2"));
const BirthdayWorld = lazy(() => import("./components/birthday/BirthdayWorld"));
// Bảng dev/Gemini chỉ là công cụ: nạp sau khi trang đã rảnh (không chặn first paint).
const DevJump = lazy(() => import("./components/DevJump"));

const KEY_FLAG = "sl_birthday_key";

function loadSavedKey(): boolean {
  try {
    return localStorage.getItem(KEY_FLAG) === "1";
  } catch {
    return false;
  }
}

function saveKey(v: boolean) {
  try {
    if (v) localStorage.setItem(KEY_FLAG, "1");
    else localStorage.removeItem(KEY_FLAG);
  } catch {
    // ignore storage errors
  }
}

function getInitialFromUrl(): {
  booted: boolean;
  chapter: 1 | 2 | "birthday";
  hasKey: boolean;
  birthdayStage?: "celebrate" | "ending";
  c2Init?: Extract<DevTarget, { chapter: 2 }>;
} {
  const s = new URLSearchParams(location.search).get("stage");
  const savedKey = loadSavedKey();
  if (s === "hero") return { booted: true, chapter: 1, hasKey: savedKey };
  if (s === "gate") return { booted: true, chapter: 1, hasKey: true };
  if (s === "birthday") return { booted: true, chapter: "birthday", hasKey: true, birthdayStage: "celebrate" };
  if (s === "ending") return { booted: true, chapter: "birthday", hasKey: true, birthdayStage: "ending" };
  if (s === "quest") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "quest" } };
  if (s === "pray") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "pray" } };
  if (s === "dodge") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "dodge", wave: 0 } };
  if (s === "boss") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "boss", bossHp: 360 } };
  if (s === "boss2") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "boss", bossHp: 240 } };
  if (s === "boss3") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "boss", bossHp: 120 } };
  if (s === "clear") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "clear" } };
  return { booted: false, chapter: 1, hasKey: savedKey };
}

/** Màn hình chờ nhẹ khi đang tải chunk (thường chỉ vài trăm ms). */
function LoadingVeil() {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#02030a]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="font-sys text-[10px] tracking-[0.4em] text-sky-300/80">ĐANG MỞ CỔNG…</div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-sky-950">
        <div className="frame-sweep h-full w-full" />
      </div>
    </motion.div>
  );
}

export default function App() {
  const [init] = useState(getInitialFromUrl);
  const [booted, setBooted] = useState(init.booted);
  const [chapter, setChapter] = useState<1 | 2 | "birthday">(init.chapter);
  const [hasKey, setHasKey] = useState<boolean>(init.hasKey);
  const [c2Key, setC2Key] = useState(0);
  const [bdKey, setBdKey] = useState(0);
  const [birthdayStage, setBirthdayStage] = useState<"celebrate" | "ending">(init.birthdayStage ?? "celebrate");
  const [c2Config, setC2Config] = useState<Extract<DevTarget, { chapter: 2 }> | undefined>(init.c2Init);
  const [showDev, setShowDev] = useState(false);

  // Chỉ gắn bảng dev sau khi trang đã vẽ xong (tránh tranh CPU lúc khởi động).
  useEffect(() => {
    const t = window.setTimeout(() => setShowDev(true), 1800);
    return () => window.clearTimeout(t);
  }, []);

  // Nạp trước chunk chương II khi trình duyệt rảnh => chuyển cảnh không bị khựng.
  useEffect(() => {
    if (chapter === 1) {
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
        .requestIdleCallback;
      const t = idle
        ? idle(() => void import("./components/chapter2/Chapter2"), { timeout: 4000 })
        : window.setTimeout(() => void import("./components/chapter2/Chapter2"), 2500);
      return () => {
        if (typeof t === "number") window.clearTimeout(t);
      };
    }
  }, [chapter]);

  const finish = useCallback(() => setBooted(true), []);

  const handleCollectKey = useCallback(() => {
    setHasKey(true);
    saveKey(true);
    setC2Config(undefined);
    setChapter(1);
  }, []);

  const handleDevJump = useCallback((target: DevTarget) => {
    if (target.chapter === 1) {
      setBooted(!target.boot);
      if (target.hasKey !== undefined) {
        setHasKey(target.hasKey);
        saveKey(target.hasKey);
      }
      setChapter(1);
      setC2Config(undefined);
    } else if (target.chapter === "birthday") {
      setBooted(true);
      setHasKey(true);
      saveKey(true);
      setBirthdayStage(target.stage ?? "celebrate");
      setChapter("birthday");
      setBdKey((k) => k + 1);
    } else {
      setBooted(true);
      setChapter(2);
      setC2Config(target);
      setC2Key((k) => k + 1);
    }
  }, []);

  return (
    <div className="relative h-full w-full bg-[#02030a]">
      {booted && chapter === 1 && (
        <Hero
          key="c1"
          hasKey={hasKey}
          onNext={() => {
            setC2Config(undefined);
            setChapter(2);
          }}
          onOpenGate={() => {
            setBirthdayStage("celebrate");
            setChapter("birthday");
            setBdKey((k) => k + 1);
          }}
        />
      )}
      <Suspense fallback={<LoadingVeil />}>
        {booted && chapter === 2 && (
          <Chapter2
            key={`c2-${c2Key}`}
            initialPhase={c2Config?.phase}
            initialWave={c2Config?.wave}
            initialBossHp={c2Config?.bossHp}
            onCollectKey={handleCollectKey}
            onExit={() => setChapter(1)}
          />
        )}
        {booted && chapter === "birthday" && (
          <BirthdayWorld key={`bd-${bdKey}`} initialStage={birthdayStage} onBackLobby={() => setChapter(1)} />
        )}
      </Suspense>
      <AnimatePresence>{!booted && <BootSequence key="boot" onFinish={finish} />}</AnimatePresence>
      {showDev && (
        <Suspense fallback={null}>
          <DevJump onJump={handleDevJump} />
        </Suspense>
      )}
    </div>
  );
}
