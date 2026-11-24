import { memo } from "react";
import catBlack from "../../assets/cat-black.webp";
import catWhite from "../../assets/cat-white.webp";
import { reduceMotionEnabled, richMotion } from "../../utils/perf";

/* =========================================================
   LINH VẬT SỐNG ĐỘNG TRONG KHU VƯỜN
   Mèo mun & mèo trắng đi lại, ngồi, ngước nhìn bướm. Bướm bay,
   chim sẻ nhảy nhót.

   TỐI ƯU QUAN TRỌNG: tất cả vòng lặp vô hạn ở đây dùng CSS
   `@keyframes` (xem `index.css`) thay vì framer-motion.
   - framer-motion tính toán + ghi style cho từng phần tử trong
     JS ở mỗi khung hình (tốn main thread, gây lag khi có nhiều
     phần tử cùng animate).
   - CSS animation chạy trên compositor thread: không tốn JS,
     không chặn main thread => 60fps kể cả máy yếu.
   ========================================================= */

/** Người dùng bật "giảm chuyển động" → mọi linh vật đứng yên. */
const calm = reduceMotionEnabled;

type CatProps = {
  /** true = mèo mun, false = mèo trắng */
  black?: boolean;
  left: string;
  bottom: string;
  height?: string;
  flip?: boolean;
  /** độ trễ pha (giây) */
  delay?: number;
  /** đang ngước nhìn bướm */
  lookingUp?: boolean;
  className?: string;
};

/** Một chú mèo: thở + nhún nhẹ + mắt lấp lánh, hoàn toàn bằng CSS. */
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
      <div
        className={`relative ${calm ? "" : "cat-body"}`}
        style={{
          transformOrigin: "bottom center",
          height,
          animationDelay: `${delay}s`,
          // Mỗi con một nhịp riêng để cảnh không "đồng bộ máy móc"
          animationDuration: black ? "5.2s" : "4.4s",
        }}
      >
        <img
          src={black ? catBlack : catWhite}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          className="block h-full w-auto drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]"
        />
        {/* mắt lấp lánh: chỉ opacity, chạy bằng CSS */}
        <span
          className={`absolute rounded-full bg-white/60 ${calm ? "" : "cat-eye"}`}
          style={{
            left: flip ? "auto" : "58%",
            right: flip ? "58%" : "auto",
            top: lookingUp ? "20%" : "26%",
            width: "10%",
            height: "5%",
            transition: "top .5s ease",
            animationDelay: `${delay + 0.4}s`,
          }}
        />
      </div>
    </div>
  );
});

/** Bướm bay lượn theo quỹ đạo mềm bằng CSS (vỗ cánh cũng bằng CSS). */
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
    <div
      className={`pointer-events-none absolute ${calm ? "" : "bfly-path"}`}
      style={{ left, top, animationDelay: `${delay}s` }}
    >
      <div
        className={calm ? "" : "bfly-flap"}
        style={{ transformOrigin: "center", animationDelay: `${delay}s` }}
      >
        <svg width={size} height={size * 0.8} viewBox="0 0 24 20" fill="none">
          <ellipse cx="6.5" cy="7" rx="6" ry="6.4" fill={hue} opacity="0.92" />
          <ellipse cx="17.5" cy="7" rx="6" ry="6.4" fill={hue} opacity="0.92" />
          <ellipse cx="6.5" cy="8" rx="3.4" ry="3.6" fill="#fff8e1" opacity="0.55" />
          <ellipse cx="17.5" cy="8" rx="3.4" ry="3.6" fill="#fff8e1" opacity="0.55" />
          <ellipse cx="12" cy="9" rx="1.1" ry="5" fill="#4a2f14" opacity="0.75" />
        </svg>
      </div>
    </div>
  );
});

/** Chim sẻ nhảy nhót trên cỏ. */
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
    <div
      className={`pointer-events-none absolute ${calm ? "" : "sparrow-hop"}`}
      style={{ left, bottom, transform: flip ? "scaleX(-1)" : undefined, animationDelay: `${delay}s` }}
    >
      <div
        className={calm ? "" : "sparrow-bob"}
        style={{ transformOrigin: "bottom center", animationDelay: `${delay}s` }}
      >
        <svg width={size} height={size} viewBox="0 0 32 26" fill="none">
          <ellipse cx="16" cy="17" rx="9.5" ry="7.5" fill="#8a6a4a" />
          <ellipse cx="15" cy="19" rx="6" ry="5" fill="#c9a67a" opacity="0.85" />
          <circle cx="23" cy="10" r="5.2" fill="#9d7a55" />
          <path d="M27.6 10.2 L31.6 11.4 L27.4 12.8 Z" fill="#ffb648" />
          <circle cx="24.6" cy="9.2" r="1.05" fill="#241a12" />
          <path d="M8 12 Q4.5 8.5 3 12.5 Q5 15 8 14 Z" fill="#6f5237" />
        </svg>
      </div>
    </div>
  );
});

/** Đom đóm nhỏ tụ quanh bánh kem — CSS, và tự tắt khi máy yếu. */
export const CakeFireflies = memo(function CakeFireflies({ count = 7 }: { count?: number }) {
  if (calm || !richMotion()) return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2;
        return (
          <span
            key={i}
            className="ffly absolute rounded-full bg-amber-200"
            style={{
              left: `${50 + Math.cos(a) * (16 + (i % 3) * 7)}%`,
              top: `${34 + Math.sin(a) * (13 + (i % 4) * 5)}%`,
              width: 3,
              height: 3,
              boxShadow: "0 0 10px 2px rgba(253,224,71,0.85)",
              animationDuration: `${5 + (i % 4)}s`,
              animationDelay: `${i * 0.42}s`,
            }}
          />
        );
      })}
    </div>
  );
});
