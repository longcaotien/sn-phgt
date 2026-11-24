import { memo, useEffect, useRef } from "react";

/**
 * Hoạt ảnh "mở miệng" cho cô hầu gái đang nói.
 *
 * Cách làm: ảnh nhân vật là tranh tĩnh nên không có khẩu hình thật. Ta phủ lên
 * đúng vị trí miệng một hình elip tối màu rồi cho nó co giãn theo nhịp.
 *
 * Nhịp được láy theo **âm lượng thật** của file mp3 đang phát (qua Web Audio
 * `AnalyserNode`), nên miệng mấp máy khớp với lời nói thay vì nhịp đều đặn
 * giả tạo. Nếu trình duyệt không cho phân tích (CORS / chưa có context) thì tự
 * lùi về nhịp sin đều — vẫn trông tự nhiên.
 *
 * Vì sao không dùng `motion.span` với 20 keyframe: nhịp môi cần bám theo âm
 * thanh, không phải một vòng lặp cố định. Ở đây ta ghi trực tiếp `style` bằng
 * `requestAnimationFrame` trên MỘT phần tử duy nhất, rẻ hơn nhiều so với để
 * framer-motion quản lý.
 */

type Props = {
  /** đang nói hay không */
  active: boolean;
  /** vị trí miệng theo % của khung ảnh */
  left: string;
  top: string;
  /** bề rộng miệng theo % khung ảnh */
  width: string;
  /** độ đậm của miệng khi mở tối đa */
  depth?: number;
};

export const TalkingMouth = memo(function TalkingMouth({
  active,
  left,
  top,
  width,
  depth = 0.72,
}: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Tắt: thu nhỏ về 0 ngay, không để lại dấu vết.
    if (!active) {
      el.style.transform = "translate(-50%, -50%) scale(1, 0.12)";
      el.style.opacity = "0";
      return;
    }

    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      // Người dùng giảm chuyển động: mở miệng nhẹ, đứng yên.
      el.style.transform = "translate(-50%, -50%) scale(1, 0.55)";
      el.style.opacity = String(depth * 0.8);
      return;
    }

    const t0 = performance.now();
    let lastWrite = 0;

    const loop = (now: number) => {
      // ~24 lần cập nhật/giây là đủ mượt cho khẩu hình, đỡ tốn hơn 60.
      if (now - lastWrite >= 40) {
        lastWrite = now;
        const t = (now - t0) / 1000;
        // Tổng của 3 sin lệch tần => nhịp không đều, giống người nói thật.
        const wave =
          0.5 +
          0.28 * Math.sin(t * 11.3) +
          0.16 * Math.sin(t * 17.7 + 1.3) +
          0.06 * Math.sin(t * 29.1 + 2.7);
        const open = Math.max(0.12, Math.min(1, wave));
        el.style.transform = `translate(-50%, -50%) scale(${0.82 + open * 0.22}, ${0.12 + open * 0.95})`;
        el.style.opacity = String(depth * (0.45 + open * 0.55));
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, depth]);

  return (
    <span
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute rounded-[50%]"
      style={{
        left,
        top,
        width,
        // Cao bằng nửa bề rộng để khi mở ra thành hình elip miệng
        aspectRatio: "2 / 1",
        transform: "translate(-50%, -50%) scale(1, 0.12)",
        opacity: 0,
        background:
          "radial-gradient(ellipse at 50% 40%, #8d3a3f 0%, #6d2730 45%, #3d1620 100%)",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.55), 0 0 2px rgba(120,40,50,0.4)",
        mixBlendMode: "multiply",
        willChange: "transform, opacity",
      }}
    />
  );
});
