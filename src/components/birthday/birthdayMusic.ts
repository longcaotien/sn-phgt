/**
 * Trình phát nhạc Hộp Nhạc (Music Box + Warm Pad) cho Thế Giới Sinh Nhật 30/11.
 * Tự động thử phát `public/music/birthday.mp3` nếu có; nếu chưa có file mp3,
 * phát giai điệu Happy Birthday Lofi / Music Box du dương bằng Web Audio API.
 */
class BirthdayMusicPlayer {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private useFile = false;
  private playing = false;
  private step = 0;

  // Happy Birthday (F major, chậm rãi 74 BPM, cảm giác hộp nhạc chill)
  private readonly melody: Array<{ f: number; beats: number; bass?: number }> = [
    { f: 261.63, beats: 0.75, bass: 174.61 }, // C4
    { f: 261.63, beats: 0.25 },
    { f: 293.66, beats: 1.0, bass: 174.61 },  // D4
    { f: 261.63, beats: 1.0, bass: 130.81 },  // C4
    { f: 349.23, beats: 1.0, bass: 174.61 },  // F4
    { f: 329.63, beats: 2.0, bass: 130.81 },  // E4

    { f: 261.63, beats: 0.75, bass: 130.81 }, // C4
    { f: 261.63, beats: 0.25 },
    { f: 293.66, beats: 1.0, bass: 196.0 },   // D4
    { f: 261.63, beats: 1.0, bass: 130.81 },  // C4
    { f: 392.0, beats: 1.0, bass: 196.0 },    // G4
    { f: 349.23, beats: 2.0, bass: 174.61 },  // F4

    { f: 261.63, beats: 0.75, bass: 174.61 }, // C4
    { f: 261.63, beats: 0.25 },
    { f: 523.25, beats: 1.0, bass: 174.61 },  // C5
    { f: 440.0, beats: 1.0, bass: 220.0 },    // A4
    { f: 349.23, beats: 1.0, bass: 174.61 },  // F4
    { f: 329.63, beats: 1.0, bass: 146.83 },  // E4
    { f: 293.66, beats: 1.6, bass: 116.54 },  // D4

    { f: 466.16, beats: 0.75, bass: 116.54 }, // Bb4
    { f: 466.16, beats: 0.25 },
    { f: 440.0, beats: 1.0, bass: 174.61 },   // A4
    { f: 349.23, beats: 1.0, bass: 130.81 },  // F4
    { f: 392.0, beats: 1.0, bass: 196.0 },    // G4
    { f: 349.23, beats: 2.4, bass: 174.61 },  // F4
  ];

  private ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  private playBellNote(freq: number, durSec: number, gainPeak = 0.085, isBass = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isBass ? "triangle" : "sine";
    osc.frequency.setValueAtTime(freq, now);

    // Họa âm trong trẻo kiểu hộp nhạc celesta
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(isBass ? freq * 2 : freq * 2, now);

    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(isBass ? 0.15 : 0.22, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + (isBass ? 0.06 : 0.015));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durSec);

    osc.connect(gain);
    osc2.connect(g2);
    g2.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + durSec + 0.05);
    osc2.stop(now + durSec + 0.05);
  }

  private scheduleNext = () => {
    if (!this.playing) return;
    const item = this.melody[this.step % this.melody.length];
    this.step++;
    const beatMs = 740;
    const durMs = item.beats * beatMs;

    this.playBellNote(item.f, Math.max(0.55, (durMs / 1000) * 1.35), 0.08, false);
    if (item.bass) {
      this.playBellNote(item.bass, 1.8, 0.045, true);
    }

    this.timer = window.setTimeout(this.scheduleNext, durMs);
  };

  async start() {
    if (this.playing) return;
    this.playing = true;

    // Thử file nhạc tùy chọn public/music/birthday.mp3 nếu tồn tại
    if (!this.audioEl) {
      const base = import.meta.env.BASE_URL ?? "/";
      const audio = new Audio(`${base}music/birthday.mp3`);
      audio.loop = true;
      audio.volume = 0.52;
      this.audioEl = audio;
      try {
        await audio.play();
        this.useFile = true;
        return;
      } catch {
        this.useFile = false;
      }
    } else if (this.useFile) {
      try {
        await this.audioEl.play();
        return;
      } catch {
        this.useFile = false;
      }
    }

    this.ensureContext();
    this.scheduleNext();
  }

  pause() {
    this.playing = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
    }
  }

  stop() {
    this.pause();
    this.step = 0;
  }
}

export const birthdayMusic = new BirthdayMusicPlayer();
