import { motion } from "framer-motion";
import { memo } from "react";
import catBlack from "../../assets/cat-black.webp";
import catWhite from "../../assets/cat-white.webp";
import { lowEnd, reduceMotionEnabled } from "../../utils/perf";

/** true = nên bỏ hẳn các vòng lặp vẫy/lượn (máy yếu hoặc người dùng giảm chuyển động) */
const calm = reduceMotionEnabled;

/** Nhịp lặp: máy yếu cho chậm & đơn giản hơn, máy mạnh giữ nhịp sống động */
const breathe = (base: number) => (lowEnd ? base * 1.35 : base);

/* =========================================================
   LINH VẬT SỐNG ĐỘNG TRONG KHU VƯỜN
   Mèo mun & mèo trắng đi lại, ngồi, vẫy đuôi, ngước nhìn bướm.
   Tất cả đều là chuyển động CSS/transform (rẻ cho GPU).
   ========================================================= */

type CatProps = {
  /** true = mèo mun, false = mèo trắng */
  black?: boolean;
  /** phần trăm vị trí mép trái khung chứa */
  left: string;
  /** phần trăm vị trí mép dưới khung chứa */
  bottom: string;
  /** chiều cao hiển thị */
  height?: string;
  /** lật ảnh sang trái */
  flip?: boolean;
  /** độ trễ pha chuyển động (giây) */
  delay?: number;
  /** đang nhìn lên (ngước nhìn bướm/chim) */
  lookingUp?: boolean;
  className?: string;
};

/** Một chú mèo với nhịp thở, vẫy đuôi, gật đầu và nhún chân. */
export const GardenCat = memo(function GardenCat({
  black = true,
  left,
  bottom,
  height = "clamp(64px, 9vh, 118px)",
  flip = false,
  delay = 0,
  lookingUp = false,
  className = "",
}: CatProps) {
  const dur = breathe(black ? 5.2 : 4.4);
  return (
    <div
      className={`pointer-events-none absolute select-none ${className}`}
      style={{ left, bottom, transform: flip ? "scaleX(-1)" : undefined }}
    >
      {/* bóng đổ mềm trên cỏ */}
      <div
        className="absolute bottom-0 left-1/2 h-2.5 w-[78%] -translate-x-1/2 rounded-full bg-black/45 blur-[6px]"
        aria-hidden
      />
      <motion.div
        className="relative"
        style={{ transformOrigin: "bottom center", height }}
        animate={{
          y: [0, -2.2, 0, -1.2, 0],
          rotate: flip ? [0, -0.8, 0, 0.5, 0] : [0, 0.8, 0, -0.5, 0],
        }}
        transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay }}
      >
        {/* thân mèo: nhịp thở */}
        <motion.img
          src={black ? catBlack : catWhite}
          alt=""
          draggable={false}
          className="block h-full w-auto drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]"
          animate={{ scaleY: [1, 1.018, 1], scaleX: [1, 0.994, 1] }}
          transition={{ duration: dur * 0.62, repeat: Infinity, ease: "easeInOut", delay }}
          style={{ transformOrigin: "bottom center" }}
        />
        {/* đuôi vẫy: dùng lớp phủ mảnh ở đuôi để tạo cảm giác ve vẩy */}
        <motion.div
          className="absolute bottom-[10%] h-[34%] w-[18%] origin-bottom"
          style={{
            left: flip ? "auto" : "-4%",
            right: flip ? "-4%" : "auto",
            background: black
              ? "radial-gradient(ellipse at 70% 85%, rgba(20,14,12,0.95), rgba(20,14,12,0) 70%)"
              : "radial-gradient(ellipse at 70% 85%, rgba(255,250,240,0.95), rgba(255,250,240,0) 70%)",
            filter: "blur(0.5px)",
          }}
          animate={calm ? { rotate: 0, x: 0 } : { rotate: [-7, 9, -5, 6, -7], x: [0, 2, -1, 1.5, 0] }}
          transition={
            calm
              ? { duration: 0.3 }
              : { duration: breathe(2.1), repeat: Infinity, ease: "easeInOut", delay }
          }
        />
        {/* mắt lấp lánh (ngước nhìn khi có bướm) */}
        <motion.span
          className="absolute rounded-full bg-white/85 mix-blend-screen"
          style={{
            left: flip ? "auto" : "58%",
            right: flip ? "58%" : "auto",
            top: lookingUp ? "20%" : "26%",
            width: "10%",
            height: "5%",
            filter: "blur(1.5px)",
            transition: "top .5s ease",
          }}
          animate={calm ? { opacity: 0.5 } : { opacity: [0.25, 0.75, 0.25] }}
          transition={
            calm ? { duration: 0.3 } : { duration: breathe(2.8), repeat: Infinity, ease: "easeInOut", delay: delay + 0.4 }
          }
        />
      </motion.div>
    </div>
  );
});

