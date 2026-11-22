import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import confetti from "canvas-confetti";
import sceneBg from "../../assets/birthday-scene-bg.webp";
import maidCake from "../../assets/maid-cake.webp";
import maidBook from "../../assets/maid-book.webp";
import NatureCanvas from "./NatureCanvas";
import { CardTable, KnifeTable } from "./GardenTables";
import { birthdayMusic } from "./birthdayMusic";
import { MEMORIES, type MemoryBubbleItem } from "./memories";

type Stage = "celebrate" | "fireworks" | "ending";

const BUBBLE_LAYOUT = [
  { left: "8%", delay: -4, dur: 16, size: 124, sway: 20 },
  { left: "24%", delay: -10, dur: 18, size: 136, sway: -22 },
  { left: "66%", delay: -7, dur: 17, size: 130, sway: 18 },
  { left: "82%", delay: -13, dur: 19, size: 120, sway: -18 },
];

// Tọa độ chính xác 3 ngọn nến trên ảnh maid-cake.webp (544x900)
const CANDLE_POS = [
  { left: "15.7%", top: "22.5%" },
  { left: "20.0%", top: "21.6%" },
  { left: "24.9%", top: "22.5%" },
];

export default function BirthdayWorld({
  initialStage = "celebrate",
  onBackLobby,
}: {
  initialStage?: "celebrate" | "ending";
  onBackLobby: () => void;
}) {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [musicOn, setMusicOn] = useState(true);
  const [letterOpen, setLetterOpen] = useState(false);
  const [letterRead, setLetterRead] = useState(false);
  const [knifeHeld, setKnifeHeld] = useState(false);
  const [cakeCut, setCakeCut] = useState(false);
  const [bookMaidTalk, setBookMaidTalk] = useState(false);
  const [drawPts, setDrawPts] = useState<{ x: number; y: number }[]>([]);
  const [crumbs, setCrumbs] = useState<{ id: number; x: number; y: number; color: string; size: number }[]>([]);
  const [memories, setMemories] = useState<MemoryBubbleItem[]>(MEMORIES);
  const [brokenIds, setBrokenIds] = useState<Record<number, boolean>>({});
  const [dentedId, setDentedId] = useState<number | null>(null);
  const [zoomMemory, setZoomMemory] = useState<MemoryBubbleItem | null>(null);

  const drawingRef = useRef(false);
  const cakeBoxRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetIdRef = useRef<number>(1);
  const fwTimersRef = useRef<number[]>([]);

  // Parallax chiều sâu 4K theo chuột
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 32, damping: 20 });
  const sy = useSpring(my, { stiffness: 32, damping: 20 });
  const bgX = useTransform(sx, (v) => v * -18);
  const bgY = useTransform(sy, (v) => v * -10);
  const midX = useTransform(sx, (v) => v * -7);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx, my]);

  const clearFwTimers = () => {
    fwTimersRef.current.forEach(clearTimeout);
    fwTimersRef.current = [];
  };

  useEffect(() => {
    birthdayMusic.start().catch(() => {});
    return () => {
      clearFwTimers();
      birthdayMusic.stop();
    };
  }, []);

  const toggleMusic = () => {
    if (musicOn) {
      birthdayMusic.pause();
      setMusicOn(false);
    } else {
      birthdayMusic.start().catch(() => {});
      setMusicOn(true);
    }
  };

  const launchCelebrationConfetti = useCallback(() => {
    const colors = ["#ffd36a", "#ff5f9f", "#7ce8ff", "#a7f3d0", "#fff6dc", "#fda4af"];
    const rect = cakeBoxRef.current?.getBoundingClientRect();
    const origin = rect
      ? { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight }
      : { x: 0.52, y: 0.52 };

    confetti({ particleCount: 95, spread: 80, startVelocity: 48, origin, colors, scalar: 1.05 });

    const t1 = window.setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 125,
        startVelocity: 56,
        origin,
        colors,
        shapes: ["star"],
        scalar: 1.15,
      });
    }, 260);

    const t2 = window.setTimeout(() => {
      confetti({
        particleCount: 110,
        spread: 150,
        startVelocity: 44,
        origin: { x: origin.x, y: Math.max(0.15, origin.y - 0.1) },
        colors,
      });
    }, 620);

    const endAt = Date.now() + 3000;
    const shootSides = () => {
      confetti({ particleCount: 10, angle: 60, spread: 58, origin: { x: 0, y: 0.82 }, colors, scalar: 0.85 });
      confetti({ particleCount: 10, angle: 120, spread: 58, origin: { x: 1, y: 0.82 }, colors, scalar: 0.85 });
      if (Date.now() < endAt) requestAnimationFrame(shootSides);
    };
    requestAnimationFrame(shootSides);

    const t3 = window.setTimeout(() => {
      setStage("ending");
    }, 3900);

    fwTimersRef.current.push(t1, t2, t3);
  }, []);

  const performCut = useCallback(() => {
    if (cakeCut) return;
    setCakeCut(true);
    setKnifeHeld(false);
    setDrawPts([]);

    const colors = ["#ffd36a", "#fff6dc", "#ff8fb9", "#fda4af", "#a7f3d0", "#ffffff"];
    setCrumbs(
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 200,
        y: -25 - Math.random() * 110,
        color: colors[i % colors.length],
        size: 5 + Math.random() * 7,
      }))
    );

    if (!musicOn) {
      birthdayMusic.start().catch(() => {});
      setMusicOn(true);
    }

    const t = window.setTimeout(() => {
      setStage("fireworks");
      launchCelebrationConfetti();
    }, 820);
    fwTimersRef.current.push(t);
  }, [cakeCut, launchCelebrationConfetti, musicOn]);

  const getLocalPt = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = cakeBoxRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const handleCakePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!knifeHeld || cakeCut) return;
    drawingRef.current = true;
    setDrawPts([getLocalPt(e)]);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleCakePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    const p = getLocalPt(e);
    setDrawPts((prev) => {
      const last = prev[prev.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 4) {
        return [...prev, p];
      }
      return prev;
    });
  };

  const handleCakePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    let len = 0;
    for (let i = 1; i < drawPts.length; i++) {
      len += Math.hypot(drawPts[i].x - drawPts[i - 1].x, drawPts[i].y - drawPts[i - 1].y);
    }
    if (len >= 28) {
      performCut();
    } else {
      setDrawPts([]);
    }
  };

  const handleReplayCelebrate = () => {
    clearFwTimers();
    setCakeCut(false);
    setKnifeHeld(false);
    setCrumbs([]);
    setDrawPts([]);
    setStage("celebrate");
  };

  const triggerUploadFor = (id: number) => {
    uploadTargetIdRef.current = id;
    fileInputRef.current?.click();
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const targetId = uploadTargetIdRef.current;
    setBrokenIds((b) => ({ ...b, [targetId]: false }));
    setMemories((prev) => prev.map((m) => (m.id === targetId ? { ...m, src: url } : m)));
    setZoomMemory((z) => (z && z.id === targetId ? { ...z, src: url } : z));
    e.target.value = "";
  };

  const pathD = drawPts.length ? "M " + drawPts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ") : "";

  return (
    <motion.main
      className="relative h-full w-full overflow-hidden bg-[#101c16] text-amber-50 select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.1 }}
    >
      {/* Background 4K thiên nhiên hoàng hôn + parallax + chuyển động êm */}
      <motion.div className="pointer-events-none absolute -inset-6" style={{ x: bgX, y: bgY }}>
        <motion.img
          src={sceneBg}
          alt="Khu vườn thiên nhiên 4K"
          className="h-full w-full object-cover object-center"
          animate={{ scale: [1.03, 1.065, 1.03] }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {/* Lớp ánh nắng hoàng hôn & chiều sâu điện ảnh */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 59% 36%, rgba(255, 224, 150, 0.22), transparent 46%), linear-gradient(180deg, rgba(16, 28, 22, 0.26) 0%, rgba(12, 20, 18, 0.04) 46%, rgba(8, 16, 12, 0.36) 100%)",
        }}
      />

      {/* Lớp hiệu ứng sau: tia nắng, sương hồ, sóng lấp lánh, chim bay, liễu rủ, đom đóm */}
      <NatureCanvas layer="back" />

      {/* Header điều khiển trên cùng */}
      <div className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-3 py-3 sm:px-8 sm:py-4">
        <button
          onClick={onBackLobby}
          className="rounded-full border border-white/25 bg-black/35 px-3.5 py-1.5 text-xs font-medium tracking-wider text-amber-50/95 backdrop-blur-md transition hover:border-amber-200/60 hover:bg-black/55"
        >
          ← Sảnh Chính
        </button>

        <div className="hidden items-center gap-2 rounded-full border border-amber-200/30 bg-black/30 px-4 py-1 text-[11px] tracking-[0.22em] text-amber-100/95 backdrop-blur-md sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" />
          <span>KHU VƯỜN SINH NHẬT · 30/11</span>
        </div>

        <button
          onClick={toggleMusic}
          aria-label={musicOn ? "Tắt nhạc" : "Bật nhạc"}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-200/40 bg-black/35 text-lg text-amber-200 backdrop-blur-md transition hover:scale-105 hover:bg-black/55"
        >
          {musicOn ? "♪" : "✕"}
        </button>
      </div>

      {/* ============================================================
          CẢNH 1 & 2: KHU VƯỜN 4K VỚI 2 CÔ HẦU GÁI & 2 CHIẾC BÀN 4K
      ============================================================ */}
      <AnimatePresence>
        {(stage === "celebrate" || stage === "fireworks") && (
          <motion.section
            key="celebrate-stage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(6px)", transition: { duration: 0.45 } }}
            transition={{ duration: 0.7 }}
            className="relative z-20 h-full w-full"
          >
            {/* Tiêu đề chào mừng ở phía trên không che nhân vật */}
            <motion.div
              animate={stage === "fireworks" ? { scale: [1, 1.05, 1.01] } : {}}
              transition={{ duration: 0.8 }}
              className="pointer-events-none relative z-30 mx-auto max-w-2xl px-4 pt-14 text-center sm:pt-14"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.34em] text-amber-200 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-xs">
                Thung Lũng Hoàng Hôn · 30 / 11
              </div>
              <h1
                className="mt-1 text-xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl"
                style={{ textShadow: "0 4px 26px rgba(0,0,0,0.68), 0 0 36px rgba(255,214,120,0.45)" }}
              >
                {stage === "fireworks"
                  ? "Happy Birthday Phạm Hoàng Gia Trí!"
                  : "Chúc Mừng Sinh Nhật Gia Trí"}
              </h1>
              <p
                className="mx-auto mt-1 max-w-lg text-[11px] font-medium text-amber-50/95 sm:text-sm"
                style={{ textShadow: "0 2px 12px rgba(0,0,0,0.75)" }}
              >
                {stage === "fireworks"
                  ? "Chúc tuổi mới thật bình yên, rực rỡ và viên mãn."
                  : !letterRead
                  ? "Nhấn vào Bàn Thiệp bên trái để đọc thư, rồi lấy dao ở Bàn Dao bên phải nhé."
                  : !knifeHeld
                  ? "Nhấn vào Bàn Dao bên phải để cầm dao bạc cắt bánh kem trên tay."
                  : "Kéo ngang chiếc bánh trên tay cô hầu gái để cắt bánh (hoặc nhấn Cắt Bánh Ngay)."}
              </p>
            </motion.div>

            {/* Sân khấu nhân vật & 2 bàn 4K thoáng đãng */}
            <motion.div style={{ x: midX }} className="absolute inset-0">
              {/* 1. CÔ HẦU GÁI #2: NGỒI ĐỌC SÁCH DƯỚI GỐC CÂY BÊN TRÁI */}
              <div className="absolute bottom-[34%] left-[-4%] z-10 sm:bottom-[13%] sm:left-[2.5%] lg:left-[4.5%]">
                {/* Bóng mềm hòa nền cỏ dưới tán cây */}
                <div className="pointer-events-none absolute -bottom-2 left-1/2 h-6 w-36 -translate-x-1/2 rounded-full bg-black/55 blur-lg sm:w-48" />

                <AnimatePresence>
                  {bookMaidTalk && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.92 }}
                      className="pointer-events-none absolute -top-12 left-4 z-30 w-48 rounded-2xl border border-amber-200/50 bg-black/75 px-3 py-2 text-[11px] leading-snug text-amber-100 shadow-xl backdrop-blur-md sm:left-8 sm:w-56"
                    >
                      “Ánh nắng dưới tán liễu này dịu thật… Chúc Gia Trí sinh nhật 30/11 thật an nhiên nhé ♪”
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={() => {
                    setBookMaidTalk(true);
                    window.setTimeout(() => setBookMaidTalk(false), 3600);
                  }}
                  aria-label="Cô hầu gái ngồi đọc sách dưới gốc cây"
                  className="group relative block focus:outline-none"
                >
                  {/* Chuyển động anime Live2D-style: thở nhẹ + nghiêng theo gió + chớp mắt */}
                  <motion.div
                    animate={{
                      y: [0, -2.5, 0],
                      rotate: [-0.4, 0.7, -0.4],
                      scaleY: [1, 1.009, 1],
                    }}
                    transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
                    style={{ transformOrigin: "bottom center" }}
                    className="relative"
                  >
                    <img
                      src={maidBook}
                      alt="Cô hầu gái ngồi đọc sách dưới gốc cây"
                      draggable={false}
                      className="h-[21vh] w-auto select-none object-contain drop-shadow-[0_14px_26px_rgba(0,0,0,0.55)] transition group-hover:brightness-105 sm:h-[37vh] lg:h-[42vh]"
                    />
                  </motion.div>
                </button>
              </div>

              {/* 2. BÀN THIỆP 4K (ĐẶT TÁCH BẠCH KHOẢNG TRỐNG GIỮA TRÁI) */}
              <div className="absolute bottom-[2%] left-[2.5%] z-[25] sm:bottom-[3%] sm:left-[21%] lg:left-[23.5%]">
                <CardTable letterRead={letterRead} onClick={() => setLetterOpen(true)} />
              </div>

              {/* 3. CÔ HẦU GÁI #1: QUỲ HAI GỐI HAI TAY NÂNG BÁNH SINH NHẬT (DỊCH THOÁNG SANG PHẢI TRUNG TÂM) */}
              <div className="absolute bottom-[20%] left-1/2 z-20 -translate-x-1/2 sm:bottom-[3.5%] sm:left-[55%]">
                {/* Bóng mềm hòa mặt cỏ */}
                <div className="pointer-events-none absolute -bottom-2 left-1/2 h-7 w-56 -translate-x-1/2 rounded-full bg-black/55 blur-lg sm:w-72" />

                <motion.div
                  animate={{
                    y: [0, -3, 0],
                    rotate: [-0.35, 0.55, -0.35],
                    scaleY: [1, 1.008, 1],
                  }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                  style={{ transformOrigin: "bottom center" }}
                  className="relative"
                >
                  <img
                    src={maidCake}
                    alt="Cô hầu gái quỳ gối nâng bánh sinh nhật"
                    draggable={false}
                    className="h-[40vh] w-auto max-w-none select-none object-contain drop-shadow-[0_18px_36px_rgba(0,0,0,0.62)] sm:h-[56vh] lg:h-[61vh]"
                  />

                  {/* Hào quang nắng vàng hoàng hôn tỏa nhẹ từ sau bánh */}
                  <div className="pointer-events-none absolute left-[6%] top-[22%] h-[30%] w-[36%] rounded-full bg-[radial-gradient(circle,rgba(255,228,150,0.36),transparent_70%)] blur-xl" />

                  {/* 3 Ngọn lửa nến mảnh & sáng dịu kiểu anime (không thô) */}
                  {CANDLE_POS.map((pos, idx) => (
                    <motion.span
                      key={idx}
                      animate={{
                        scale: [1, 1.18, 0.94, 1.12, 1],
                        rotate: [-4, 5, -3, 3, -4],
                        opacity: [0.85, 1, 0.8, 1, 0.85],
                      }}
                      transition={{ duration: 0.85 + idx * 0.14, repeat: Infinity, ease: "easeInOut" }}
                      style={{ left: pos.left, top: pos.top }}
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
                    >
                      <span className="block h-3 w-1.5 rounded-full bg-gradient-to-t from-amber-500 via-yellow-200 to-white shadow-[0_0_12px_3px_rgba(253,224,71,0.85)] sm:h-3.5 sm:w-1.5" />
                    </motion.span>
                  ))}

                  {/* Vùng tương tác cắt bánh đặt khớp lên chiếc bánh trên tay cô ấy */}
                  <div
                    ref={cakeBoxRef}
                    onPointerDown={handleCakePointerDown}
                    onPointerMove={handleCakePointerMove}
                    onPointerUp={handleCakePointerUp}
                    onPointerCancel={handleCakePointerUp}
                    className={`absolute left-[5%] top-[21%] h-[34%] w-[41%] touch-none ${
                      knifeHeld && !cakeCut ? "cursor-crosshair" : "pointer-events-none"
                    }`}
                  >
                    {knifeHeld && !cakeCut && (
                      <div className="pointer-events-none absolute left-1/2 top-[16%] h-[72%] w-0.5 -translate-x-1/2 animate-pulse rounded-full bg-gradient-to-b from-transparent via-amber-200 to-transparent shadow-[0_0_14px_#fde68a]" />
                    )}

                    <AnimatePresence>
                      {cakeCut && (
                        <motion.div
                          initial={{ x: 0, y: 0, opacity: 0, scale: 0.7 }}
                          animate={{ x: 34, y: 18, opacity: 1, scale: 1, rotate: 16 }}
                          transition={{ type: "spring", stiffness: 150, damping: 14 }}
                          className="pointer-events-none absolute bottom-2 right-0 h-11 w-10 rounded-r-lg border border-amber-100 bg-gradient-to-b from-[#fff5e4] via-[#fbd6dc] to-[#ec8ca3] shadow-xl sm:h-14 sm:w-12"
                        >
                          <div className="h-2.5 w-full bg-[#fffdf7]" />
                          <div className="mt-2 h-1.5 w-full bg-rose-400/75" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {pathD && (
                      <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible">
                        <path d={pathD} fill="none" stroke="rgba(255,224,130,0.55)" strokeWidth="10" strokeLinecap="round" />
                        <path d={pathD} fill="none" stroke="#fffef0" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    )}

                    {crumbs.map((c) => (
                      <motion.span
                        key={c.id}
                        initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
                        animate={{ x: c.x, y: c.y, opacity: 0, scale: 1.35 }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                        className="pointer-events-none absolute left-1/2 top-1/2 z-30 rounded-full"
                        style={{ width: c.size, height: c.size, background: c.color }}
                      />
                    ))}
                  </div>
                </motion.div>

                {/* Nút Cắt Bánh Ngay khi đã cầm dao */}
                <AnimatePresence>
                  {knifeHeld && !cakeCut && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute -top-9 left-[26%] z-40 -translate-x-1/2"
                    >
                      <button
                        type="button"
                        onClick={performCut}
                        className="whitespace-nowrap rounded-full border border-amber-100/70 bg-gradient-to-r from-amber-300 to-rose-300 px-4 py-1.5 text-xs font-extrabold text-stone-900 shadow-[0_6px_24px_rgba(251,191,36,0.55)] transition hover:scale-105 active:scale-95"
                      >
                        ✦ Cắt Bánh Ngay
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 4. BÀN DAO 4K (PHẢI) */}
              <div className="absolute bottom-[2%] right-[2.5%] z-[25] sm:bottom-[3%] sm:right-[7%] lg:right-[10.5%]">
                <KnifeTable
                  knifeHeld={knifeHeld}
                  cakeCut={cakeCut}
                  onClick={() => {
                    if (!cakeCut) setKnifeHeld((k) => !k);
                  }}
                />
              </div>
            </motion.div>
          </motion.section>
        )}

        {/* ============================================================
            CẢNH 3 (PHẦN KẾT): HỘP NHẠC QUAY & BONG BÓNG KỶ NIỆM BAY LÊN
        ============================================================ */}
        {stage === "ending" && (
          <motion.section
            key="ending-stage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.1 }}
            className="relative z-20 flex h-full w-full flex-col items-center justify-end px-4 pb-8 pt-16 sm:justify-center sm:pb-10"
          >
            {/* Bong bóng kỷ niệm bay lên lơ lửng */}
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
              {memories.map((m, idx) => {
                const cfg = BUBBLE_LAYOUT[idx % BUBBLE_LAYOUT.length];
                const isDented = dentedId === m.id;
                const isMissing = brokenIds[m.id];

                return (
                  <motion.div
                    key={m.id}
                    className="pointer-events-auto absolute bottom-[-160px]"
                    style={{ left: cfg.left }}
                    animate={{
                      y: [0, -960],
                      x: [0, cfg.sway, -cfg.sway * 0.6, cfg.sway * 0.4, 0],
                    }}
                    transition={{
                      y: { duration: cfg.dur, repeat: Infinity, delay: cfg.delay, ease: "linear" },
                      x: { duration: 7 + idx, repeat: Infinity, ease: "easeInOut" },
                    }}
                  >
                    <motion.div
                      onPointerEnter={() => setDentedId(m.id)}
                      onPointerLeave={() => setDentedId((cur) => (cur === m.id ? null : cur))}
                      onClick={() => setZoomMemory(m)}
                      animate={isDented ? { scaleX: 0.9, scaleY: 1.08 } : { scaleX: 1, scaleY: 1 }}
                      transition={{ type: "spring", stiffness: 360, damping: 16 }}
                      style={{ width: cfg.size, height: cfg.size }}
                      className="group relative flex cursor-pointer items-center justify-center rounded-full border border-white/50 bg-[radial-gradient(circle_at_30%_28%,rgba(255,255,255,0.45),rgba(160,235,255,0.16)_52%,rgba(255,180,220,0.2)_85%,rgba(255,255,255,0.4))] p-2.5 shadow-[0_10px_35px_rgba(0,0,0,0.22),inset_0_0_24px_rgba(255,255,255,0.42)] backdrop-blur-[3px]"
                    >
                      <div className="relative h-full w-full overflow-hidden rounded-full border border-white/45 bg-gradient-to-br from-amber-100/25 to-emerald-900/40">
                        {!isMissing ? (
                          <img
                            src={m.src}
                            alt={m.caption}
                            onError={() => setBrokenIds((b) => ({ ...b, [m.id]: true }))}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center">
                            <span className="text-lg text-amber-200">✦</span>
                            <span className="mt-0.5 text-[10px] font-bold text-amber-100">Ảnh #{m.id}</span>
                            <span className="text-[8px] text-amber-100/75">Chạm để thêm</span>
                          </div>
                        )}
                      </div>

                      <span className="pointer-events-none absolute left-4 top-3 h-4 w-7 -rotate-25 rounded-full bg-white/65 blur-[1px]" />
                      <span className="pointer-events-none absolute bottom-3 right-4 h-2.5 w-2.5 rounded-full bg-cyan-200/70 blur-[0.5px]" />
                      <span className="pointer-events-none absolute -bottom-11 left-1/2 h-11 w-px -translate-x-1/2 bg-gradient-to-b from-white/70 to-transparent" />
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            {/* Hộp nhạc quay chuyển động */}
            <div className="relative z-30 flex flex-col items-center">
              {musicOn && (
                <div className="pointer-events-none relative mb-1 flex gap-6 text-amber-200">
                  {["♪", "♫", "♬"].map((n, i) => (
                    <motion.span
                      key={n + i}
                      animate={{ y: [0, -26], opacity: [0, 1, 0], x: [0, i % 2 ? 8 : -8] }}
                      transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.7 }}
                      className="text-lg drop-shadow-[0_0_8px_rgba(253,224,71,0.7)]"
                    >
                      {n}
                    </motion.span>
                  ))}
                </div>
              )}

              <div
                onClick={toggleMusic}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && toggleMusic()}
                className="group relative flex cursor-pointer items-center gap-4 rounded-3xl border border-amber-200/35 bg-gradient-to-br from-[#3b2618]/90 via-[#281910]/95 to-[#1b110b]/95 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,225,170,0.3)] backdrop-blur-md transition hover:scale-[1.02] sm:gap-6 sm:p-6"
              >
                <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-4 border-amber-900/70 bg-black/50 p-1.5 shadow-inner sm:h-48 sm:w-48">
                  <motion.div
                    animate={musicOn ? { rotate: 360 } : { rotate: 0 }}
                    transition={
                      musicOn
                        ? { duration: 4.5, repeat: Infinity, ease: "linear" }
                        : { duration: 0.8, ease: "easeOut" }
                    }
                    className="relative flex h-full w-full items-center justify-center rounded-full"
                    style={{
                      background:
                        "repeating-radial-gradient(circle at center, #111 0px, #111 3px, #1f1f24 4px, #111 6px)",
                      boxShadow: "inset 0 0 22px rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="flex h-18 w-18 flex-col items-center justify-center rounded-full border border-amber-300/60 bg-gradient-to-br from-amber-200 via-rose-200 to-amber-300 p-2 text-center text-stone-900 shadow-md sm:h-24 sm:w-24">
                      <span className="text-[7px] font-bold uppercase tracking-wider opacity-75 sm:text-[8px]">Memory Box</span>
                      <span className="mt-0.5 text-[10px] font-black leading-tight sm:text-xs">Gia Trí</span>
                      <span className="mt-0.5 text-[8px] font-bold">30 · 11</span>
                    </div>
                    <span className="absolute h-2.5 w-2.5 rounded-full bg-stone-900 ring-2 ring-amber-200" />
                  </motion.div>

                  <motion.div
                    animate={{ rotate: musicOn ? 22 : 4 }}
                    transition={{ duration: 0.65, ease: "easeOut" }}
                    style={{ transformOrigin: "80% 18%" }}
                    className="pointer-events-none absolute -right-2 top-2 h-24 w-6"
                  >
                    <div className="ml-auto h-4 w-4 rounded-full bg-gradient-to-br from-amber-200 to-amber-600 shadow" />
                    <div className="mx-auto -mt-1 h-16 w-1.5 rotate-12 rounded-full bg-gradient-to-b from-slate-200 to-slate-400" />
                    <div className="-ml-0.5 -mt-1 h-3 w-2.5 rotate-12 rounded-sm bg-amber-300" />
                  </motion.div>
                </div>

                <div className="flex flex-col justify-between self-stretch py-1 text-left">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          musicOn ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-500/40"
                        }`}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/80">
                        {musicOn ? "Đang Phát" : "Tạm Dừng"}
                      </span>
                    </div>
                    <h2 className="mt-1.5 text-base font-extrabold text-amber-50 sm:text-xl">
                      Hộp Nhạc Kỷ Niệm
                    </h2>
                    <p className="mt-0.5 text-[11px] text-amber-100/70">Chạm vào hộp nhạc để bật/tắt</p>
                  </div>

                  <div className="my-3 flex h-7 items-end gap-1.5">
                    {[0.6, 1, 0.75, 0.95, 0.55, 0.85].map((h, i) => (
                      <motion.span
                        key={i}
                        animate={
                          musicOn
                            ? { height: ["25%", `${h * 100}%`, "35%", `${h * 85}%`] }
                            : { height: "20%" }
                        }
                        transition={
                          musicOn
                            ? { duration: 0.7 + i * 0.12, repeat: Infinity, repeatType: "reverse" }
                            : { duration: 0.3 }
                        }
                        className="w-2 rounded-t-full bg-gradient-to-t from-amber-400 to-rose-300"
                      />
                    ))}
                  </div>

                  <div className="text-[10px] text-amber-200/75">33 RPM · 4K Garden Edition</div>
                </div>
              </div>

              <div className="mt-5 text-center">
                <p className="text-sm font-medium text-amber-50/95 drop-shadow sm:text-base">
                  “Một món quà nhỏ, nhưng là cả tấm lòng dành tặng Gia Trí 30/11.”
                </p>
                <p className="mt-1 text-[11px] text-amber-100/80 drop-shadow">
                  Chạm vào bong bóng bay lên để xem ảnh kỷ niệm (hoặc thêm ảnh tại <code>public/memories/</code>)
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleReplayCelebrate}
                    className="rounded-full border border-amber-200/45 bg-black/45 px-5 py-2 text-xs font-semibold text-amber-100 backdrop-blur-md transition hover:bg-black/65"
                  >
                    ✦ Quay lại khu vườn
                  </button>
                  <button
                    type="button"
                    onClick={onBackLobby}
                    className="rounded-full bg-gradient-to-r from-amber-300 to-emerald-200 px-5 py-2 text-xs font-extrabold text-stone-900 shadow-lg transition hover:scale-105"
                  >
                    Về Sảnh Chính
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Lớp cỏ mềm mại & cánh hoa anh đào + bokeh 4K ở tiền cảnh */}
      <NatureCanvas layer="front" />

      {/* ============================================================
          MODAL THIỆP CHÚC MỪNG
      ============================================================ */}
      <AnimatePresence>
        {letterOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setLetterOpen(false);
              setLetterRead(true);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.86, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-3xl border border-amber-200/45 bg-gradient-to-b from-[#fffaf0] to-[#f8ebd2] p-6 text-stone-800 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:p-8"
            >
              <div className="text-xs font-bold uppercase tracking-[0.26em] text-rose-700/80">
                Thiệp Sinh Nhật · 30/11
              </div>
              <h2 className="mt-1 text-xl font-black text-stone-900 sm:text-2xl">
                Gửi Phạm Hoàng Gia Trí,
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-stone-700 sm:text-[15px]">
                <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  Chúc mừng sinh nhật tuổi mới! Sau khi đã mạnh mẽ chinh phục cả ba bức tượng và hạ gục Tượng Thần Mỉm Cười,
                  đây là khu vườn bình yên dành riêng cho bạn.
                </motion.p>
                <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  Chúc Gia Trí luôn thật nhiều sức khỏe, giữ mãi ngọn lửa nhiệt huyết, vững vàng trước mọi thử thách và
                  đón nhận thật nhiều niềm vui, may mắn trong từng ngày của tuổi mới.
                </motion.p>
                <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="font-semibold text-rose-800">
                  Sinh nhật 30/11 thật rực rỡ và đáng nhớ nhé! ♥
                </motion.p>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setLetterOpen(false);
                    setLetterRead(true);
                  }}
                  className="rounded-full bg-stone-900 px-6 py-2 text-xs font-bold text-amber-100 transition hover:bg-stone-800"
                >
                  Đóng thiệp & Cầm dao cắt bánh →
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================
          MODAL PHÓNG TO ẢNH KỶ NIỆM & CHỌN ẢNH THỬ
      ============================================================ */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFilePicked} className="hidden" />
      <AnimatePresence>
        {zoomMemory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomMemory(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.86, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm overflow-hidden rounded-3xl border border-amber-200/40 bg-[#18221e]/95 p-4 text-center shadow-2xl"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/20 bg-black/30">
                {!brokenIds[zoomMemory.id] ? (
                  <img src={zoomMemory.src} alt={zoomMemory.caption} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center px-6 text-amber-100/80">
                    <span className="text-4xl text-amber-300">✦</span>
                    <p className="mt-2 text-sm font-bold">Chưa có ảnh #{zoomMemory.id}</p>
                    <p className="mt-1 text-xs text-amber-100/60">
                      Bỏ file <code>anh{zoomMemory.id}.jpg</code> vào <code>public/memories/</code> hoặc chọn ảnh thử bên dưới.
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-3 text-sm font-bold text-amber-100">{zoomMemory.caption}</div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => triggerUploadFor(zoomMemory.id)}
                  className="flex-1 rounded-full border border-amber-300/50 bg-amber-300/15 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/25"
                >
                  + Chọn ảnh từ máy
                </button>
                <button
                  type="button"
                  onClick={() => setZoomMemory(null)}
                  className="rounded-full bg-white/15 px-5 py-2 text-xs font-semibold text-white hover:bg-white/25"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
