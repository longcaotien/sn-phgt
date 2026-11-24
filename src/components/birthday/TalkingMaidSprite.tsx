import { memo, useEffect, useState } from "react";
import baseSrc from "../../assets/maid-cake.webp";
import frame1 from "../../assets/talk/maid-cake-1.webp";
import frame2 from "../../assets/talk/maid-cake-2.webp";

/**
 * Hoạt ảnh "đang nói" cho cô hầu gái — dùng **các frame ảnh thật**.
 *
 * Vì sao không chèn elip vào miệng: bản đầu tiên làm vậy và nó trông giả, lại
 * lệch khớp với nụ cười trong tranh (miệng vẽ sẵn là một đường cong, elip đè
 * lên thành hai cái miệng).
 *
 * Cách làm hiện tại: 3 frame cùng bố cục, **khớp pixel tuyệt đối** với ảnh gốc
 * (đã kiểm bằng `compare -subimage-search`: độ lệch 0 px), chỉ khác duy nhất
 * phần miệng. Luân phiên theo nhịp ngẫu nhiên để trông như đang nói.
 *
 * Vì các frame trùng khít nhau, khi đổi frame trình duyệt chỉ vẽ lại vài
 * pixel quanh miệng — không thấy "nhảy" hình, không thấy viền, không lệch.
 */

const FRAMES = [frame1, baseSrc, frame2] as const;

/** Mỗi frame giữ trong khoảng này (ms) — ngẫu nhiên để không đều như máy. */
const HOLD_MIN = 95;
const HOLD_MAX = 190;

type Props = {
  /** đang nói thì chạy hoạt ảnh, im thì trả về frame gốc */
  active: boolean;
  alt?: string;
  className?: string;
};

export const TalkingMaidSprite = memo(function TalkingMaidSprite({ active, alt = "", className = "" }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!active) {
      setIdx(0);
      return;
    }

    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Người dùng giảm chuyển động: giữ frame há miệng nhẹ, không đổi liên tục.
    if (reduce) {
      setIdx(1);
      return;
    }

    let timer = 0;
    let alive = true;

    const next = () => {
      if (!alive) return;
      // Chọn frame khác frame hiện tại (không lặp lại chính nó => luôn thấy đổi).
      setIdx((prev) => {
        let n = prev;
        while (n === prev) n = Math.floor(Math.random() * FRAMES.length);
        return n;
      });
      timer = window.setTimeout(next, HOLD_MIN + Math.random() * (HOLD_MAX - HOLD_MIN));
    };

    timer = window.setTimeout(next, HOLD_MIN);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [active]);

  return (
    <>
      {/* Ảnh gốc giữ chỗ (quyết định kích thước khung) — không bao giờ đổi. */}
      <img
        src={baseSrc}
        alt={alt}
        draggable={false}
        className={className}
        style={{ visibility: active ? "hidden" : "visible" }}
      />
      {/* Các frame nói: chồng tuyệt đối lên ảnh gốc, chỉ frame đang chọn hiện. */}
      {active &&
        FRAMES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden
            draggable={false}
            className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
            style={{ opacity: i === idx ? 1 : 0 }}
          />
        ))}
    </>
  );
});
