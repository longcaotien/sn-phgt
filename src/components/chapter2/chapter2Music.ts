/**
 * Nhạc nền CHƯƠNG II (màn chơi mở đầu — Bảng Nhiệm Vụ → Cầu Nguyện → Né Tượng → Boss).
 *
 * Cách dùng: đặt file vào `public/music/chapter2.mp3`, không cần sửa code.
 * Không có file thì phát nền tổng hợp: drone trầm + nhịp gõ chậm, đúng không
 * khí dungeon lạnh lẽo của Solo Leveling.
 *
 * Khác với nhạc sảnh: chương này có tiếng động (tượng giáng đòn) nên nhạc nền
 * đặt âm lượng thấp hơn để không lấn, và tự hạ thêm khi đánh boss.
 */

const CHAPTER2_SRC = "music/chapter2.mp3";

type Listener = (playing: boolean) => void;

/** Vòng hợp âm La thứ — u ám, chậm. */
const DRONE_ROOTS = [110.0, 98.0, 87.31, 82.41]; // A2, G2, F2, E2

class Chapter2Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private synthTimer: number | null = null;
  private rootIndex = 0;
  private playing = false;
  private armed = false;
  private muted = false;
  private ducked = false;
  private listeners = new Set<Listener>();

  private static readonly VOLUME = 0.26;

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

  private targetVolume() {
    if (this.muted) return 0;
    return Chapter2Music.VOLUME * (this.ducked ? 0.45 : 1);
  }

  /** Mồi bằng tương tác đầu tiên — trình duyệt chặn tự phát âm thanh. */
  arm() {
    if (this.armed) return;
    this.armed = true;
    const kick = () => void this.start();
    window.addEventListener("pointerdown", kick, { once: true, passive: true });
    window.addEventListener("keydown", kick, { once: true });
  }

  private ensure() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.targetVolume();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  async start() {
    if (this.playing) return;
    this.playing = true;

    if (!this.audioEl) {
      const base = import.meta.env.BASE_URL ?? "/";
      const el = new Audio(`${base}${CHAPTER2_SRC}`);
      el.loop = true;
      el.volume = this.targetVolume();
      el.preload = "auto";
      this.audioEl = el;
    }
    try {
      await this.audioEl.play();
      this.emit();
      return;
    } catch {
      // Không có file => nhạc tổng hợp.
    }

    this.ensure();
    if (!this.ctx) return;
    this.scheduleDrone();
    this.emit();
  }

  private scheduleDrone() {
    if (!this.ctx || !this.master || !this.playing) return;
    const root = DRONE_ROOTS[this.rootIndex % DRONE_ROOTS.length];
    this.rootIndex++;

    const now = this.ctx.currentTime;
    const DUR = 9;

    // Lớp trầm: gốc + quãng năm, hơi lệch tần số để tạo cảm giác "rung".
    [
      { f: root, g: 0.11 },
      { f: root * 1.5, g: 0.055 },
      { f: root * 2.01, g: 0.03 },
    ].forEach(({ f, g }) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      filter.type = "lowpass";
      filter.frequency.value = 420;
      filter.Q.value = 2;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(g, now + 2.5);
      gain.gain.linearRampToValueAtTime(0, now + DUR);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master!);
      osc.start(now);
      osc.stop(now + DUR + 0.1);
    });

    // Nhịp gõ chậm mỗi 1,5 giây — như tiếng nước rơi trong hang.
    for (let i = 0; i < 6; i++) {
      const at = now + 0.8 + i * 1.5;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(150, at);
      osc.frequency.exponentialRampToValueAtTime(55, at + 0.2);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.045, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(at);
      osc.stop(at + 0.4);
    }

    this.synthTimer = window.setTimeout(() => this.scheduleDrone(), DUR * 1000 - 400);
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

  setMuted(m: boolean) {
    this.muted = m;
    this.applyVolume();
    if (m) this.pause();
  }

  /** Hạ nhạc khi vào trận boss để tiếng đánh không bị lấn. */
  setDucked(d: boolean) {
    this.ducked = d;
    this.applyVolume();
  }

  private applyVolume() {
    const v = this.targetVolume();
    if (this.audioEl) this.audioEl.volume = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3);
    }
  }
}

export const chapter2Music = new Chapter2Music();
