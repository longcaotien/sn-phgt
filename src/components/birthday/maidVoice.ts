/**
 * Giọng nói của cô hầu gái (tiếng Nhật, giọng anime dễ thương).
 *
 * Vì sao cần một module riêng thay vì nhét vào component:
 * - Trình duyệt chặn autoplay `Audio()` khi chưa có thao tác của người dùng.
 *   Ở đây ta xử lý "bị chặn" như một trạng thái bình thường (`needsGesture`)
 *   để UI hiện nút "chạm để nghe", chứ không im lặng thất bại.
 * - Cần **ducking**: tự hạ nhạc nền khi cô ấy nói để nghe rõ lời, rồi trả lại.
 * - File mp3 được nạp sẵn (preload) để câu đầu tiên phát ngay, không trễ.
 */

import entrySrc from "../../assets/voice/maid-entry.mp3";
import cakeSrc from "../../assets/voice/maid-cake.mp3";

export type VoiceLine = "entry" | "cake";

type VoiceState = {
  /** đang phát giọng */
  speaking: boolean;
  /** trình duyệt chặn — cần một cú chạm của người dùng */
  needsGesture: boolean;
  /** người dùng đã tắt tiếng hầu gái */
  muted: boolean;
};

const LINES: Record<VoiceLine, string> = {
  entry: entrySrc,
  cake: cakeSrc,
};

/** Âm lượng nhạc nền khi cô ấy đang nói (đủ nhỏ để nghe rõ lời). */
const DUCK_LEVEL = 0.15;

class MaidVoicePlayer {
  private els = new Map<VoiceLine, HTMLAudioElement>();
  private state: VoiceState = { speaking: false, needsGesture: false, muted: false };
  private listeners = new Set<(s: VoiceState) => void>();
  private ducked = false;
  /**
   * Cờ chặn `onEnded` khi ta CHỦ ĐỘNG dừng audio (vd: chuyển sang câu mới).
   * Không có cờ này, `el.pause()` sẽ kích hoạt listener "pause" => trả âm lượng
   * nhạc về 1 rồi hạ lại 0.15 ngay sau đó, gây nhấp nháy âm lượng.
   */
  private stoppingOnPurpose = false;

  /* --- cầu nối tới nhạc nền, tránh import vòng --- */
  private setMusicVolumeScale: ((scale: number) => void) | null = null;

  /** Component gọi một lần để nối vào nhạc nền (dùng cho ducking). */
  bindMusic(fn: (scale: number) => void) {
    this.setMusicVolumeScale = fn;
  }

  getState(): VoiceState {
    return this.state;
  }

  subscribe(cb: (s: VoiceState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit() {
    this.state = { ...this.state };
    this.listeners.forEach((cb) => {
      try {
        cb(this.state);
      } catch {
        /* listener lỗi không được làm hỏng luồng phát */
      }
    });
  }

  /** Nạp sẵn cả 2 file để câu đầu tiên không bị trễ. */
  preload() {
    if (typeof Audio === "undefined") return;
    (Object.keys(LINES) as VoiceLine[]).forEach((key) => {
      if (this.els.has(key)) return;
      const el = new Audio(LINES[key]);
      el.preload = "auto";
      el.volume = 0.95;
      el.addEventListener("ended", () => this.onEnded());
      el.addEventListener("pause", () => {
        if (!el.ended) this.onEnded();
      });
      this.els.set(key, el);
    });
  }

  private onEnded() {
    if (this.stoppingOnPurpose) return;
    if (!this.state.speaking) return;
    this.state.speaking = false;
    this.unduck();
    this.emit();
  }

  private duck() {
    if (this.ducked) return;
    this.ducked = true;
    this.setMusicVolumeScale?.(DUCK_LEVEL);
  }

  private unduck() {
    if (!this.ducked) return;
    this.ducked = false;
    this.setMusicVolumeScale?.(1);
  }

  setMuted(muted: boolean) {
    this.state.muted = muted;
    if (muted) this.stop();
    this.emit();
  }

  toggleMuted() {
    this.setMuted(!this.state.muted);
  }

  stop() {
    this.stoppingOnPurpose = true;
    this.els.forEach((el) => {
      el.pause();
      el.currentTime = 0;
    });
    this.stoppingOnPurpose = false;
    this.onEnded();
  }

  /**
   * Phát một câu thoại.
   * Trả về `true` nếu phát được, `false` nếu bị chặn vì chưa có thao tác.
   */
  async say(line: VoiceLine): Promise<boolean> {
    if (this.state.muted) return false;
    this.preload();

    // Dừng câu đang phát để không chồng tiếng.
    // Bọc trong cờ để các listener "pause" không tưởng là câu vừa nói xong.
    this.stoppingOnPurpose = true;
    this.els.forEach((el) => {
      if (!el.paused) {
        el.pause();
        el.currentTime = 0;
      }
    });
    this.stoppingOnPurpose = false;

    const el = this.els.get(line);
    if (!el) return false;

    try {
      el.currentTime = 0;
      await el.play();
      this.state.speaking = true;
      this.state.needsGesture = false;
      this.duck();
      this.emit();
      return true;
    } catch {
      // Bị chặn autoplay: ghi nhận để UI mời người dùng chạm.
      this.state.needsGesture = true;
      this.state.speaking = false;
      this.emit();
      return false;
    }
  }

  /** Gọi từ một sự kiện chạm/click để mở khoá âm thanh. */
  async unlockAndPlay(line: VoiceLine): Promise<boolean> {
    return this.say(line);
  }
}

export const maidVoice = new MaidVoicePlayer();
