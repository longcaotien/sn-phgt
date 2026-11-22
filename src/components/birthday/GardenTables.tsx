import { motion } from "framer-motion";
import tableCardImg from "../../assets/table-card.webp";
import tableKnifeImg from "../../assets/table-knife.webp";

/** Bàn 1: Bàn Thiệp Chúc Mừng 4K (phong bì sáp đỏ, bút máy & bình hoa đặt trực tiếp trên bàn gỗ) */
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

      {/* Nhãn thanh lịch kiểu visual novel */}
      <span className="mb-1.5 rounded-full border border-amber-200/55 bg-black/55 px-3 py-0.5 text-[10px] font-bold tracking-wider text-amber-100 shadow-[0_4px_16px_rgba(0,0,0,0.45)] backdrop-blur-md transition group-hover:border-amber-200 group-hover:bg-amber-950/80 sm:px-3.5 sm:py-1 sm:text-xs">
        {letterRead ? "Bàn Thiệp · Đọc Lại" : "✦ Bàn Thiệp · Mở Thư"}
      </span>

      {/* Ảnh bàn trà gỗ 4K */}
      <div className="relative">
        <img
          src={tableCardImg}
          alt="Bàn thiệp chúc mừng"
          draggable={false}
          className="h-28 w-auto select-none object-contain drop-shadow-[0_14px_26px_rgba(0,0,0,0.58)] transition duration-300 group-hover:scale-[1.03] group-hover:brightness-105 sm:h-40 lg:h-44"
        />

        {/* Ánh sáng dịu nhấp nháy trên phong bì thư khi chưa đọc */}
        {!letterRead && (
          <motion.span
            animate={{ opacity: [0.3, 0.85, 0.3], scale: [0.9, 1.15, 0.9] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute left-[41%] top-[43%] h-8 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/45 blur-md"
          />
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

/** Bàn 2: Bàn Dao Bạc 4K (đĩa sứ viền vàng & dao cắt bánh đặt trực tiếp trên bàn gỗ) */
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

      {/* Nhãn thanh lịch kiểu visual novel */}
      <span
        className={`mb-1.5 rounded-full border px-3 py-0.5 text-[10px] font-bold tracking-wider shadow-[0_4px_16px_rgba(0,0,0,0.45)] backdrop-blur-md transition sm:px-3.5 sm:py-1 sm:text-xs ${
          knifeHeld
            ? "border-amber-300 bg-amber-400/35 text-amber-100 shadow-[0_0_22px_rgba(251,191,36,0.65)]"
            : "border-amber-200/55 bg-black/55 text-amber-100 group-hover:border-amber-200 group-hover:bg-amber-950/80"
        }`}
      >
        {cakeCut
          ? "Bàn Dao · Đã Cắt"
          : knifeHeld
          ? "✦ Đang Cầm Dao!"
          : "✦ Bàn Dao · Cầm Dao"}
      </span>

      {/* Ảnh bàn dao gỗ 4K */}
      <div className="relative">
        <img
          src={tableKnifeImg}
          alt="Bàn dao cắt bánh"
          draggable={false}
          className={`h-26 w-auto select-none object-contain drop-shadow-[0_14px_26px_rgba(0,0,0,0.58)] transition duration-300 group-hover:scale-[1.03] sm:h-36 lg:h-40 ${
            knifeHeld ? "brightness-110 saturate-110" : "group-hover:brightness-105"
          }`}
        />

        {/* Tia sáng lấp lánh trên lưỡi dao bạc */}
        {!cakeCut && (
          <motion.span
            animate={{ opacity: [0.15, 0.95, 0.15], scale: [0.7, 1.25, 0.7] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute left-[46%] top-[28%] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-100/80 blur-[3px]"
          />
        )}

        {/* Vầng hào quang phép thuật khi đã cầm dao lên */}
        {knifeHeld && !cakeCut && (
          <motion.span
            animate={{ opacity: [0.35, 0.75, 0.35] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="pointer-events-none absolute left-1/2 top-[30%] h-14 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/35 blur-md"
          />
        )}
      </div>
    </button>
  );
}
