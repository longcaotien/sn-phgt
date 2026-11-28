import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import RainCanvas from "./RainCanvas";
import Countdown from "./Countdown";
import PortalGateCard, { GoldenKeyIcon } from "./PortalGate";
import jinwoo from "../assets/jinwoo.webp";
import bg from "../assets/bg.webp";
import natureBg from "../assets/birthday-scene-bg.webp";
import { bossIdle } from "./chapter2/assets";
import { sanctuaryMusic } from "./sanctuaryMusic";

const STATS = [
  { k: "SỨC MẠNH", v: 96 },
  { k: "TỐC ĐỘ", v: 88 },
  { k: "TRÍ TUỆ", v: 92 },
  { k: "THỂ LỰC", v: 85 },
  { k: "CẢM NHẬN", v: 100 },
];

export default function Hero({
  hasKey = false,
  onNext,
  onOpenGate,
}: {
  hasKey?: boolean;
  onNext?: () => void;
  onOpenGate?: () => void;
}) {
  // ---- Parallax theo chuột / cảm ứng ----
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 50, damping: 18 });
  const sy = useSpring(my, { stiffness: 50, damping: 18 });
  const charX = useTransform(sx, (v) => v * -22);
  const charY = useTransform(sy, (v) => v * -14);
  const bgX = useTransform(sx, (v) => v * 18);
  const bgY = useTransform(sy, (v) => v * 10);
  const fgX = useTransform(sx, (v) => v * -44);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [mx, my]);

  // ---- Sét ngẫu nhiên ----
  const [bolt, setBolt] = useState(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBolt((b) => b + 1);
        loop();
      }, 4500 + Math.random() * 6000);
    };
    t = setTimeout(() => setBolt(1), 900);
    loop();
    return () => clearTimeout(t);
  }, []);

  // ---- Nhạc nền sảnh ----
  // Trình duyệt chặn tự phát trước tương tác đầu tiên, nên "mồi" một lần rồi
  // để người dùng bật/tắt bằng nút nhỏ ở góc.
  const [musicOn, setMusicOn] = useState(false);
  const [musicKnown, setMusicKnown] = useState(false);
  useEffect(() => {
    sanctuaryMusic.setMuted(false);
    const off = sanctuaryMusic.onChange((p) => {
      setMusicOn(p);
      setMusicKnown(true);
    });
    sanctuaryMusic.arm();
    return () => {
      off();
      sanctuaryMusic.pause();
    };
  }, []);

  // ---- ARISE ----
  const [arise, setArise] = useState(false);
  const [done, setDone] = useState(false);
  const [lockedShake, setLockedShake] = useState(0);
  const [lockNotice, setLockNotice] = useState(false);
  const [openingGate, setOpeningGate] = useState(false);
  const soldiers = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => {
        const a = (i / 46) * Math.PI * 2 + Math.random() * 0.3;
        const d = 180 + Math.random() * 520;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: 0.4 + Math.random() * 1.2, dl: Math.random() * 0.3 };
      }),
    []
  );
  const triggerArise = () => {
    if (arise || openingGate) return;
    setArise(true);
    setBolt((b) => b + 1);
    setTimeout(() => {
      setArise(false);
      setDone(true);
      onNext?.();
    }, 3200);
  };

  const handlePortalClick = () => {
    if (arise || openingGate) return;
    if (!hasKey) {
      setLockedShake((s) => s + 1);
      setLockNotice(true);
      setTimeout(() => setLockNotice(false), 2600);
      return;
    }
    setOpeningGate(true);
    setTimeout(() => {
      onOpenGate?.();
    }, 2400);
  };

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.16, delayChildren: 0.5 } },
  };
  const item = {
    hidden: { opacity: 0, y: 28, filter: "blur(8px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] as const } },
  };

  return (
    <motion.main
      className="relative h-full w-full overflow-hidden bg-[#02030a]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2 }}
    >
      {/* Nền cổng dungeon */}
      <motion.div className="absolute -inset-10" style={{ x: bgX, y: bgY }}>
        <img
          src={bg}
          alt=""
          className="h-full w-full scale-110 object-cover opacity-50"
          style={{ animation: "breathe 16s ease-in-out infinite" }}
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#02030a] via-[#02030a]/70 to-transparent max-lg:via-[#02030a]/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(79,100,255,0.25),transparent_60%)]" />
      <div className="aurora pointer-events-none absolute -left-[18%] top-[-10%] h-[78vh] w-[78vh] rounded-full bg-[radial-gradient(circle,rgba(96,60,255,0.32),transparent_62%)] blur-3xl" />
      <div
        className="aurora pointer-events-none absolute -right-[12%] bottom-[-22%] h-[70vh] w-[70vh] rounded-full bg-[radial-gradient(circle,rgba(40,150,255,0.26),transparent_64%)] blur-3xl"
        style={{ animationDelay: "-6s" }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />

      {/* Nhân vật */}
      <div className="pointer-events-none absolute top-0 h-[100svh] aspect-[2/3] right-[3vw] max-lg:left-1/2 max-lg:right-auto max-lg:-translate-x-1/2">
        <motion.div
          className="relative h-full w-full"
          style={{ x: charX, y: charY }}
          initial={{ opacity: 0, scale: 1.18, filter: "brightness(0) blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "brightness(1) blur(0px)" }}
          transition={{ duration: 2.2, ease: [0.2, 0.7, 0.2, 1], delay: 0.1 }}
        >
          <div className="breathe relative h-full w-full origin-[58%_30%]">
            <img
              src={jinwoo}
              alt="Sung Jin Woo"
              className="h-full w-full select-none object-cover"
              draggable={false}
              style={{
                WebkitMaskImage:
                  "linear-gradient(to right, transparent 0%, #000 22%, #000 82%, transparent 100%), linear-gradient(to bottom, #000 70%, transparent 100%)",
                WebkitMaskComposite: "source-in",
                maskImage:
                  "linear-gradient(to right, transparent 0%, #000 22%, #000 82%, transparent 100%), linear-gradient(to bottom, #000 70%, transparent 100%)",
                maskComposite: "intersect",
              }}
            />
            {/* mắt xanh phát sáng */}
            <div
              className="eye-glow absolute rounded-full mix-blend-screen"
              style={{
                left: "58%",
                top: "24.2%",
                width: "17%",
                height: "11%",
                background:
                  "radial-gradient(ellipse, rgba(150,200,255,0.95) 0%, rgba(70,110,255,0.6) 30%, rgba(60,80,255,0) 70%)",
                filter: "blur(4px)",
              }}
            />
            {/* mắt bóng đen phía sau */}
            {[55, 67].map((l, i) => (
              <div
                key={l}
                className="eye-glow absolute rounded-full mix-blend-screen"
                style={{
                  left: `${l}%`,
                  top: "6.8%",
                  width: "12%",
                  height: "6%",
                  background: "radial-gradient(ellipse, rgba(180,120,255,0.9), rgba(120,60,255,0) 70%)",
                  filter: "blur(6px)",
                  animationDelay: `${i * 0.3}s`,
                }}
              />
            ))}
            {/* hào quang tím dâng lên từ chân */}
            <div className="mist absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-violet-700/40 via-indigo-600/10 to-transparent blur-xl" />
          </div>
        </motion.div>
      </div>

      {/* Sương mù trôi */}
      <div className="mist pointer-events-none absolute -inset-x-20 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_center,rgba(120,140,255,0.18),transparent_65%)]" />

      {/* Mưa + tàn lửa */}
      <motion.div className="absolute inset-0" style={{ x: fgX }}>
        <RainCanvas />
      </motion.div>

      {/* Sét */}
      <div key={bolt} className={`pointer-events-none absolute inset-0 bg-sky-200/50 mix-blend-screen opacity-0 ${bolt ? "lightning" : ""}`} />

      {/* Vignette + scanline */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_180px_rgba(0,0,0,0.95)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 3px)" }}
      />

      {/* Khung HUD 4 góc */}
      <div className="pointer-events-none absolute inset-3 z-20 hidden sm:block">
        {[
          "left-0 top-0 border-l border-t",
          "right-0 top-0 border-r border-t",
          "left-0 bottom-0 border-l border-b",
          "right-0 bottom-0 border-r border-b",
        ].map((cls) => (
          <span key={cls} className={`absolute h-7 w-7 border-sky-400/40 ${cls}`} />
        ))}
      </div>

      {/* teaser chương II */}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 2.6, duration: 1 }}
        className="pointer-events-none absolute bottom-5 right-5 z-20 hidden w-44 xl:block"
      >
        <div className="sys-panel-danger sys-cut p-1">
          <div className="relative overflow-hidden">
            <img
              src={bossIdle}
              alt=""
              className="h-24 w-full object-cover object-[50%_28%] opacity-75 transition-transform duration-1000 hover:scale-110"
              style={{ mixBlendMode: "screen", filter: "saturate(.75) contrast(1.08)" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0308] via-[#0a0308]/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-2">
              <div className="font-sys text-[7px] tracking-[0.3em] text-red-300/90">CHƯƠNG II · BOSS ẨN</div>
              <div className="mt-0.5 font-sys text-[9px] font-black tracking-[0.1em] text-white">TƯỢNG THẦN MỈM CƯỜI</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Thanh trên */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-5 py-4 font-sys text-[10px] tracking-[0.3em] text-sky-300/80 sm:px-10"
      >
        <span className="text-glow">◆ SOLO LEVELING</span>
        <span className="hidden sm:inline">RANK: S · NHÀ SĂN BÓNG TỐI</span>
        <span>30·11</span>
      </motion.div>

      {/* Nội dung */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-20 flex h-full flex-col justify-end px-5 pb-8 sm:px-10 lg:w-[58%] lg:justify-center lg:pb-0 lg:pl-16"
      >
        <motion.div variants={item} className="mb-3 flex items-center gap-3">
          <span className="h-px w-10 border-run" />
          <span className="font-sys text-[10px] tracking-[0.4em] text-sky-300 text-glow sm:text-xs">
            [ THÔNG BÁO HỆ THỐNG ]
          </span>
        </motion.div>

        <motion.h2 variants={item} className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-100/80 sm:text-base">
          Chúc mừng sinh nhật
        </motion.h2>

        <motion.h1 variants={item} className="relative mt-1 leading-[0.95]">
          <span className="title-grad relative block text-[2.6rem] font-black uppercase sm:text-6xl lg:text-7xl xl:text-8xl">
            Gia Trí
            <span aria-hidden className="glitch-a absolute inset-0">Gia Trí</span>
            <span aria-hidden className="glitch-b absolute inset-0">Gia Trí</span>
          </span>
          <span className="mt-2 block text-sm font-light uppercase tracking-[0.3em] text-violet-300 text-glow-purple sm:text-lg">
            Phạm Hoàng Gia Trí
          </span>
        </motion.h1>

        <motion.p variants={item} className="mt-4 max-w-md text-sm leading-relaxed text-sky-100/75 sm:text-base">
          Mỗi năm một cấp độ mới. Hôm nay, <b className="text-white">Người Chơi</b> bước sang{" "}
          <b className="font-sys text-sky-300 text-glow">LEVEL UP</b> – chúc bạn thức tỉnh sức mạnh, vượt qua mọi
          dungeon và luôn tỏa sáng giữa bóng tối.
        </motion.p>

        {/* Bảng chỉ số */}
        <motion.div variants={item} className="sys-panel sys-cut relative mt-5 hidden max-w-md overflow-hidden p-4 sm:block">
          <div className="frame-sweep absolute inset-x-0 top-0 h-px" />
          <div className="mb-3 flex items-center justify-between font-sys text-[10px] tracking-[0.3em] text-sky-300">
            <span>CHỈ SỐ NGƯỜI CHƠI</span>
            <span className="text-violet-300">LV. MAX+1</span>
          </div>
          <div className="space-y-2">
            {STATS.map((s, i) => (
              <div key={s.k} className="flex items-center gap-3 text-[11px]">
                <span className="w-20 font-sys tracking-wider text-sky-100/80">{s.k}</span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-sky-950">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500 shadow-[0_0_10px_#4fa8ff]"
                    initial={{ width: 0 }}
                    animate={{ width: `${s.v}%` }}
                    transition={{ delay: 1.6 + i * 0.15, duration: 1.4, ease: "easeOut" }}
                  />
                </div>
                <span className="w-8 text-right font-sys text-sky-200">{s.v}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={item} className="mt-5">
          <Countdown />
        </motion.div>

        <motion.div variants={item} className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={triggerArise}
            className="group relative overflow-hidden border border-violet-400/70 bg-violet-950/50 px-7 py-3 font-sys text-sm font-bold tracking-[0.4em] text-white transition hover:scale-105 hover:bg-violet-800/50 hover:shadow-[0_0_40px_rgba(139,61,255,0.8)] active:scale-95"
          >
            <span className="relative z-10 text-glow-purple">ARISE</span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-violet-300/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </button>

          <PortalGateCard hasKey={hasKey} onClick={handlePortalClick} lockedShake={lockedShake} />
        </motion.div>

        <AnimatePresence>
          {lockNotice && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 font-sys text-[9px] tracking-[0.18em] text-amber-300"
            >
              🔒 CỔNG ĐANG PHONG ẤN · HÃY HẠ BOSS CHƯƠNG II ĐỂ NHẬN CHÌA KHÓA!
            </motion.div>
          )}
          {done && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mt-2 font-sys text-[10px] leading-5 tracking-[0.2em] text-sky-300"
            >
              ✔ ĐÃ TRIỆU HỒI BÓNG TỐI · Chương tiếp theo đang tải...
            </motion.span>
          )}
        </AnimatePresence>

        <motion.div variants={item} className="mt-4 flex items-center gap-2 overflow-hidden sm:gap-3">
          <span className="h-px w-5 shrink-0 bg-sky-500/60 sm:w-6" />
          <span className="truncate font-sys text-[8px] tracking-[0.18em] text-sky-300/65 sm:text-[9px] sm:tracking-[0.28em]">
            CHƯƠNG II · HỒNG NGỤC · 3 TƯỢNG THẦN
          </span>
          <span className="flex shrink-0 items-center gap-1 border border-red-500/40 bg-red-950/30 px-1.5 py-0.5 font-sys text-[7px] tracking-[0.18em] text-red-300">
            <span className="h-1 w-1 animate-pulse rounded-full bg-red-500" />
            BOSS ẨN
          </span>
        </motion.div>
      </motion.section>

      {/* Cutscene Tra Chìa Khóa Mở Cánh Cổng 30/11 */}
      <AnimatePresence>
        {openingGate && (
          <motion.div
            key="gate-cutscene"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#040710]/95"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          >
            {/* Thế giới thiên nhiên rực sáng ẩn sau cánh cổng */}
            <motion.img
              src={natureBg}
              alt=""
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1.03, opacity: 1 }}
              transition={{ delay: 0.9, duration: 1.4, ease: "easeOut" }}
              className="absolute inset-0 h-full w-full object-cover"
            />

            {/* Khung Cổng Vòm lớn với 2 cánh trượt mở ra 2 bên */}
            <div className="relative z-10 flex h-80 w-64 overflow-hidden rounded-t-full border-4 border-amber-300/80 shadow-[0_0_80px_rgba(251,191,36,0.65)] sm:h-96 sm:w-80">
              {/* Cánh trái */}
              <motion.div
                initial={{ x: "0%" }}
                animate={{ x: "-100%" }}
                transition={{ delay: 1.05, duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
                className="h-full w-1/2 border-r border-amber-300/50 bg-gradient-to-br from-[#172033] via-[#0b101d] to-[#050811]"
              />
              {/* Cánh phải */}
              <motion.div
                initial={{ x: "0%" }}
                animate={{ x: "100%" }}
                transition={{ delay: 1.05, duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
                className="h-full w-1/2 border-l border-amber-300/50 bg-gradient-to-bl from-[#172033] via-[#0b101d] to-[#050811]"
              />

              {/* Chìa khóa bay vào ổ khóa & xoay sáng */}
              <motion.div
                initial={{ y: 90, scale: 1.6, opacity: 0, rotate: -30 }}
                animate={{
                  y: [90, 0, 0],
                  scale: [1.5, 1.15, 0.2],
                  opacity: [0, 1, 0],
                  rotate: [-30, 0, 90],
                }}
                transition={{ duration: 1.15, times: [0, 0.55, 1], ease: "easeInOut" }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-400/20 shadow-[0_0_40px_#fcd34d]">
                  <GoldenKeyIcon className="h-12 w-12" />
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
              className="relative z-10 mt-6 text-center"
            >
              <div className="font-sys text-xs tracking-[0.35em] text-amber-200 drop-shadow">
                ĐANG MỞ CÁNH CỔNG 30/11…
              </div>
              <div className="mt-1 text-sm text-amber-100/85 drop-shadow">
                Bước vào Thế Giới Sinh Nhật Phạm Hoàng Gia Trí
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hiệu ứng ARISE toàn màn hình */}
      <AnimatePresence>
        {arise && (
          <motion.div
            key="arise"
            className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="absolute inset-0 bg-[radial-gradient(circle,rgba(110,40,220,0.75),rgba(5,0,20,0.96)_70%)]"
              initial={{ scale: 0.4 }}
              animate={{ scale: 1.4 }}
              transition={{ duration: 3, ease: "easeOut" }}
            />
            {soldiers.map((p, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full bg-violet-400"
                style={{ width: 6 * p.s, height: 6 * p.s, boxShadow: "0 0 18px 6px rgba(168,85,255,0.9)" }}
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{ x: p.x, y: p.y, opacity: [0, 1, 0] }}
                transition={{ duration: 2.4, delay: p.dl, ease: "easeOut" }}
              />
            ))}
            <motion.div
              className="relative text-center"
              initial={{ scale: 3, opacity: 0, filter: "blur(20px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.9, ease: [0.2, 0.9, 0.2, 1] }}
            >
              <div className="font-sys text-5xl font-black tracking-[0.3em] text-white text-glow-purple sm:text-8xl">
                ARISE
              </div>
              <motion.div
                className="mt-4 text-sm tracking-[0.4em] text-violet-200 sm:text-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                CHÚC MỪNG SINH NHẬT GIA TRÍ
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bật/tắt nhạc nền sảnh. Ẩn cho tới khi biết trạng thái thật để
          không hiện nút trong tích tắc rồi biến mất. */}
      {musicKnown && (
        <button
          onClick={() => sanctuaryMusic.toggle()}
          title={musicOn ? "Tắt nhạc nền" : "Bật nhạc nền"}
          aria-label={musicOn ? "Tắt nhạc nền" : "Bật nhạc nền"}
          className={`fixed right-3 top-3 z-40 flex h-8 items-center gap-1.5 border px-2.5 font-sys text-[8px] tracking-[0.18em] backdrop-blur-md transition ${
            musicOn
              ? "border-sky-400/45 bg-[#05101f]/80 text-sky-200/90 hover:border-sky-300 hover:text-sky-100"
              : "border-white/15 bg-[#05101f]/70 text-sky-200/45 hover:text-sky-200/80"
          }`}
        >
          <span className="text-[11px] leading-none">{musicOn ? "♪" : "♪̸"}</span>
          <span>{musicOn ? "NHẠC" : "TẮT"}</span>
        </button>
      )}
    </motion.main>
  );
}
