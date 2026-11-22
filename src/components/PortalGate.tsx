import { motion } from "framer-motion";

export function GoldenKeyIcon({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="keyGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff7cc" />
          <stop offset="45%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="24" r="10" stroke="url(#keyGrad)" strokeWidth="4" fill="rgba(253,224,71,0.12)" />
      <circle cx="20" cy="24" r="4" fill="#fef08a" />
      <path
        d="M28.5 29.5L53 50M44 42.5L49 37.5M49 46.5L54 41.5"
        stroke="url(#keyGrad)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Cánh cổng vòm bí ẩn ở sảnh màn 1 */
export default function PortalGateCard({
  hasKey,
  onClick,
  lockedShake,
}: {
  hasKey: boolean;
  onClick: () => void;
  lockedShake: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      key={lockedShake}
      animate={lockedShake ? { x: [0, -7, 7, -5, 5, 0] } : undefined}
      transition={{ duration: 0.36 }}
      className={`group relative flex items-center gap-3 overflow-hidden border px-3.5 py-2.5 text-left transition active:scale-95 ${
        hasKey
          ? "border-amber-300/80 bg-gradient-to-r from-amber-950/70 via-emerald-950/60 to-amber-950/70 shadow-[0_0_28px_rgba(251,191,36,0.4)] hover:border-amber-200 hover:shadow-[0_0_38px_rgba(251,191,36,0.65)]"
          : "border-sky-400/35 bg-[#060d1f]/80 hover:border-sky-300/60"
      }`}
    >
      {/* Biểu tượng Cánh Cổng Đóng */}
      <div className="relative flex h-12 w-10 shrink-0 items-center justify-center rounded-t-full border-2 border-b-0 border-amber-200/45 bg-gradient-to-b from-slate-900 to-[#040812] shadow-inner">
        {/* Hai cánh cổng đóng kín */}
        <div className="absolute inset-1 rounded-t-full border border-sky-400/25 bg-[linear-gradient(90deg,rgba(30,41,59,0.9)_48%,rgba(15,23,42,0.95)_52%)]" />
        {/* Khe sáng giữa cổng khi có chìa khóa */}
        {hasKey && (
          <div className="absolute inset-y-1.5 left-1/2 w-[2px] -translate-x-1/2 animate-pulse bg-amber-300 shadow-[0_0_10px_#fcd34d]" />
        )}
        {/* Ổ khóa / Chìa khóa */}
        <div className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-amber-300/60 bg-black/75">
          {hasKey ? (
            <GoldenKeyIcon className="h-3.5 w-3.5 animate-pulse" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-3 w-3 text-sky-300" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-sys text-[8px] tracking-[0.22em]">
          <span className={hasKey ? "text-amber-300" : "text-sky-300/75"}>
            {hasKey ? "✦ ĐÃ CÓ CHÌA KHÓA" : "CÁNH CỔNG ĐANG ĐÓNG"}
          </span>
        </div>
        <div className="mt-0.5 font-sys text-xs font-bold tracking-[0.08em] text-white sm:text-sm">
          {hasKey ? "MỞ CỔNG · THẾ GIỚI 30/11" : "CỔNG THẾ GIỚI SINH NHẬT"}
        </div>
        <div className="mt-0.5 truncate text-[10px] text-sky-100/65">
          {hasKey
            ? "Nhấn để tra chìa khóa & bước qua cánh cổng"
            : "Hạ Boss Chương II để nhận Chìa Khóa"}
        </div>
      </div>
    </motion.button>
  );
}
