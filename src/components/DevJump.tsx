import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { resetBossML } from "./chapter2/bossAI";
import {
  GEMINI_MODELS,
  getGeminiDiag,
  getGeminiModelChoice,
  hasGeminiApiKey,
  setGeminiModelChoice,
  testGeminiConnection,
  type GeminiModelChoice,
} from "./chapter2/geminiAI";

export type DevTarget =
  | { chapter: 1; boot?: boolean; hasKey?: boolean }
  | { chapter: 2; phase: "title" | "quest" | "pray" | "dodge" | "boss" | "clear"; wave?: number; bossHp?: number }
  | { chapter: "birthday"; stage?: "celebrate" | "ending" };

const ITEMS: { label: string; tag: string; target: DevTarget; danger?: boolean; warm?: boolean }[] = [
  { label: "Boot Hệ Thống", tag: "CH.1", target: { chapter: 1, boot: true } },
  { label: "Màn Chính · Hero", tag: "CH.1", target: { chapter: 1, boot: false, hasKey: false } },
  { label: "Sảnh · Có Chìa Khóa (Mở Cổng)", tag: "KEY", target: { chapter: 1, boot: false, hasKey: true }, warm: true },
  { label: "Bảng Nhiệm Vụ", tag: "CH.2", target: { chapter: 2, phase: "quest" } },
  { label: "Cầu Nguyện", tag: "CH.2", target: { chapter: 2, phase: "pray" } },
  { label: "Né Tượng · Đợt 1", tag: "CH.2", target: { chapter: 2, phase: "dodge", wave: 0 } },
  { label: "Né Tượng · Đợt 8 (AI)", tag: "CH.2", target: { chapter: 2, phase: "dodge", wave: 7 } },
  { label: "Boss Cuối · Pha 1 (360 HP)", tag: "BOSS", target: { chapter: 2, phase: "boss", bossHp: 360 }, danger: true },
  { label: "Boss Cuối · Pha 2 Cuồng Nộ", tag: "BOSS", target: { chapter: 2, phase: "boss", bossHp: 240 }, danger: true },
  { label: "Boss Cuối · Pha 3 Tử Thần", tag: "BOSS", target: { chapter: 2, phase: "boss", bossHp: 120 }, danger: true },
  { label: "Rơi Chìa Khóa (Thắng Boss)", tag: "WIN", target: { chapter: 2, phase: "clear" } },
  { label: "Thế Giới Sinh Nhật (30/11)", tag: "30/11", target: { chapter: "birthday", stage: "celebrate" }, warm: true },
  { label: "Kết · Hộp Nhạc & Bong Bóng", tag: "30/11", target: { chapter: "birthday", stage: "ending" }, warm: true },
];

