/**
 * Nhạc nền SẢNH CHÍNH (màn hình mở đầu).
 *
 * Cách dùng: đặt file vào `public/music/sanctuary.mp3`, không cần sửa code.
 * Nếu file không có, phát một đoạn pad tổng hợp bằng Web Audio để sảnh không
 * im lặng như tờ.
 *
 * Vì sao phải chờ người dùng bấm: mọi trình duyệt đều chặn tự phát âm thanh
 * trước tương tác đầu tiên. Ta "mồi" bằng pointerdown/keydown một lần.
 */

type Listener = (playing: boolean) => void;

const SANCTUARY_SRC = "music/sanctuary.mp3";

/** Hợp âm nền cho bản tổng hợp — La thứ 9, không khí tĩnh lặng của sảnh. */
const PAD_CHORDS: number[][] = [
  [220.0, 261.63, 329.63, 415.3], // Am(add9)
  [174.61, 220.0, 261.63, 349.23], // Fmaj7
  [196.0, 246.94, 293.66, 392.0], // G
  [164.81, 196.0, 246.94, 329.63], // Em7
];

class SanctuaryMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private synthTimer: number | null = null;
  private chordIndex = 0;
  private playing = false;
  private armed = false;
  private listeners = new Set<Listener>();
  private muted = false;

  private static readonly VOLUME = 0.34;

  onChange(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit() {
    for (const l of this.listeners) l(this.playing);
  }

  isPlaying() {
    return this.playing;
  }

  isMuted() {
    return this.muted;
  }

  /** Gắn "mồi" tương tác đầu tiên để có quyền phát âm thanh. */
  arm() {
    if (this.armed) return;
    this.armed = true;
    const kick = () => {
      void this.start();
    };
    window.addEventListener("pointerdown", kick, { once: true, passive: true });
    window.addEventListener("keydown", kick, { once: true });
  }

  private ensureContext() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : SanctuaryMusic.VOLUME;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  async start() {
    if (this.playing) return;
    this.playing = true;

    if (!this.audioEl) {
      const base = import.meta.env.BASE_URL ?? "/";
      const el = new Audio(`${base}${SANCTUARY_SRC}`);
      el.loop = true;
      el.volume = this.muted ? 0 : SanctuaryMusic.VOLUME;
      el.preload = "auto";
      this.audioEl = el;
    }

    try {
      await this.audioEl.play();
      this.emit();
      return;
    } catch {
      // Không có file, hoặc bị chặn => chuyển sang nhạc tổng hợp.
    }

    this.ensureContext();
    if (!this.ctx) return;
    this.scheduleChord();
    this.emit();
  }

  private scheduleChord() {
    if (!this.ctx || !this.master || !this.playing) return;
    const chord = PAD_CHORDS[this.chordIndex % PAD_CHORDS.length];
    this.chordIndex++;

    const now = this.ctx.currentTime;
    const DUR = 7.5;
    for (const freq of chord) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1200;

      osc.type = "sine";
      osc.frequency.value = freq;

      // Vào ra êm để không nghe tiếng "bụp" giữa các hợp âm.
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 1.6);
      gain.gain.linearRampToValueAtTime(0.05, now + DUR - 2.0);
      gain.gain.linearRampToValueAtTime(0, now + DUR);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + DUR + 0.1);
    }

    this.synthTimer = window.setTimeout(() => this.scheduleChord(), DUR * 1000 - 250);
  }

  pause() {
    this.playing = false;
    if (this.synthTimer !== null) {
      clearTimeout(this.synthTimer);
      this.synthTimer = null;
    }
    this.audioEl?.pause();
    this.emit();
  }

  toggle() {
    if (this.playing) this.pause();
    else void this.start();
  }

  /** Chỉ dùng ở Thế Giới Sinh Nhật: nhường chỗ cho hộp nhạc. */
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.audioEl) this.audioEl.volume = muted ? 0 : SanctuaryMusic.VOLUME;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : SanctuaryMusic.VOLUME, this.ctx.currentTime, 0.2);
    }
    if (muted) this.pause();
  }
}

export const sanctuaryMusic = new SanctuaryMusic();
