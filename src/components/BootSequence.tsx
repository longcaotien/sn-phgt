import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import RainCanvas from "./RainCanvas";

const LINES = [
  "> Đang kết nối với HỆ THỐNG...",
  "> Phát hiện Người chơi: PHẠM HOÀNG GIA TRÍ",
  "> Ngày kích hoạt: 30 / 11",
  "> Nhiệm vụ đặc biệt được mở khóa: SINH NHẬT",
  "> Cảnh báo: một thực thể cấp SSS đang thức giấc ở tầng sâu nhất…",
];

// Trước đây: 1 ký tự mỗi 24ms => riêng phần gõ chữ đã ~5.5s + 3.6s chờ = ~9s.
// Nay: 1 ký tự mỗi 11ms và màn thông báo tự chuyển sau 2.2s => vào game nhanh gấp đôi.
const CHAR_DELAY = 11;
const LINE_GAP = 180;
const WINDOW_HOLD = 2200;

function Typed({ text, onDone }: { text: string; onDone: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) {
      const t = setTimeout(onDone, LINE_GAP);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN(n + 1), CHAR_DELAY);
    return () => clearTimeout(t);
  }, [n, text, onDone]);
  return <span>{text.slice(0, n)}</span>;
}

export default function BootSequence({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0); // 0..LINES.length -> typing, then window
  const [showWindow, setShowWindow] = useState(false);

  useEffect(() => {
    if (step >= LINES.length) {
      const a = setTimeout(() => setShowWindow(true), 160);
      const b = setTimeout(onFinish, WINDOW_HOLD);
      return () => {
        clearTimeout(a);
        clearTimeout(b);
      };
    }
  }, [step, onFinish]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02030a]"
      exit={{ opacity: 0, scale: 1.06, filter: "blur(8px)" }}
      transition={{ duration: 0.7, ease: "easeInOut" }}
    >
      <RainCanvas intensity={0.5} />
      <div className="scanline pointer-events-none absolute left-0 right-0 h-24 bg-gradient-to-b from-transparent via-sky-400/10 to-transparent" />

      <div className="relative w-full max-w-xl px-6">
        {!showWindow && (
          <div className="font-sys text-[11px] leading-7 tracking-wider text-sky-300 sm:text-sm">
            {LINES.slice(0, step + 1).map((l, i) =>
              i < step ? (
                <div key={i} className="opacity-70">{l}</div>
              ) : (
                <div key={i} className="cursor">
                  <Typed text={l} onDone={() => setStep((s) => s + 1)} />
                </div>
              )
            )}
          </div>
        )}

        <AnimatePresence>
          {showWindow && (
            <motion.div
              initial={{ opacity: 0, scaleY: 0.05, scaleX: 0.6 }}
              animate={{ opacity: 1, scaleY: 1, scaleX: 1 }}
              transition={{ duration: 0.5, ease: [0.2, 0.9, 0.25, 1] }}
              className="sys-panel sys-cut relative mx-auto overflow-hidden p-1"
            >
              <div className="frame-sweep absolute inset-x-0 top-0 h-px" />
              <div className="border border-sky-400/30 p-6 text-center sm:p-8">
                <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-sky-300 font-sys text-lg text-sky-200 text-glow">
                  !
                </div>
                <div className="font-sys text-xs tracking-[0.4em] text-sky-300 text-glow">THÔNG BÁO</div>
                <div className="my-4 h-px border-run" />
                <p className="text-base font-semibold text-white sm:text-lg">
                  Bạn đã được chọn làm <span className="text-sky-300 text-glow">Người Chơi</span>.
                </p>
                <p className="mt-2 text-sm text-sky-100/70">Hôm nay là ngày thức tỉnh của Phạm Hoàng Gia Trí.</p>
                <div className="mt-4 flex items-center justify-center gap-2 border border-red-500/35 bg-red-950/30 px-2 py-1.5 font-sys text-[8px] tracking-[0.26em] text-red-300/90">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                  PHÁT HIỆN BOSS ẨN · CHƯƠNG II
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={onFinish}
        className="absolute bottom-6 right-6 font-sys text-[10px] tracking-[0.3em] text-sky-300/60 transition hover:text-sky-200"
      >
        BỎ QUA ▸
      </button>
    </motion.div>
  );
}
