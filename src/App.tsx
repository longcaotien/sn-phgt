import { useCallback, useState } from "react";
import { AnimatePresence } from "framer-motion";
import BootSequence from "./components/BootSequence";
import Hero from "./components/Hero";
import Chapter2 from "./components/chapter2/Chapter2";

export default function App() {
  const [booted, setBooted] = useState(false);
  const [chapter, setChapter] = useState<1 | 2>(1);
  const finish = useCallback(() => setBooted(true), []);

  return (
    <div className="relative h-full w-full bg-[#02030a]">
      {booted && chapter === 1 && <Hero key="c1" onNext={() => setChapter(2)} />}
      {booted && chapter === 2 && <Chapter2 key="c2" onExit={() => setChapter(1)} />}
      <AnimatePresence>{!booted && <BootSequence key="boot" onFinish={finish} />}</AnimatePresence>
    </div>
  );
}
