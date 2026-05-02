import { off, on } from "./dom.js";

export class RefreshScheduler {
  constructor({ interval = 60_000, jitter = 3000, onTick } = {}) {
    this.interval = interval;
    this.jitter = jitter;
    this.onTick = onTick || (() => {});
    this.timer = 0;
    this.running = false;
    this.failures = 0;
    this.visibilityHandler = () => {
      if (document.hidden) this.pause();
      else this.start();
    };
  }

  start(delay = 250) {
    if (this.running) return;
    this.running = true;
    if (typeof document !== "undefined") on(document, "visibilitychange", this.visibilityHandler);
    this.schedule(delay);
  }

  pause() {
    this.running = false;
    clearTimeout(this.timer);
  }

  stop() {
    this.pause();
    if (typeof document !== "undefined") off(document, "visibilitychange", this.visibilityHandler);
  }

  schedule(delay = this.interval) {
    clearTimeout(this.timer);
    if (!this.running) return;
    const skew = Math.floor(Math.random() * this.jitter);
    this.timer = setTimeout(() => this.tick(), delay + skew);
  }

  async tick() {
    if (!this.running) return;
    try {
      await this.onTick();
      this.failures = 0;
      this.schedule(this.interval);
    } catch (error) {
      this.failures += 1;
      const backoff = Math.min(5 * 60_000, this.interval * this.failures);
      this.schedule(backoff);
    }
  }
}
