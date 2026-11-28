/**
 * Âm thanh Chương II — tổng hợp toàn bộ bằng Web Audio API.
 *
 * Vì sao không dùng file mp3: tiếng "tượng thần gõ xuống" phải khớp chính xác
 * từng cú giáng đòn trong code game, mà mỗi đợt lại cách nhau vài trăm ms.
 * Tổng hợp cho phép phát tức thì, độ trễ gần 0, và không phải tải thêm file.
 *
 * Mọi thứ đi qua một master gain để có thể tắt toàn bộ bằng một công tắc.
 */

class Chapter2Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private muted = false;
  /** Số lượng âm đang phát — dùng để tránh chồng quá nhiều cùng lúc. */
  private active = 0;

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Buffer nhiễu trắng dùng chung, tạo một lần rồi tái sử dụng. */
  private noise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return buf;
  }

  isMuted() {
    return this.muted;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
  }

  toggle(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * TƯỢNG THẦN GIÁNG ĐÒN — tiếng nặng nhất trong game.
   *
   * Cấu tạo 3 lớp chồng lên nhau (đây là điều làm nó "nặng"):
   *   1. Cú đập trầm: sine 150 Hz tụt xuống 28 Hz trong 0,45 s  → cảm giác nền đất rung
   *   2. Tiếng đá vỡ: nhiễu trắng qua lowpass 1800 Hz tắt dần 0,5 s
   *   3. Tiếng "uỳnh" kim loại: sóng vuông 62 Hz rất ngắn, méo nhẹ
   *
   * @param power 0..1 — càng lớn càng nặng (dùng 1 cho đòn thường, 1.3 khi trúng đòn)
   */
  strike(power = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    // Chống bắn quá nhiều cùng lúc (đợt kép có 2 cú liền nhau 300 ms).
    if (this.active > 6) return;
    this.active++;
    const t = ctx.currentTime;
    const p = Math.max(0.4, Math.min(1.4, power));

    // --- 1. Cú đập trầm ---
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = "sine";
    boom.frequency.setValueAtTime(150 * p, t);
    boom.frequency.exponentialRampToValueAtTime(28, t + 0.45);
    boomGain.gain.setValueAtTime(0.0001, t);
    boomGain.gain.exponentialRampToValueAtTime(0.85 * p, t + 0.012);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    boom.connect(boomGain);
    boomGain.connect(this.master);
    boom.start(t);
    boom.stop(t + 0.75);

    // --- 2. Đá vỡ / bụi tung ---
    const crack = ctx.createBufferSource();
    crack.buffer = this.noise(ctx);
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = "lowpass";
    crackFilter.frequency.setValueAtTime(1800, t);
    crackFilter.frequency.exponentialRampToValueAtTime(320, t + 0.5);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.32 * p, t);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.master);
    crack.start(t);
    crack.stop(t + 0.55);

    // --- 3. Tiếng uỳnh kim loại ---
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = "square";
    thud.frequency.setValueAtTime(62, t);
    thudGain.gain.setValueAtTime(0.16 * p, t);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    thud.connect(thudGain);
    thudGain.connect(this.master);
    thud.start(t);
    thud.stop(t + 0.2);

    window.setTimeout(() => {
      this.active = Math.max(0, this.active - 1);
    }, 800);
  }

  /** Tượng thần chuyển mắt sang đỏ — cảnh báo sắp giáng đòn. */
  warn() {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.18);
    filter.type = "bandpass";
    filter.frequency.value = 600;
    filter.Q.value = 3;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.13, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  /** Tượng thức tỉnh — dùng lúc chuyển từ cầu nguyện sang né đòn. */
  awaken() {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;

    // Trầm dâng lên
    const rise = ctx.createOscillator();
    const riseGain = ctx.createGain();
    rise.type = "sawtooth";
    rise.frequency.setValueAtTime(40, t);
    rise.frequency.exponentialRampToValueAtTime(110, t + 1.5);
    const riseFilter = ctx.createBiquadFilter();
    riseFilter.type = "lowpass";
    riseFilter.frequency.setValueAtTime(200, t);
    riseFilter.frequency.exponentialRampToValueAtTime(1600, t + 1.5);
    riseGain.gain.setValueAtTime(0.0001, t);
    riseGain.gain.exponentialRampToValueAtTime(0.22, t + 1.1);
    riseGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    rise.connect(riseFilter);
    riseFilter.connect(riseGain);
    riseGain.connect(this.master);
    rise.start(t);
    rise.stop(t + 2);

    // Đá rung sau đó
    window.setTimeout(() => this.strike(1.25), 1450);
  }

  /** Nế hoàn hảo — tiếng "ting" báo thành công. */
  perfect() {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    [880, 1174.66].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.1, t + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.45);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.5);
    });
  }

  /** Trúng đòn — tiếng ù đục, khác hẳn tiếng giáng đòn. */
  hurt() {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.35);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.42);
  }
}

export const chapter2Sfx = new Chapter2Sfx();
