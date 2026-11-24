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
    /**
     * Đôi khi cô ấy ngừng nói giữa chừng (nghỉ lấy hơi) rồi nói tiếp.
     * Nhịp đều tăm tắp sẽ trông như máy đang chạy, không giống người.
     */
    let pauseFor = 0;

    const next = () => {
      if (!alive) return;

      if (pauseFor > 0) {
        // Đang nghỉ: hiện frame miệng đóng (index 1 = ảnh gốc) một nhịp.
        setIdx(1);
        pauseFor--;
      } else {
        // Chọn frame khác frame hiện tại (không lặp lại chính nó => luôn thấy đổi).
        setIdx((prev) => {
          let n = prev;
          while (n === prev) n = Math.floor(Math.random() * FRAMES.length);
          return n;
        });
        // ~12% khả năng nghỉ 1–3 nhịp trước khi nói tiếp
        if (Math.random() < 0.12) pauseFor = 1 + Math.floor(Math.random() * 3);
      }

      const base = HOLD_MIN + Math.random() * (HOLD_MAX - HOLD_MIN);
      timer = window.setTimeout(next, pauseFor > 0 ? base * 1.3 : base);
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
      {/*
        Các frame chồng tuyệt đối lên ảnh gốc.
        - Khi nói: luân phiên frame miệng mở.
        - Khi im: vẫn nạp sẵn và giữ opacity 0 => lần nói sau đổi frame
          không phải chờ tải/giải mã ảnh (tránh nháy trắng frame đầu).
      */}
      {FRAMES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          draggable={false}
          className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
          style={{ opacity: active && i === idx ? 1 : 0 }}
        />
      ))}
      {/*
        Biểu cảm khi im: thỉnh thoảng cô ấy mỉm cười nhẹ (frame há miệng nhẹ
        với opacity thấp trông như đang mỉm cười). Rất nhẹ => không gây chú ý,
        nhưng khiến nhân vật không đứng yên như tượng.
      */}
      {!active && (
        <img
          src={frame1}
          alt=""
          aria-hidden
          draggable={false}
          className={`pointer-events-none absolute inset-0 h-full w-full ${className} idle-smile`}
        />
      )}
    </>
  );
});
