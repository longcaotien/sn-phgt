/**
 * Trung tâm điều phối hiệu năng của toàn site.
 *
 * Mục tiêu: giữ animation 60fps trên máy khoẻ nhưng KHÔNG làm treo máy yếu
 * (điện thoại tầm trung, laptop cũ, trình duyệt trong webview...).
 *
 * - `lowEnd`: phát hiện máy yếu / người dùng bật "giảm chuyển động".
 * - `getMaxDpr()`: giới hạn độ phân giải canvas (nguồn tốn GPU lớn nhất).
 * - `createFrameLoop()`: MỘT vòng lặp requestAnimationFrame dùng chung cho
 *   mọi canvas/animation JS, được tạm dừng khi tab bị ẩn.
 * - `onVisibility()` / `isHidden()`: tiện ích cho các component khác.
 */

type FrameTask = (now: number, dt: number) => void;

const reduceMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const nav = typeof navigator !== "undefined" ? navigator : undefined;
const cores = nav?.hardwareConcurrency ?? 4;
const memoryGb = (nav as (Navigator & { deviceMemory?: number }) | undefined)?.deviceMemory ?? 4;
const coarsePointer =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

/** Máy yếu: ít nhân CPU, ít RAM, hoặc người dùng yêu cầu giảm chuyển động. */
export const lowEnd = reduceMotion || cores <= 4 || memoryGb <= 3;
export const reduceMotionEnabled = reduceMotion;
export const isTouchDevice = coarsePointer;

/** Hệ số mật độ hạt (0.45 – 1) để giảm số lượng particle trên máy yếu/điện thoại. */
export const particleScale = reduceMotion ? 0.25 : lowEnd ? 0.5 : coarsePointer ? 0.7 : 1;

const MAX_DPR = reduceMotion ? 1 : lowEnd ? 1 : coarsePointer ? 1.25 : 1.75;

export function getMaxDpr(): number {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.max(1, Math.min(dpr, MAX_DPR));
}

export function isHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

/** Theo dõi khi tab quay lại foreground (để reset timestamp, tránh nhảy animation). */
export function onVisibility(cb: (visible: boolean) => void): () => void {
  const handler = () => cb(document.visibilityState !== "hidden");
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}

/* ------------------------------------------------------------------ */
/*  Shared RAF loop                                                    */
/* ------------------------------------------------------------------ */

const tasks = new Set<FrameTask>();
let rafId = 0;
let lastTime = 0;
let running = false;

function tick(now: number) {
  if (isHidden()) {
    // Tab bị ẩn: dừng hẳn vòng lặp, chờ visibilitychange để khởi động lại.
    running = false;
    rafId = 0;
    return;
  }
  // dt kẹp trong [0, 50ms] để tránh "nhảy" sau khi tab bị treo.
  const dt = lastTime ? Math.min(0.05, Math.max(0, (now - lastTime) / 1000)) : 1 / 60;
  lastTime = now;
  for (const task of tasks) {
    try {
      task(now, dt);
    } catch {
      // Một task lỗi không được làm chết cả vòng lặp.
    }
  }
  rafId = requestAnimationFrame(tick);
}

function ensureRunning() {
  if (running || tasks.size === 0) return;
  running = true;
  lastTime = 0;
  rafId = requestAnimationFrame(tick);
}

function stopIfIdle() {
  if (tasks.size > 0 || !running) return;
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") ensureRunning();
  });
}

/**
 * Đăng ký một task chạy mỗi frame. Trả về hàm huỷ.
 * Tất cả canvas dùng chung một vòng lặp => ít overhead hơn N vòng lặp riêng.
 */
export function createFrameLoop(task: FrameTask): () => void {
  tasks.add(task);
  ensureRunning();
  return () => {
    tasks.delete(task);
    stopIfIdle();
  };
}
