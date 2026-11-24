import { motion } from "framer-motion";
import tableCardImg from "../../assets/table-card.webp";
import tableKnifeImg from "../../assets/table-knife.webp";

/** Nhãn dạng viên thuốc, có ánh sáng quét khi hover */
function GiftLabel({
  children,
  active = false,
  disabled = false,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <span
      className={`relative mb-1.5 overflow-hidden rounded-full border px-3 py-0.5 text-[10px] font-bold tracking-wider shadow-[0_4px_16px_rgba(0,0,0,0.45)] transition sm:px-3.5 sm:py-1 sm:text-xs ${
        active
          ? "border-amber-300 bg-amber-400/35 text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.7)]"
          : disabled
          ? "border-white/20 bg-black/45 text-amber-100/60"
          : "border-amber-200/55 bg-black/55 text-amber-100 group-hover:border-amber-200 group-hover:bg-amber-950/80"
      }`}
      style={{ backdropFilter: "blur(10px)" }}
    >
      <span className="relative z-10">{children}</span>
      {/* vệt sáng quét qua nhãn */}
      {!disabled && (
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber-100/45 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      )}
    </span>
  );
}

/** Bàn 1: Bàn Thiệp Chúc Mừng (phong bì sáp đỏ, bút máy & bình hoa trên bàn gỗ) */
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
      {/* Đổ bóng thật hòa vào thảm cỏ */}
      <div className="pointer-events-none absolute -bottom-2 left-1/2 h-6 w-4/5 -translate-x-1/2 rounded-full bg-black/55 blur-lg" />

      <GiftLabel active={!letterRead}>{letterRead ? "Bàn Thiệp · Đọc Lại" : "✦ Bàn Thiệp · Mở Thư"}</GiftLabel>

      {/* Ảnh bàn trà gỗ */}
      <div className="relative">
        <img
          src={tableCardImg}
          alt="Bàn thiệp chúc mừng"
          draggable={false}
          className="h-28 w-auto select-none object-contain drop-shadow-[0_14px_26px_rgba(0,0,0,0.58)] transition duration-500 group-hover:scale-[1.04] group-hover:brightness-[1.07] sm:h-40 lg:h-44"
        />

        {/* Ánh sáng dịu nhấp nháy trên phong bì thư khi chưa đọc */}
        {!letterRead && (
          <>
            <motion.span
              animate={{ opacity: [0.28, 0.85, 0.28], scale: [0.9, 1.18, 0.9] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-none absolute left-[41%] top-[43%] h-8 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/45 blur-md"
            />
            {/* Vòng sáng lan toả mời gọi (vẽ bằng transform, không tốn filter) */}
            <motion.span
              animate={{ scale: [0.7, 1.5], opacity: [0.5, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
              className="pointer-events-none absolute left-[41%] top-[43%] h-10 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/70"
            />
            {/* Icon niêm phong sáp nhấp nháy */}
            <motion.span
              animate={{ y: [0, -3, 0], opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-none absolute left-[41%] top-[36%] -translate-x-1/2 text-[10px] text-amber-100 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)] sm:text-xs"
            >
              ✦
            </motion.span>
          </>
        )}

        {/* Ánh sáng vàng hòa quyện ánh hoàng hôn phía mép trái bàn */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full opacity-35 mix-blend-soft-light"
          style={{ background: "radial-gradient(circle at 25% 30%, #ffd584, transparent 60%)" }}
        />
      </div>
    </button>
  );
}

/** Bàn 2: Bàn Dao Bạc (đĩa sứ viền vàng & dao cắt bánh trên bàn gỗ) */
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
        cakeCut ? "opacity-85" : ""
      }`}
    >
      {/* Đổ bóng thật hòa vào thảm cỏ */}
      <div className="pointer-events-none absolute -bottom-2 left-1/2 h-6 w-4/5 -translate-x-1/2 rounded-full bg-black/55 blur-lg" />

      <GiftLabel active={knifeHeld} disabled={cakeCut}>
        {cakeCut ? "Bàn Dao · Đã Cắt" : knifeHeld ? "✦ Đang Cầm Dao!" : "✦ Bàn Dao · Cầm Dao"}
      </GiftLabel>

      {/* Ảnh bàn dao gỗ */}
      <div className="relative">
        <img
          src={tableKnifeImg}
          alt="Bàn dao cắt bánh"
          draggable={false}
          className={`h-26 w-auto select-none object-contain drop-shadow-[0_14px_26px_rgba(0,0,0,0.58)] transition duration-500 group-hover:scale-[1.04] sm:h-36 lg:h-40 ${
            knifeHeld ? "brightness-110 saturate-110" : "group-hover:brightness-[1.06]"
          }`}
        />

        {/* Tia sáng lấp lánh trên lưỡi dao bạc */}
        {!cakeCut && (
          <>
            <motion.span
              animate={{ opacity: [0.15, 0.95, 0.15], scale: [0.7, 1.3, 0.7] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-none absolute left-[46%] top-[28%] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-100/80 blur-[3px]"
            />
            {/* ánh kim chạy dọc lưỡi dao */}
            <motion.span
              animate={{ x: ["-30%", "130%"], opacity: [0, 0.85, 0] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.1 }}
              className="pointer-events-none absolute left-0 top-[30%] h-[3px] w-8 rounded-full bg-gradient-to-r from-transparent via-white to-transparent"
            />
          </>
        )}

        {/* Vầng hào quang phép thuật khi đã cầm dao lên */}
        {knifeHeld && !cakeCut && (
          <>
            <motion.span
              animate={{ opacity: [0.35, 0.8, 0.35], scale: [1, 1.08, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="pointer-events-none absolute left-1/2 top-[30%] h-14 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/35 blur-md"
            />
            {/* tia lửa nhỏ bay lên */}
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ y: [0, -22], opacity: [0.9, 0], scale: [1, 0.4] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.45, ease: "easeOut" }}
                className="pointer-events-none absolute h-1 w-1 rounded-full bg-amber-100 shadow-[0_0_8px_2px_rgba(253,224,71,0.9)]"
                style={{ left: `${38 + i * 12}%`, top: "26%" }}
              />
            ))}
          </>
        )}
      </div>
    </button>
  );
}
