import { off, on } from "./dom.js";

export class RefreshScheduler {
  constructor({ interval = 60_000, jitter = 3000, onTick, onState } = {}) {
    this.interval = interval;
    this.jitter = jitter;
    this.onTick = onTick || (() => {});
    this.onState = onState || (() => {});
    this.timer = 0;
    this.running = false;
    this.failures = 0;
    this.visibilityHandler = () => {
      if (document.hidden) this.pause("Paused while hidden");
      else this.start("Resumed");
    };
  }

  start(label = "Auto refresh on", delay = 250) {
    if (this.running) return;
    this.running = true;
    if (typeof document !== "undefined") on(document, "visibilitychange", this.visibilityHandler);
    this.onState(label);
    this.schedule(delay);
  }

  pause(label = "Paused") {
    this.running = false;
    clearTimeout(this.timer);
    this.onState(label);
  }

  stop(label = "Stopped") {
    this.pause(label);
    if (typeof document !== "undefined") off(document, "visibilitychange", this.visibilityHandler);
  }

  refreshNow() {
    clearTimeout(this.timer);
    return this.tick(true);
  }

  schedule(delay = this.interval) {
    clearTimeout(this.timer);
    if (!this.running) return;
    const skew = Math.floor(Math.random() * this.jitter);
    this.timer = setTimeout(() => this.tick(false), delay + skew);
  }

  async tick(force) {
    if (!this.running && !force) return;
    try {
      this.onState("Updating");
      await this.onTick({ force });
      this.failures = 0;
      this.onState("Fresh");
      this.schedule(this.interval);
    } catch (error) {
      this.failures += 1;
      const backoff = Math.min(5 * 60_000, this.interval * this.failures);
      this.onState(`Stale: ${error.message}`);
      this.schedule(backoff);
    }
  }
}
