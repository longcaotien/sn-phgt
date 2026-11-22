import { motion } from "framer-motion";

/** Bàn 1: Bàn Thiệp Chúc Mừng đặt phong bì thư 30/11 & bình hoa nhỏ */
export function CardTable({
  letterRead,
  onClick,
}: {
  letterRead: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Bàn thiệp chúc mừng"
      className="group relative flex flex-col items-center focus:outline-none"
    >
      {/* Đổ bóng trên thảm cỏ */}
      <div className="pointer-events-none absolute -bottom-1.5 h-5 w-32 rounded-full bg-black/50 blur-md sm:w-40" />

      {/* Nhãn chú thích đặt phía trên bàn để không bị cỏ che */}
      <span className="mb-2 rounded-full border border-amber-200/50 bg-black/60 px-3 py-1 text-[10px] font-bold tracking-wide text-amber-100 shadow-lg backdrop-blur-md transition group-hover:border-amber-200 group-hover:bg-amber-950/80 sm:text-xs">
        {letterRead ? "Bàn Thiệp · Đọc Lại" : "✦ Bàn Thiệp · Mở Thư"}
      </span>

      {/* Vật phẩm trên mặt bàn */}
      <div className="relative z-10 -mb-3 flex items-end gap-1.5">
        {/* Bình hoa dại thủy tinh nhỏ */}
        <svg viewBox="0 0 44 60" className="h-10 w-8 drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)] sm:h-12 sm:w-9">
          <path d="M16 28 C12 36 11 50 15 56 L29 56 C33 50 32 36 28 28 Z" fill="rgba(220,245,255,0.42)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.3" />
          <path d="M18 30 L22 10 M22 29 L23 7 M25 30 L28 13" stroke="#4d7c32" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="22" cy="10" r="4.5" fill="#fffbeb" />
          <circle cx="22" cy="10" r="2" fill="#f59e0b" />
          <circle cx="15" cy="16" r="3.8" fill="#fbcfe8" />
          <circle cx="29" cy="14" r="3.5" fill="#fde68a" />
        </svg>

        {/* Phong bì thư chúc mừng lung linh */}
        <motion.div
          animate={!letterRead ? { y: [0, -4, 0], rotate: [-3, 1, -3] } : { rotate: -2 }}
          transition={!letterRead ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : undefined}
          className={`relative h-12 w-18 overflow-hidden rounded-lg border border-amber-200/80 bg-gradient-to-br from-[#fff9eb] to-[#f1d8a8] shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition group-hover:scale-110 sm:h-14 sm:w-22 ${
            !letterRead ? "ring-2 ring-amber-300/70 shadow-[0_0_24px_rgba(253,224,71,0.65)]" : ""
          }`}
        >
          <div
            className="absolute inset-x-0 top-0 h-7 bg-gradient-to-b from-[#ebd09a] to-[#faeccf]"
            style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
          />
          <div className="absolute left-1/2 top-5 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-rose-700 text-[8px] font-bold text-amber-100 shadow">
            ♥
          </div>
          <div className="absolute bottom-1 right-1.5 text-[7px] font-extrabold tracking-widest text-amber-900/70">
            30/11
          </div>
        </motion.div>
      </div>

      {/* Chiếc bàn gỗ sân vườn với khăn ren */}
      <svg viewBox="0 0 180 110" className="h-20 w-32 drop-shadow-[0_12px_18px_rgba(0,0,0,0.45)] sm:h-24 sm:w-40">
        <defs>
          <linearGradient id="woodTop1" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#9c6234" />
            <stop offset="50%" stopColor="#7a4822" />
            <stop offset="100%" stopColor="#4f2d14" />
          </linearGradient>
          <linearGradient id="woodLeg1" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#5d3618" />
            <stop offset="100%" stopColor="#2e1809" />
          </linearGradient>
        </defs>
        {/* 4 chân bàn gỗ thanh mảnh */}
        <path d="M40 34 L30 104 L39 104 L49 34 Z" fill="url(#woodLeg1)" />
        <path d="M140 34 L150 104 L141 104 L131 34 Z" fill="url(#woodLeg1)" />
        <path d="M62 38 L58 96 L65 96 L69 38 Z" fill="#46260f" />
        <path d="M118 38 L122 96 L115 96 L111 38 Z" fill="#46260f" />
        {/* Thanh giằng ngang */}
        <rect x="40" y="72" width="100" height="5" rx="2.5" fill="#4f2d14" />
        {/* Mặt bàn tròn bầu dục */}
        <ellipse cx="90" cy="28" rx="82" ry="18" fill="#3e220e" />
        <ellipse cx="90" cy="24" rx="82" ry="17" fill="url(#woodTop1)" stroke="#c78c52" strokeWidth="1.4" />
        {/* Khăn ren trắng nhỏ trải giữa bàn */}
        <path
          d="M42 22 Q90 12 138 22 Q132 39 112 43 Q90 36 68 43 Q48 39 42 22 Z"
          fill="#fffaf0"
          fillOpacity="0.9"
          stroke="#e7d4b5"
          strokeWidth="1"
        />
      </svg>
    </button>
  );
}

