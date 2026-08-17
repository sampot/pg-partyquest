const SFX = ["click", "step", "sword", "spell", "heal", "coin", "door", "win", "hit"];

export class GameAudio {
  constructor(base = "assets/sfx") {
    this.base = base;
    this.ctx = null;
    this.enabled = true;
    this.vol = 0.55;
    this.cache = new Map();
    this.bgmSrc = null;
    this.bgmGain = null;
    this.suspended = false;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
  }

  async unlock() {
    this.ensure();
    if (this.ctx?.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.bgmGain) this.bgmGain.gain.value = on && !this.suspended ? this.vol * 0.35 : 0;
  }

  suspend() {
    this.suspended = true;
    if (this.bgmGain) this.bgmGain.gain.value = 0;
  }

  resume() {
    this.suspended = false;
    if (this.enabled && this.bgmGain) this.bgmGain.gain.value = this.vol * 0.35;
  }

  async load(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    this.ensure();
    if (!this.ctx) return null;
    try {
      const res = await fetch(`${this.base}/${name}.ogg`);
      if (!res.ok) throw new Error(`fetch ${name}`);
      const buf = await res.arrayBuffer();
      const audio = await this.ctx.decodeAudioData(buf);
      this.cache.set(name, audio);
      return audio;
    } catch {
      return null;
    }
  }

  async preloadAll() {
    return Promise.all([
      ...SFX.map((name) => this.load(name)),
      this.loadBgm(),
    ]);
  }

  async loadBgm() {
    if (this.cache.has("bgm")) return this.cache.get("bgm");
    this.ensure();
    if (!this.ctx) return null;
    try {
      const res = await fetch("assets/bgm/bgm.ogg");
      if (!res.ok) throw new Error("fetch bgm");
      const buf = await res.arrayBuffer();
      const audio = await this.ctx.decodeAudioData(buf);
      this.cache.set("bgm", audio);
      return audio;
    } catch {
      return null;
    }
  }

  async play(name) {
    if (!this.enabled || this.suspended) return;
    const buf = await this.load(name);
    if (!buf || !this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = this.vol;
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
  }

  async playBgm() {
    if (!this.enabled || this.suspended) return;
    const buf = await this.loadBgm();
    if (!buf || !this.ctx) return;
    if (this.bgmSrc) {
      try {
        this.bgmSrc.stop();
      } catch {
        /* ignore */
      }
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = this.vol * 0.35;
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
    this.bgmSrc = src;
    this.bgmGain = gain;
  }

  stopBgm() {
    if (this.bgmSrc) {
      try {
        this.bgmSrc.stop();
      } catch {
        /* ignore */
      }
      this.bgmSrc = null;
      this.bgmGain = null;
    }
  }
}