/** Bướm bay lượn theo quỹ đạo mềm, có thể bị mèo "nhìn theo". */
export const GardenButterfly = memo(function GardenButterfly({
  left,
  top,
  size = 16,
  delay = 0,
  hue = "#ffd66e",
}: {
  left: string;
  top: string;
  size?: number;
  delay?: number;
  hue?: string;
}) {
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{ left, top }}
      animate={
        calm
          ? { x: 0, y: 0, rotate: 0 }
          : {
              x: [0, 46, 88, 52, 10, -26, 0],
              y: [0, -30, -8, 22, 34, 10, 0],
              rotate: [-8, 6, -4, 8, -6, 4, -8],
            }
      }
      transition={calm ? { duration: 0.3 } : { duration: breathe(17), repeat: Infinity, ease: "easeInOut", delay }}
    >
      <motion.div
        animate={calm ? { scaleX: 1 } : { scaleX: [1, 0.35, 1, 0.4, 1] }}
        transition={calm ? { duration: 0.2 } : { duration: 0.42, repeat: Infinity, ease: "easeInOut", delay }}
        style={{ transformOrigin: "center" }}
      >
        <svg width={size} height={size * 0.8} viewBox="0 0 24 20" fill="none">
          <ellipse cx="6.5" cy="7" rx="6" ry="6.4" fill={hue} opacity="0.92" />
          <ellipse cx="17.5" cy="7" rx="6" ry="6.4" fill={hue} opacity="0.92" />
          <ellipse cx="6.5" cy="8" rx="3.4" ry="3.6" fill="#fff8e1" opacity="0.55" />
          <ellipse cx="17.5" cy="8" rx="3.4" ry="3.6" fill="#fff8e1" opacity="0.55" />
          <ellipse cx="12" cy="9" rx="1.1" ry="5" fill="#4a2f14" opacity="0.75" />
        </svg>
      </motion.div>
    </motion.div>
  );
});

/** Chim sẻ nhảy nhót trên cỏ (hoạt hình thuần CSS/SVG). */
export const GardenSparrow = memo(function GardenSparrow({
  left,
  bottom,
  size = 22,
  delay = 0,
  flip = false,
}: {
  left: string;
  bottom: string;
  size?: number;
  delay?: number;
  flip?: boolean;
}) {
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{ left, bottom, transform: flip ? "scaleX(-1)" : undefined }}
      animate={calm ? { x: 0, y: 0 } : { x: [0, 26, 54, 30, 0], y: [0, -3, 0, -2, 0] }}
      transition={calm ? { duration: 0.3 } : { duration: breathe(9), repeat: Infinity, ease: "easeInOut", delay }}
    >
      <motion.div
        animate={{ y: [0, -5, 0], scaleY: [1, 1.06, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay }}
        style={{ transformOrigin: "bottom center" }}
      >
        <svg width={size} height={size} viewBox="0 0 32 26" fill="none">
          <ellipse cx="16" cy="17" rx="9.5" ry="7.5" fill="#8a6a4a" />
          <ellipse cx="15" cy="19" rx="6" ry="5" fill="#c9a67a" opacity="0.85" />
          <circle cx="23" cy="10" r="5.2" fill="#9d7a55" />
          <path d="M27.6 10.2 L31.6 11.4 L27.4 12.8 Z" fill="#ffb648" />
          <circle cx="24.6" cy="9.2" r="1.05" fill="#241a12" />
          <path d="M8 12 Q4.5 8.5 3 12.5 Q5 15 8 14 Z" fill="#6f5237" />
        </svg>
      </motion.div>
    </motion.div>
  );
});

/** Bầy đom đóm nhỏ tụ lại quanh bánh kem (tăng cảm giác "phép thuật"). */
export const CakeFireflies = memo(function CakeFireflies({ count = 7 }: { count?: number }) {
  if (calm) return null;
  const n = lowEnd ? Math.max(3, Math.round(count * 0.5)) : count;
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute rounded-full bg-amber-200"
            style={{
              left: `${50 + Math.cos(a) * (16 + (i % 3) * 7)}%`,
              top: `${34 + Math.sin(a) * (13 + (i % 4) * 5)}%`,
              width: 3,
              height: 3,
              boxShadow: "0 0 10px 2px rgba(253,224,71,0.85)",
            }}
            animate={{
              opacity: [0.15, 0.95, 0.2],
              y: [0, -12, -3, -16, 0],
              x: [0, 6, -5, 3, 0],
              scale: [0.8, 1.25, 0.9],
            }}
            transition={{
              duration: 5 + (i % 4),
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.42,
            }}
          />
        );
      })}
    </div>
  );
});