/** Bàn 2: Bàn Dao Bạc đặt đĩa sứ & con dao cắt bánh */
export function KnifeTable({
  knifeHeld,
  cakeCut,
  onClick,
}: {
  knifeHeld: boolean;
  cakeCut: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cakeCut}
      aria-label="Bàn dao cắt bánh"
      className={`group relative flex flex-col items-center focus:outline-none ${
        cakeCut ? "opacity-80" : ""
      }`}
    >
      {/* Đổ bóng */}
      <div className="pointer-events-none absolute -bottom-1.5 h-5 w-32 rounded-full bg-black/50 blur-md sm:w-40" />

      {/* Nhãn chú thích đặt phía trên bàn để không bị cỏ che */}
      <span
        className={`mb-1.5 rounded-full border px-3 py-1 text-[10px] font-bold tracking-wide shadow-lg backdrop-blur-md transition sm:text-xs ${
          knifeHeld
            ? "border-amber-300 bg-amber-400/35 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.5)]"
            : "border-amber-200/50 bg-black/60 text-amber-100 group-hover:border-amber-200 group-hover:bg-amber-950/80"
        }`}
      >
        {cakeCut
          ? "Bàn Dao · Đã Cắt"
          : knifeHeld
          ? "Đang Cầm Dao!"
          : "✦ Bàn Dao · Cầm Dao"}
      </span>

      {/* Đĩa sứ + Con dao bạc nằm trên mặt bàn */}
      <div className="relative z-10 -mb-4 flex flex-col items-center">
        <motion.div
          animate={
            !knifeHeld && !cakeCut
              ? { y: [0, -3, 0] }
              : undefined
          }
          transition={!knifeHeld && !cakeCut ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : undefined}
          className={`relative flex items-center justify-center transition group-hover:scale-105 ${
            knifeHeld ? "scale-95 opacity-70" : ""
          }`}
        >
          {/* Đĩa sứ trắng viền vàng */}
          <svg viewBox="0 0 130 46" className="h-10 w-24 drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)] sm:h-12 sm:w-28">
            <ellipse cx="65" cy="26" rx="56" ry="15" fill="#e2e8f0" stroke="#f59e0b" strokeWidth="1.2" />
            <ellipse cx="65" cy="24" rx="46" ry="11" fill="#ffffff" />

            {/* Con dao bạc (ẩn đi khi đã cầm dao lên tay) */}
            {!knifeHeld && !cakeCut && (
              <g transform="translate(18, 12) rotate(-7)">
                {/* Cán dao gỗ mun viền đồng */}
                <rect x="0" y="7" width="32" height="8" rx="4" fill="#451a03" stroke="#f59e0b" strokeWidth="0.9" />
                <circle cx="8" cy="11" r="1.3" fill="#fde68a" />
                <circle cx="20" cy="11" r="1.3" fill="#fde68a" />
                {/* Cổ dao vàng */}
                <rect x="30" y="6.5" width="5" height="9" rx="1" fill="#fbbf24" />
                {/* Lưỡi dao bạc sáng bóng */}
                <path
                  d="M35 6.5 L92 9 C97 10 95 14 86 15.5 L35 15.5 Z"
                  fill="url(#silverBlade)"
                  stroke="#94a3b8"
                  strokeWidth="0.8"
                />
                <path d="M38 8.5 L88 10.5" stroke="#ffffff" strokeWidth="1.1" strokeOpacity="0.85" />
                {/* Tia sáng lấp lánh trên lưỡi dao */}
                <path d="M72 4 L74 9 L79 11 L74 13 L72 18 L70 13 L65 11 L70 9 Z" fill="#fef08a" />
              </g>
            )}
            <defs>
              <linearGradient id="silverBlade" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="50%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
      </div>

      {/* Chiếc bàn gỗ chạm khắc */}
      <svg viewBox="0 0 180 110" className="h-20 w-32 drop-shadow-[0_12px_18px_rgba(0,0,0,0.45)] sm:h-24 sm:w-40">
        <defs>
          <linearGradient id="woodTop2" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#a46939" />
            <stop offset="50%" stopColor="#7b4822" />
            <stop offset="100%" stopColor="#4f2d14" />
          </linearGradient>
        </defs>
        <path d="M40 34 L30 104 L39 104 L49 34 Z" fill="#3e220e" />
        <path d="M140 34 L150 104 L141 104 L131 34 Z" fill="#3e220e" />
        <path d="M62 38 L58 96 L65 96 L69 38 Z" fill="#2c1708" />
        <path d="M118 38 L122 96 L115 96 L111 38 Z" fill="#2c1708" />
        <rect x="40" y="72" width="100" height="5" rx="2.5" fill="#4f2d14" />
        <ellipse cx="90" cy="28" rx="82" ry="18" fill="#3e220e" />
        <ellipse cx="90" cy="24" rx="82" ry="17" fill="url(#woodTop2)" stroke="#c78c52" strokeWidth="1.4" />
        <path
          d="M46 22 Q90 13 134 22 Q128 38 110 41 Q90 35 70 41 Q52 38 46 22 Z"
          fill="#fef3c7"
          fillOpacity="0.88"
          stroke="#e5c896"
          strokeWidth="1"
        />
      </svg>
    </button>
  );
}