export default function DevJump({ onJump }: { onJump: (t: DevTarget) => void }) {
  const [panel, setPanel] = useState<"none" | "dev" | "gemini">("none");
  const [resetNote, setResetNote] = useState(false);

  const [modelChoice, setModelChoice] = useState<GeminiModelChoice>(() => getGeminiModelChoice());
  const [keyActive, setKeyActive] = useState(() => hasGeminiApiKey());
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [diag, setDiag] = useState(() => getGeminiDiag());

  useEffect(() => {
    const sync = () => {
      setDiag(getGeminiDiag());
      setKeyActive(hasGeminiApiKey());
    };
    window.addEventListener("sl-gemini-diag-changed", sync);
    window.addEventListener("sl-gemini-key-changed", sync);
    return () => {
      window.removeEventListener("sl-gemini-diag-changed", sync);
      window.removeEventListener("sl-gemini-key-changed", sync);
    };
  }, []);

  const handleReset = () => {
    resetBossML();
    setResetNote(true);
    setTimeout(() => setResetNote(false), 1600);
  };

  const handleTest = async () => {
    setGeminiModelChoice(modelChoice);
    setTesting(true);
    setTestMsg(null);
    const res = await testGeminiConnection();
    setTesting(false);
    setTestMsg({ ok: res.ok, text: res.message });
  };

  return (
    <div className="fixed bottom-2.5 left-2.5 z-[90] select-none">
      <AnimatePresence mode="wait">
        {panel === "dev" && (
          <motion.div
            key="dev-panel"
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            transition={{ duration: 0.18 }}
            className="sys-panel sys-cut mb-2 w-64 p-1 sm:w-72"
          >
            <div className="border border-sky-400/25 p-2.5">
              <div className="mb-2 flex items-center justify-between font-sys text-[9px] tracking-[0.25em] text-sky-300">
                <span>DEV · NHẢY MÀN NHANH</span>
                <button onClick={() => setPanel("none")} className="px-1.5 py-0.5 text-sky-300/70 hover:text-white">
                  ✕
                </button>
              </div>
              <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-0.5">
                {ITEMS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      onJump(item.target);
                      setPanel("none");
                    }}
                    className={`flex w-full items-center justify-between border px-2.5 py-1.5 text-left text-[11px] transition active:scale-[0.98] ${
                      item.danger
                        ? "border-red-500/35 bg-red-950/35 text-red-100 hover:border-red-400 hover:bg-red-900/45"
                        : item.warm
                        ? "border-amber-400/40 bg-amber-950/35 text-amber-100 hover:border-amber-300 hover:bg-amber-900/45"
                        : "border-sky-500/25 bg-sky-950/40 text-sky-100 hover:border-sky-400 hover:bg-sky-900/50"
                    }`}
                  >
                    <span className="truncate font-medium">{item.label}</span>
                    <span
                      className={`ml-2 shrink-0 font-sys text-[8px] tracking-[0.18em] ${
                        item.danger ? "text-red-300" : item.warm ? "text-amber-300" : "text-sky-300/80"
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

        {panel === "gemini" && (
          <motion.div
            key="gemini-panel"
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            transition={{ duration: 0.18 }}
            className="sys-panel sys-cut mb-2 w-72 p-1 sm:w-84"
          >
            <div className="border border-cyan-400/30 p-3">
              <div className="mb-2 flex items-center justify-between font-sys text-[9px] tracking-[0.22em] text-cyan-300">
                <span>GEMINI AI · CẤU HÌNH ĐỌC VỊ</span>
                <button onClick={() => setPanel("none")} className="px-1.5 py-0.5 text-cyan-300/70 hover:text-white">
                  ✕
                </button>
              </div>
              <p className="mb-2 text-[11px] leading-relaxed text-sky-100/75">
                Chiến thuật Gemini kết hợp cùng <span className="text-cyan-300">Online ML + Markov</span>.
                API key nằm ở <strong>server</strong> — không ai đọc được từ trình duyệt.
              </p>

              <div
                className={`mb-2 border px-2 py-1.5 text-[10px] leading-snug ${
                  keyActive
                    ? "border-emerald-400/45 bg-emerald-950/35 text-emerald-200"
                    : "border-amber-400/40 bg-amber-950/35 text-amber-200"
                }`}
              >
                {keyActive ? "✔ Server đã có API key." : "⚠ Server chưa có API key — nhờ quản trị viên thêm."}
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-sys text-[8px] tracking-[0.16em] text-cyan-200/70">MODEL</span>
                <select
                  value={modelChoice}
                  onChange={(e) => {
                    const m = e.target.value as GeminiModelChoice;
                    setModelChoice(m);
                    setGeminiModelChoice(m);
                  }}
                  className="min-w-0 flex-1 border border-cyan-500/35 bg-[#020814] px-2 py-1 font-mono text-[10px] text-cyan-100 focus:border-cyan-300 focus:outline-none"
                >
                  <option value="auto">Tự động (2.5 Flash → Lite → 2.0)</option>
                  {GEMINI_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !keyActive}
                  className="flex-1 border border-cyan-400/60 bg-cyan-500/20 py-1.5 font-sys text-[8px] font-bold tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-500/35 disabled:opacity-50"
                >
                  {testing ? "ĐANG KIỂM TRA…" : "KIỂM TRA KẾT NỐI"}
                </button>
              </div>

              {testMsg && (
                <div
                  className={`mt-2 border px-2 py-1.5 text-[10px] leading-snug ${
                    testMsg.ok
                      ? "border-emerald-400/45 bg-emerald-950/40 text-emerald-200"
                      : "border-amber-400/40 bg-amber-950/35 text-amber-200"
                  }`}
                >
                  {testMsg.ok ? "✔ " : "⚠ "}
                  {testMsg.text}
                </div>
              )}

              {/* Chẩn đoán trực tiếp khi đang đánh Boss */}
              <div className="mt-2 border border-sky-500/20 bg-[#020712]/80 px-2 py-1.5 text-[9.5px] text-sky-200/75">
                <div className="flex items-center justify-between font-sys text-[7.5px] tracking-[0.16em] text-cyan-300/80">
                  <span>TRẠNG THÁI TRONG TRẬN</span>
                  <span>
                    {diag.lastModel ? `${diag.lastModel} · ${diag.lastLatencyMs ?? 0}ms` : diag.status.toUpperCase()}
                  </span>
                </div>
                {diag.successCount > 0 && (
                  <div className="mt-0.5 text-emerald-300/90">
                    ✔ Đã phân tích chiến thuật thành công {diag.successCount} lượt.
                  </div>
                )}
                {diag.lastError && (
                  <div className="mt-0.5 break-words text-red-300/90">
                    ✕ Lỗi gần nhất: {diag.lastError}
                  </div>
                )}
              </div>

              <div className="mt-1.5 text-[9px] leading-tight text-sky-200/45">
                Key do quản trị viên đặt trong trang quản trị, lưu ở server.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setPanel((p) => (p === "dev" ? "none" : "dev"))}
          className="flex items-center gap-1.5 border border-sky-400/45 bg-[#040a18]/80 px-2.5 py-1.5 font-sys text-[8px] tracking-[0.22em] text-sky-200/85 opacity-80 backdrop-blur-md transition hover:border-sky-300 hover:opacity-100 hover:shadow-[0_0_16px_rgba(79,168,255,0.45)] sm:text-[9px]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span>DEV · NHẢY MÀN</span>
        </button>

        <button
          onClick={() => setPanel((p) => (p === "gemini" ? "none" : "gemini"))}
          className={`flex items-center gap-1.5 border px-2.5 py-1.5 font-sys text-[8px] tracking-[0.2em] backdrop-blur-md transition hover:opacity-100 sm:text-[9px] ${
            diag.status === "error"
              ? "border-red-400/65 bg-red-950/75 text-red-100 opacity-95"
              : keyActive
              ? "border-cyan-400/65 bg-cyan-950/75 text-cyan-100 opacity-90 shadow-[0_0_14px_rgba(34,211,238,0.3)]"
              : "border-cyan-500/35 bg-[#040a18]/80 text-cyan-200/75 opacity-80 hover:border-cyan-300"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              diag.status === "error"
                ? "bg-red-400"
                : keyActive
                ? "bg-cyan-300 shadow-[0_0_6px_#22d3ee]"
                : "bg-slate-400"
            }`}
          />
          <span>{diag.status === "error" ? "GEMINI LỖI" : "GEMINI KEY"}</span>
        </button>
      </div>
    </div>
  );
}
