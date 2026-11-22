import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { resetBossML } from "./chapter2/bossAI";

export type DevTarget =
  | { chapter: 1; boot?: boolean }
  | { chapter: 2; phase: "title" | "quest" | "pray" | "dodge" | "boss" | "clear"; wave?: number; bossHp?: number };

const ITEMS: { label: string; tag: string; target: DevTarget; danger?: boolean }[] = [
  { label: "Boot Hệ Thống", tag: "CH.1", target: { chapter: 1, boot: true } },
  { label: "Màn Chính · Hero", tag: "CH.1", target: { chapter: 1, boot: false } },
  { label: "Bảng Nhiệm Vụ", tag: "CH.2", target: { chapter: 2, phase: "quest" } },
  { label: "Cầu Nguyện", tag: "CH.2", target: { chapter: 2, phase: "pray" } },
  { label: "Né Tượng · Đợt 1", tag: "CH.2", target: { chapter: 2, phase: "dodge", wave: 0 } },
  { label: "Né Tượng · Đợt 8 (AI)", tag: "CH.2", target: { chapter: 2, phase: "dodge", wave: 7 } },
  { label: "Boss Cuối · Pha 1 (360 HP)", tag: "BOSS", target: { chapter: 2, phase: "boss", bossHp: 360 }, danger: true },
  { label: "Boss Cuối · Pha 2 Cuồng Nộ", tag: "BOSS", target: { chapter: 2, phase: "boss", bossHp: 240 }, danger: true },
  { label: "Boss Cuối · Pha 3 Tử Thần", tag: "BOSS", target: { chapter: 2, phase: "boss", bossHp: 120 }, danger: true },
  { label: "Màn Chiến Thắng / Thưởng", tag: "WIN", target: { chapter: 2, phase: "clear" } },
];

export default function DevJump({ onJump }: { onJump: (t: DevTarget) => void }) {
  const [open, setOpen] = useState(false);
  const [resetNote, setResetNote] = useState(false);

  const handleReset = () => {
    resetBossML();
    setResetNote(true);
    setTimeout(() => setResetNote(false), 1600);
  };

  return (
    <div className="fixed bottom-2.5 left-2.5 z-[90] select-none">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            transition={{ duration: 0.18 }}
            className="sys-panel sys-cut mb-2 w-64 p-1 sm:w-72"
          >
            <div className="border border-sky-400/25 p-2.5">
              <div className="mb-2 flex items-center justify-between font-sys text-[9px] tracking-[0.25em] text-sky-300">
                <span>DEV · NHẢY MÀN NHANH</span>
                <button
                  onClick={() => setOpen(false)}
                  className="px-1.5 py-0.5 text-sky-300/70 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-0.5">
                {ITEMS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      onJump(item.target);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between border px-2.5 py-1.5 text-left text-[11px] transition active:scale-[0.98] ${
                      item.danger
                        ? "border-red-500/35 bg-red-950/35 text-red-100 hover:border-red-400 hover:bg-red-900/45"
                        : "border-sky-500/25 bg-sky-950/40 text-sky-100 hover:border-sky-400 hover:bg-sky-900/50"
                    }`}
                  >
                    <span className="truncate font-medium">{item.label}</span>
                    <span
                      className={`ml-2 shrink-0 font-sys text-[8px] tracking-[0.18em] ${
                        item.danger ? "text-red-300" : "text-sky-300/80"
                      }`}
                    >
                      {item.tag}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={handleReset}
                className="mt-2 w-full border border-violet-400/40 bg-violet-950/40 py-1.5 font-sys text-[8px] tracking-[0.22em] text-violet-200 transition hover:bg-violet-800/40"
              >
                {resetNote ? "✔ ĐÃ XÓA BỘ NHỚ HỌC MÁY" : "RESET DỮ LIỆU HỌC AI (ML)"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 border border-sky-400/45 bg-[#040a18]/80 px-2.5 py-1.5 font-sys text-[8px] tracking-[0.22em] text-sky-200/85 opacity-75 backdrop-blur-md transition hover:border-sky-300 hover:opacity-100 hover:shadow-[0_0_16px_rgba(79,168,255,0.45)] sm:text-[9px]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span>DEV · NHẢY MÀN</span>
      </button>
    </div>
  );
}
