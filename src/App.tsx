import { useCallback, useState } from "react";
import { AnimatePresence } from "framer-motion";
import BootSequence from "./components/BootSequence";
import Hero from "./components/Hero";
import Chapter2 from "./components/chapter2/Chapter2";
import DevJump, { type DevTarget } from "./components/DevJump";

function getInitialFromUrl(): {
  booted: boolean;
  chapter: 1 | 2;
  c2Init?: Extract<DevTarget, { chapter: 2 }>;
} {
  const s = new URLSearchParams(location.search).get("stage");
  if (s === "hero") return { booted: true, chapter: 1 };
  if (s === "quest") return { booted: true, chapter: 2, c2Init: { chapter: 2, phase: "quest" } };
  if (s === "pray") return { booted: true, chapter: 2, c2Init: { chapter: 2, phase: "pray" } };
  if (s === "dodge") return { booted: true, chapter: 2, c2Init: { chapter: 2, phase: "dodge", wave: 0 } };
  if (s === "boss") return { booted: true, chapter: 2, c2Init: { chapter: 2, phase: "boss", bossHp: 360 } };
  if (s === "boss2") return { booted: true, chapter: 2, c2Init: { chapter: 2, phase: "boss", bossHp: 240 } };
  if (s === "boss3") return { booted: true, chapter: 2, c2Init: { chapter: 2, phase: "boss", bossHp: 120 } };
  if (s === "clear") return { booted: true, chapter: 2, c2Init: { chapter: 2, phase: "clear" } };
  return { booted: false, chapter: 1 };
}

export default function App() {
  const [init] = useState(getInitialFromUrl);
  const [booted, setBooted] = useState(init.booted);
  const [chapter, setChapter] = useState<1 | 2>(init.chapter);
  const [c2Key, setC2Key] = useState(0);
  const [c2Config, setC2Config] = useState<Extract<DevTarget, { chapter: 2 }> | undefined>(init.c2Init);

  const finish = useCallback(() => setBooted(true), []);

  const handleDevJump = useCallback((target: DevTarget) => {
    if (target.chapter === 1) {
      setBooted(!target.boot);
      setChapter(1);
      setC2Config(undefined);
    } else {
      setBooted(true);
      setChapter(2);
      setC2Config(target);
      setC2Key((k) => k + 1);
    }
  }, []);

  return (
    <div className="relative h-full w-full bg-[#02030a]">
      {booted && chapter === 1 && <Hero key="c1" onNext={() => { setC2Config(undefined); setChapter(2); }} />}
      {booted && chapter === 2 && (
        <Chapter2
          key={`c2-${c2Key}`}
          initialPhase={c2Config?.phase}
          initialWave={c2Config?.wave}
          initialBossHp={c2Config?.bossHp}
          onExit={() => setChapter(1)}
        />
      )}
      <AnimatePresence>{!booted && <BootSequence key="boot" onFinish={finish} />}</AnimatePresence>
      <DevJump onJump={handleDevJump} />
    </div>
  );
}
