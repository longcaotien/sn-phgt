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


/* ------------------------------------------------------------------ */
/*  Bộ điều tiết chất lượng thích ứng (adaptive quality governor)      */
/* ------------------------------------------------------------------ */

/**
 * Vì sao cần: `lowEnd` chỉ đo MỘT LẦN lúc tải trang bằng hardwareConcurrency
 * và deviceMemory. Nhưng máy có thể yếu vì lý do khác (GPU tích hợp yếu, đang
 * chạy tác vụ nặng, màn hình 4K, pin yếu → CPU bị hạ xung). Khi đó site vẫn
 * tưởng là máy khoẻ và chạy hiệu ứng nặng => lag.
 *
 * Bộ điều tiết này đo thời gian khung hình thật rồi tự hạ cấp dần:
 *   2 = đầy đủ   → mọi hiệu ứng
 *   1 = vừa      → giảm hạt, bỏ blur trang trí, canvas 45fps
 *   0 = tối thiểu → tắt hiệu ứng trang trí, canvas 30fps, ít hạt nhất
 *
 * Chỉ hạ, không tự nâng lại (tránh nhấp nháy lên xuống gây giật).
 */
export type Quality = 0 | 1 | 2;

let quality: Quality = reduceMotion ? 0 : lowEnd ? 1 : 2;

const qualityListeners = new Set<(q: Quality) => void>();

export function getQuality(): Quality {
  return quality;
}

/** Đăng ký nhận thông báo khi mức chất lượng bị hạ. Trả về hàm huỷ. */
export function onQualityChange(cb: (q: Quality) => void): () => void {
  qualityListeners.add(cb);
  return () => qualityListeners.delete(cb);
}

/** Hệ số mật độ hạt theo mức chất lượng hiện tại. */
export function qualityScale(): number {
  return quality === 2 ? 1 : quality === 1 ? 0.55 : 0.3;
}

/** Số khung hình mỗi giây mục tiêu cho canvas nền. */
export function targetFps(): number {
  return quality === 2 ? 45 : quality === 1 ? 30 : 24;
}

/* --- Đo khung hình: dùng chung một nguồn, không tạo timer riêng --- */

let probeFrames = 0;
let probeTime = 0;
/**
 * Mốc thời gian trước đó thì không đo: lúc mới tải còn giật do parse JS /
 * giải mã ảnh, và sau mỗi lần hạ cấp cần chờ hiệu ứng mới phát huy tác dụng.
 * Dùng mốc thời gian tuyệt đối (ms) thay vì đếm frame để đúng trên mọi FPS.
 */
let warmupUntil = 0;
let started = false;
let probePaused = false;
/**
 * Cửa sổ trượt ghi FPS của ~4 giây gần nhất (mỗi phần tử là một cửa sổ 1,6 s).
 * Dùng nhiều mẫu thay vì một mẫu đơn để không hạ cấp oan khi FPS chỉ dao động
 * xen kẽ (rất hay gặp: 1 giây giật do GC, 1 giây mượt).
 */
const fpsWindow: number[] = [];
const FPS_WINDOW_SIZE = 3;

/**
 * Cho canvas gọi mỗi frame để báo "tôi vừa vẽ xong một khung".
 *
 * Chính sách hạ cấp (cố tình "kiên nhẫn" để không hạ oan):
 *  - Cần **2 cửa sổ đo liên tiếp** (~3,2 giây) đều dưới 40fps mới hạ 1 bậc.
 *  - Sau khi hạ, bỏ qua ~1,5 giây để hiệu ứng mới kịp phát huy tác dụng
 *    rồi mới đo lại — tránh việc hạ liên tiếp 2 bậc chỉ vì hiệu ứng cũ
 *    chưa kịp tắt.
 *  - Chỉ hạ, không tự nâng lại (nâng lại dễ gây nhấp nháy lên xuống).
 */
export function reportFrame(now: number) {
  if (probePaused) return;
  if (!started) {
    started = true;
    // Chờ 1,8 giây đầu cho trang ổn định rồi mới bắt đầu đo.
    warmupUntil = now + 1800;
    probeTime = now;
    return;
  }
  if (now < warmupUntil) {
    probeTime = now;
    probeFrames = 0;
    return;
  }
  probeFrames++;
  const elapsed = now - probeTime;
  // Đo trong cửa sổ ~1,6 giây
  if (elapsed < 1600) return;

  const fps = (probeFrames * 1000) / elapsed;
  probeFrames = 0;
  probeTime = now;

  // Ghi vào cửa sổ trượt
  fpsWindow.push(fps);
  if (fpsWindow.length > FPS_WINDOW_SIZE) fpsWindow.shift();

  // Chỉ quyết định khi đã có đủ mẫu
  if (fpsWindow.length < FPS_WINDOW_SIZE || quality === 0) return;

  const avg = fpsWindow.reduce((a, b) => a + b, 0) / fpsWindow.length;

  // Hạ xuống mức 1 (vừa): đủ khi mọi mẫu đều dưới 40fps, hoặc trung bình < 34.
  // Hạ xuống mức 0 (tối thiểu): phải TỆ HẲN (trung bình < 26) — vì mức này
  // tắt gần hết hiệu ứng trang trí, không nên áp cho máy chỉ hơi yếu.
  const allBad = fpsWindow.every((f) => f < 40);
  const clearlyBad = avg < 34;
  const reallyBad = avg < 26;

  const shouldDrop = quality === 2 ? allBad || clearlyBad : reallyBad;
  if (!shouldDrop) return;

  // Hạ đúng 1 bậc, rồi tạm nghỉ đo để hiệu ứng mới kịp có tác dụng.
  quality = (quality - 1) as Quality;
  fpsWindow.length = 0;
  // Nghỉ đo 2,5 GIÂY (mốc thời gian tuyệt đối, không đếm frame).
  // Đếm frame sẽ sai trên máy yếu: 90 frame ở 20fps chỉ là 4,5 giây nhưng
  // ở 60fps lại là 1,5 giây — trong khi ta cần một khoảng thời gian cố định.
  warmupUntil = now + 2500;
  qualityListeners.forEach((cb) => {
    try {
      cb(quality);
    } catch {
      /* listener lỗi không được làm chết vòng lặp */
    }
  });
}

/**
 * Tạm dừng đo (dùng khi chuyển cảnh / mở modal nặng) để không hạ cấp oan.
 */
export function pauseFrameProbe(ms = 1500) {
  probePaused = true;
  probeFrames = 0;
  if (typeof window !== "undefined") {
    window.setTimeout(() => {
      probePaused = false;
      probeTime = performance.now();
    }, ms);
  }
}

/**
 * Có nên chạy hiệu ứng trang trí nặng (blur lớn, hạt bay, filter) không.
 * Tôn trọng cả `prefers-reduced-motion`.
 */
export function richMotion(): boolean {
  return !reduceMotion && quality >= 2;
}

/** Có nên chạy hiệu ứng ở mức trung bình (hạt bay nhẹ, đom đóm...). */
export function someMotion(): boolean {
  return !reduceMotion && quality >= 1;
}
