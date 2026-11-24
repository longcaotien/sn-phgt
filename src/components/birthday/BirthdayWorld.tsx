import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import confetti from "canvas-confetti";
import sceneBg from "../../assets/birthday-scene-bg.webp";
import maidCake from "../../assets/maid-cake.webp";
import maidBook from "../../assets/maid-book.webp";
import NatureCanvas from "./NatureCanvas";
import { CakeFireflies, GardenButterfly, GardenCat, GardenSparrow } from "./GardenCreatures";
import { CardTable, KnifeTable } from "./GardenTables";
import { birthdayMusic } from "./birthdayMusic";
import { maidVoice } from "./maidVoice";
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
  const [catLookUp, setCatLookUp] = useState(false);
  /** Trạng thái giọng hầu gái (đang nói / bị chặn / đã tắt tiếng) */
  const [voice, setVoice] = useState(maidVoice.getState());
  /** Hiện bong bóng phụ đề tiếng Nhật khi cô ấy nói */
  const [voiceCaption, setVoiceCaption] = useState<string | null>(null);

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

  // Mèo thỉnh thoảng ngước nhìn bướm => tăng cảm giác sống động
  useEffect(() => {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      setCatLookUp(true);
      window.setTimeout(() => alive && setCatLookUp(false), 2600);
      window.setTimeout(loop, 9000 + Math.random() * 4000);
    };
    const t = window.setTimeout(loop, 2200);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, []);

  const clearFwTimers = () => {
    fwTimersRef.current.forEach(clearTimeout);
    fwTimersRef.current = [];
  };

  // Nối giọng hầu gái với nhạc nền để tự hạ nhạc khi cô ấy nói (ducking)
  useEffect(() => {
    maidVoice.bindMusic((scale) => birthdayMusic.setVolumeScale(scale));
    maidVoice.preload();
    return maidVoice.subscribe(setVoice);
  }, []);

  useEffect(() => {
    birthdayMusic.start().catch(() => {});
    return () => {
      clearFwTimers();
      birthdayMusic.stop();
      maidVoice.stop();
    };
  }, []);

  /**
   * Câu chào khi bước vào vườn.
   * Trình duyệt chặn autoplay nếu chưa có thao tác của người dùng — nhưng vì
   * người chơi phải bấm nút để vào khu vườn, ta vẫn thử phát; nếu bị chặn thì
   * `voice.needsGesture` bật lên và một nút "chạm để nghe" hiện ra.
   */
  useEffect(() => {
    let cancelled = false;
    const greet = async () => {
      const ok = await maidVoice.say("entry");
      if (cancelled || !ok) return;
      setVoiceCaption("お誕生日おめでとうございます、ご主人様！");
      fwTimersRef.current.push(window.setTimeout(() => setVoiceCaption(null), 5200));
    };
    // Đợi cảnh hiện ra một nhịp rồi mới nói (đỡ "cụt" khi vừa chuyển cảnh).
    const t = window.setTimeout(greet, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
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
      className="cinema-vignette relative h-full w-full overflow-hidden bg-[#101c16] text-amber-50 select-none"
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
          className="glass-warm rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wider text-amber-50/95 transition hover:border-amber-200/60 hover:bg-black/55 hover:text-white"
        >
          ← Sảnh Chính
        </button>

        <div className="glass-warm hidden items-center gap-2 rounded-full px-4 py-1 text-[11px] tracking-[0.22em] text-amber-100/95 sm:flex">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]"
            animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.15, 0.9] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <span>KHU VƯỜN SINH NHẬT · 30/11</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Bật/tắt giọng cô hầu gái (tiếng Nhật) */}
          <button
            onClick={() => maidVoice.toggleMuted()}
            aria-label={voice.muted ? "Bật giọng hầu gái" : "Tắt giọng hầu gái"}
            title={voice.muted ? "Bật giọng hầu gái" : "Tắt giọng hầu gái"}
            className={`glass-warm relative flex h-10 w-10 items-center justify-center rounded-full text-base transition hover:scale-105 hover:bg-black/55 ${
              voice.muted ? "text-amber-200/45" : "text-rose-200"
            }`}
          >
            {voice.muted ? "🔇" : "🗣"}
            {/* Chấm nhấp nháy khi cô ấy đang nói */}
            {voice.speaking && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185]" />
            )}
          </button>

          <button
            onClick={toggleMusic}
            aria-label={musicOn ? "Tắt nhạc" : "Bật nhạc"}
            className="glass-warm flex h-10 w-10 items-center justify-center rounded-full text-lg text-amber-200 transition hover:scale-105 hover:bg-black/55 hover:text-amber-100"
          >
            {musicOn ? "♪" : "✕"}
          </button>
        </div>
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
              {/* Huy hiệu trang trí có đường kẻ hai bên */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="mx-auto flex w-fit items-center gap-2.5 rounded-full border border-amber-200/40 bg-black/25 px-3.5 py-1 backdrop-blur-sm"
              >
                <span className="h-px w-6 bg-gradient-to-r from-transparent to-amber-200/80" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.34em] text-amber-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-[11px]">
                  Thung Lũng Hoàng Hôn · 30 / 11
                </span>
                <span className="h-px w-6 bg-gradient-to-l from-transparent to-amber-200/80" />
              </motion.div>

              {/* Tiêu đề: chữ gradient vàng-hồng + quầng sáng thở */}
              <div className="relative mt-1.5">
                <motion.div
                  aria-hidden
                  animate={{ opacity: [0.55, 1, 0.55], scale: [0.96, 1.04, 0.96] }}
                  transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                  className="pointer-events-none absolute inset-x-0 -top-2 mx-auto h-16 w-4/5 rounded-full bg-[radial-gradient(ellipse,rgba(255,214,120,0.38),transparent_70%)] blur-2xl"
                />
                {/* Chữ gradient + drop-shadow tĩnh. Việc animate `textShadow`
                    buộc trình duyệt vẽ lại toàn bộ glyph mỗi khung (rất đắt vì
                    chữ có gradient), nên nhịp "thở" được chuyển sang lớp quầng
                    sáng phía trên — chỉ đổi opacity. */}
                <h1 className="title-grad-warm relative text-balance text-[22px] font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                  {stage === "fireworks"
                    ? "Happy Birthday Phạm Hoàng Gia Trí!"
                    : "Chúc Mừng Sinh Nhật Gia Trí"}
                </h1>
              </div>
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
              {/* Bụi vàng lơ lửng bắt sáng nắng (chỉ vài hạt, rất nhẹ) */}
              {[12, 28, 46, 63, 78, 91].map((l, i) => (
                <span
                  key={l}
                  className="mote pointer-events-none absolute h-1 w-1 rounded-full bg-amber-100/90"
                  style={{
                    left: `${l}%`,
                    bottom: `${18 + (i % 3) * 12}%`,
                    boxShadow: "0 0 8px 2px rgba(255,232,170,0.65)",
                    animationDuration: `${9 + i * 1.7}s`,
                    animationDelay: `${i * 1.1}s`,
                  }}
                />
              ))}

              {/* ===== Linh vật sống động trong vườn ===== */}
              {/* Bướm bay lượn giữa các nhân vật (tránh vùng tiêu đề) */}
              <GardenButterfly left="30%" top="42%" size={19} delay={0.4} hue="#ffd66e" />
              <GardenButterfly left="64%" top="36%" size={14} delay={2.6} hue="#ffb3d1" />
              <GardenButterfly left="45%" top="52%" size={12} delay={4.1} hue="#c8e6ff" />

              {/* Mèo mun nằm ở góc cỏ trái (dưới chân cô hầu gái đọc sách) */}
              <GardenCat
                black
                left="1%"
                bottom="1.5%"
                height="clamp(46px, 6.6vh, 86px)"
                lookingUp={catLookUp}
                delay={0.2}
                className="hidden sm:block"
              />
              {/* Mèo trắng nép giữa 2 bàn, ngước nhìn bướm */}
              <GardenCat
                black={false}
                left="39%"
                bottom="2.5%"
                height="clamp(42px, 6vh, 80px)"
                flip
                lookingUp={!catLookUp}
                delay={1.4}
              />
              {/* Mèo mun nhỏ bên phải bàn dao */}
              <GardenCat
                black
                left="75.5%"
                bottom="3%"
                height="clamp(38px, 5.2vh, 68px)"
                flip
                delay={2.8}
                className="hidden lg:block"
              />

              {/* Chim sẻ nhảy nhót trên cỏ */}
              <GardenSparrow left="33%" bottom="1.5%" size={19} delay={0.8} />
              <GardenSparrow left="87%" bottom="2.5%" size={16} delay={3.2} flip />
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
                  {/* Hào quang ấm phía sau (tách nhân vật khỏi nền) */}
                  <div className="contain-paint pointer-events-none absolute inset-0 -z-10 scale-110 rounded-full bg-[radial-gradient(ellipse_at_50%_65%,rgba(255,214,150,0.2),transparent_66%)] blur-lg" />

                  {/* Chuyển động anime Live2D-style: thở đa nhịp + nghiêng theo gió + nhún vai */}
                  <div
                    style={{ transformOrigin: "bottom center" }}
                    className="maid-breathe will-transform relative"
                  >
                    {/* Ảnh hầu gái: KHÔNG animate filter/box-shadow ở đây.
                        Mỗi lần `filter` thay đổi, trình duyệt phải rasterize
                        lại toàn bộ ảnh 440×728 trên CPU. Thay vào đó nhịp thở
                        nằm ở lớp transform phía trên, còn ánh nắng ấm được
                        giả lập bằng một lớp overlay opacity (chỉ compositor). */}
                    <img
                      src={maidBook}
                      alt="Cô hầu gái ngồi đọc sách dưới gốc cây"
                      draggable={false}
                      className="h-[21vh] w-auto select-none object-contain drop-shadow-[0_14px_26px_rgba(0,0,0,0.55)] transition duration-300 group-hover:brightness-110 sm:h-[37vh] lg:h-[42vh]"
                    />
                    {/* Ánh nắng ấm lay động — chỉ đổi opacity nên miễn phí cho GPU */}
                    <motion.span
                      aria-hidden
                      animate={{ opacity: [0.05, 0.2, 0.05] }}
                      transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_62%_22%,rgba(255,226,160,0.85),transparent_58%)] mix-blend-soft-light"
                    />
                    {/* Lọn tóc mai lay động */}
                    <span
                      aria-hidden
                      className="hair-sway pointer-events-none absolute left-[10%] top-[10%] h-[38%] w-[16%]"
                      style={{
                        transformOrigin: "top right",
                        background:
                          "radial-gradient(ellipse at 30% 40%, rgba(28,22,20,0.55), rgba(28,22,20,0) 68%)",
                      }}
                    />
                    {/* Trang sách lật (vệt trắng quét rất nhẹ) */}
                    <motion.span
                      aria-hidden
                      animate={{ opacity: [0, 0.5, 0], x: [0, 3, 0] }}
                      transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.4 }}
                      className="pointer-events-none absolute left-[47%] top-[41%] h-[6%] w-[13%] rounded-sm bg-gradient-to-r from-white/0 via-white/55 to-white/0 blur-[1px]"
                    />
                  </div>
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

                {/* Hào quang hoàng hôn ấm áp phía sau nhân vật */}
                <div className="contain-paint pointer-events-none absolute inset-0 -z-10 rounded-full bg-[radial-gradient(ellipse_at_50%_58%,rgba(255,206,130,0.26),transparent_68%)] blur-xl" />

                {/* ===== Bong bóng thoại tiếng Nhật khi cô ấy nói ===== */}
                <AnimatePresence>
                  {voiceCaption && !voice.muted && (
                    <motion.div
                      key={voiceCaption}
                      initial={{ opacity: 0, y: 10, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 220, damping: 22 }}
                      className="pointer-events-none absolute bottom-[calc(100%-2%)] left-1/2 z-40 w-[min(78vw,300px)] -translate-x-1/2"
                    >
                      <div className="relative rounded-2xl border border-rose-200/55 bg-gradient-to-b from-[#fffaf4]/96 to-[#ffeef0]/94 px-3.5 py-2.5 text-center shadow-[0_10px_32px_rgba(0,0,0,0.4)] backdrop-blur-sm">
                        <div className="mb-1 flex items-center justify-center gap-1.5">
                          <span className="flex items-end gap-0.5" aria-hidden>
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="voice-wave w-[2px] rounded-full bg-rose-400"
                                style={{ height: 6, animationDelay: `${i * 0.15}s` }}
                              />
                            ))}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-rose-500/85">
                            Hầu gái nói
                          </span>
                        </div>
                        <p className="text-[13px] font-semibold leading-snug text-stone-800">{voiceCaption}</p>
                        <p className="mt-0.5 text-[10px] leading-snug text-stone-500">
                          {voiceCaption.startsWith("わぁ")
                            ? "“A, cắt giỏi quá! Đúng là chủ nhân của em.”"
                            : "“Chúc mừng sinh nhật, thưa chủ nhân!”"}
                        </p>
                        <span className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-rose-200/55 bg-[#ffeef0]" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Nút mời chạm khi trình duyệt chặn tự phát giọng */}
                <AnimatePresence>
                  {voice.needsGesture && !voice.muted && (
                    <motion.button
                      key="voice-unlock"
                      type="button"
                      onClick={() => maidVoice.say(stage === "fireworks" ? "cake" : "entry")}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute -top-11 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-200/70 bg-rose-50/95 px-3.5 py-1.5 text-[11px] font-bold text-rose-700 shadow-[0_6px_20px_rgba(0,0,0,0.3)] transition hover:scale-105"
                    >
                      🔈 Chạm để nghe hầu gái chúc mừng
                    </motion.button>
                  )}
                </AnimatePresence>

                <motion.div
                  animate={
                    // Khi cắt bánh xong: nhún lên xuống 2 nhịp reo vui (chạy 1 lần).
                    // Bình thường: KHÔNG animate bằng JS — nhịp thở do CSS
                    // `.maid-breathe-slow` lo, để main thread rảnh cho gameplay.
                    cakeCut
                      ? { y: [0, -14, 0, -8, 0], rotate: [-0.4, 1.6, -0.8, 1, -0.4], scaleY: [1, 1.02, 1, 1.012, 1] }
                      : {}
                  }
                  transition={cakeCut ? { duration: 1.5, repeat: 1, ease: "easeInOut" } : undefined}
                  style={{ transformOrigin: "bottom center" }}
                  className={`will-transform relative ${cakeCut ? "" : "maid-breathe-slow"}`}
                >
                  <img
                    src={maidCake}
                    alt="Cô hầu gái quỳ gối nâng bánh sinh nhật"
                    draggable={false}
                    className="h-[40vh] w-auto max-w-none select-none object-contain drop-shadow-[0_18px_36px_rgba(0,0,0,0.62)] sm:h-[56vh] lg:h-[61vh]"
                  />
                  {/* Tóc mai lay động theo gió hoàng hôn */}
                  <span
                    aria-hidden
                    className="hair-sway-slow pointer-events-none absolute left-[8%] top-[9%] h-[36%] w-[15%]"
                    style={{
                      transformOrigin: "top right",
                      background:
                        "radial-gradient(ellipse at 30% 40%, rgba(26,20,18,0.5), rgba(26,20,18,0) 68%)",
                    }}
                  />

                  {/* Hào quang nắng vàng hoàng hôn tỏa nhẹ từ sau bánh */}
                  <div className="contain-paint pointer-events-none absolute left-[6%] top-[22%] h-[30%] w-[36%] rounded-full bg-[radial-gradient(circle,rgba(255,228,150,0.36),transparent_70%)] blur-xl" />

                  {/* Đốm sáng phép thuật tụ quanh bánh kem (chỉ khi chưa cắt) */}
                  {!cakeCut && <CakeFireflies count={7} />}

                  {/* 3 Ngọn lửa nến mảnh & sáng dịu kiểu anime (không thô) */}
                  {CANDLE_POS.map((pos, idx) => (
                    // Ngọn nến: CSS thay cho animate liên tục. Mỗi ngọn có chu kỳ
                    // và độ trễ riêng để "rung" tự nhiên, không đồng bộ.
                    <span
                      key={idx}
                      style={{
                        left: pos.left,
                        top: pos.top,
                        animationDuration: `${0.85 + idx * 0.14}s`,
                        animationDelay: `${idx * -0.21}s`,
                      }}
                      className="flame-flick pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
                    >
                      <span className="block h-3 w-1.5 rounded-full bg-gradient-to-t from-amber-500 via-yellow-200 to-white shadow-[0_0_12px_3px_rgba(253,224,71,0.85)] sm:h-3.5 sm:w-1.5" />
                    </span>
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
                        className="btn-gold-shine whitespace-nowrap rounded-full border border-amber-100/70 bg-gradient-to-r from-amber-300 via-amber-200 to-rose-300 px-4 py-1.5 text-xs font-extrabold text-stone-900 shadow-[0_8px_28px_rgba(251,191,36,0.6)] transition hover:scale-105 active:scale-95"
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

            {/* Lớp sương ấm phía trước chân cảnh: tạo chiều sâu điện ảnh */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[9%] bg-[linear-gradient(to_top,rgba(14,26,20,0.5),rgba(14,26,20,0.16)_55%,transparent)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[13%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,206,140,0.2),transparent_72%)] blur-md" />
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

            {/* Tim bay lên & bokeh vàng phía sau hộp nhạc */}
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
              {Array.from({ length: 9 }).map((_, i) => (
                <span
                  key={`h-${i}`}
                  className="heart-rise absolute text-rose-300/80"
                  style={{
                    left: `${8 + i * 10.5}%`,
                    bottom: "22%",
                    fontSize: `${11 + (i % 3) * 6}px`,
                    animationDuration: `${7 + (i % 4) * 1.8}s`,
                    animationDelay: `${i * 0.9}s`,
                    textShadow: "0 0 12px rgba(255,150,190,0.85)",
                  }}
                >
                  {i % 3 === 0 ? "♥" : i % 3 === 1 ? "✦" : "♡"}
                </span>
              ))}
              {[18, 42, 66, 86].map((l, i) => (
                <motion.span
                  key={`b-${l}`}
                  className="absolute rounded-full bg-amber-200/70"
                  style={{ left: `${l}%`, bottom: `${30 + i * 9}%`, width: 3 + i, height: 3 + i }}
                  animate={{ opacity: [0.1, 0.7, 0.1], y: [0, -40, 0] }}
                  transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.7 }}
                />
              ))}
            </div>

            {/* Hộp nhạc quay chuyển động */}
            <div className="relative z-30 flex flex-col items-center">
              {/* Đế pha lê phát sáng dưới hộp nhạc */}
              <div
                aria-hidden
                className="contain-paint pointer-events-none absolute -bottom-3 left-1/2 h-10 w-[min(78vw,420px)] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(255,214,140,0.35),transparent_70%)] blur-xl"
              />
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
                className="group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-3xl border border-amber-200/40 bg-gradient-to-br from-[#3b2618]/92 via-[#281910]/95 to-[#1b110b]/97 p-4 shadow-[0_26px_70px_rgba(0,0,0,0.6),0_0_60px_rgba(255,190,90,0.14),inset_0_1px_0_rgba(255,225,170,0.35)] backdrop-blur-md transition duration-500 hover:scale-[1.025] hover:border-amber-200/70 sm:gap-6 sm:p-6"
              >
                <span className="pointer-events-none absolute inset-0 rounded-3xl bg-[linear-gradient(115deg,transparent_35%,rgba(255,235,190,0.14)_46%,transparent_58%)] bg-[length:220%_100%] btn-gold-shine" />
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
                    <span className="pointer-events-none absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.05)_40deg,transparent_90deg,transparent_180deg,rgba(255,255,255,0.04)_220deg,transparent_280deg)]" />
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
                      // Thanh sóng nhạc: dùng CSS thay vì animate `height` bằng JS.
                      // `height` gây layout mỗi khung hình (đắt nhất trong các
                      // thuộc tính animate); CSS keyframes trên thanh nhỏ thì
                      // chỉ tốn vài phần trăm một frame.
                      <span
                        key={i}
                        className={`w-2 rounded-t-full bg-gradient-to-t from-amber-400 to-rose-300 ${
                          musicOn ? "eq-bar" : ""
                        }`}
                        style={{
                          height: musicOn ? `${h * 100}%` : "20%",
                          animationDuration: `${0.7 + i * 0.12}s`,
                          animationDelay: `${i * 0.08}s`,
                          ["--eq-max" as string]: `${Math.round(h * 100)}%`,
                        }}
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
                    className="glass-warm rounded-full px-5 py-2 text-xs font-semibold text-amber-100 transition hover:scale-105 hover:text-white"
                  >
                    ✦ Quay lại khu vườn
                  </button>
                  <button
                    type="button"
                    onClick={onBackLobby}
                    className="btn-gold-shine rounded-full bg-gradient-to-r from-amber-300 via-amber-200 to-emerald-200 px-5 py-2 text-xs font-extrabold text-stone-900 shadow-[0_8px_28px_rgba(251,191,36,0.45)] transition hover:scale-105 active:scale-95"
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
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-b from-[#fffdf7] via-[#fff8e9] to-[#f7e7cb] p-6 text-stone-800 shadow-[0_28px_90px_rgba(0,0,0,0.55),0_0_80px_rgba(255,200,120,0.28)] sm:p-8"
            >
              {/* Viền chỉ vàng mảnh bên trong */}
              <div className="pointer-events-none absolute inset-2 rounded-[20px] border border-amber-600/20" />
              {/* Góc trang trí */}
              {[
                "left-3 top-3 border-l-2 border-t-2",
                "right-3 top-3 border-r-2 border-t-2",
                "left-3 bottom-3 border-l-2 border-b-2",
                "right-3 bottom-3 border-r-2 border-b-2",
              ].map((c) => (
                <span key={c} className={`pointer-events-none absolute h-4 w-4 rounded-sm border-amber-500/45 ${c}`} />
              ))}

              {/* Con dấu sáp đỏ */}
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: -8 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 12 }}
                className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-rose-600 to-rose-800 text-[10px] font-black text-rose-100 shadow-[0_6px_18px_rgba(150,20,40,0.45)] ring-2 ring-rose-300/40"
              >
                30·11
              </motion.div>

              <div className="relative text-xs font-bold uppercase tracking-[0.26em] text-rose-700/80">
                Thiệp Sinh Nhật · 30/11
              </div>
              <h2 className="relative mt-1 pr-14 text-xl font-black text-stone-900 sm:text-2xl">
                Gửi Phạm Hoàng Gia Trí,
              </h2>
              <div className="relative mt-3 h-px w-full bg-gradient-to-r from-amber-700/30 via-amber-600/15 to-transparent" />
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
              className="w-full max-w-sm overflow-hidden rounded-3xl border border-amber-200/45 bg-gradient-to-b from-[#1d2a24]/97 to-[#111a16]/98 p-4 text-center shadow-[0_28px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(255,200,120,0.16)]"
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
              <div className="mx-auto mt-3 h-px w-2/3 bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
              <div className="mt-2 text-sm font-bold text-amber-50">{zoomMemory.caption}</div>
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
