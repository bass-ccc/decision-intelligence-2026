import * as THREE from 'three';
import { clamp, damp, lerp } from './util.js';

// The dive line. Keys are camera stops (and a few in-between waypoints);
// position s runs from 0 to keys.length-1 and scroll / swipe / keys move it.
// Releasing always settles on the nearest stop.

export class Tour {
  constructor(keys) {
    this.keys = keys;
    this.n = keys.length;
    this.posCurve = new THREE.CatmullRomCurve3(keys.map((k) => k.cam), false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(keys.map((k) => k.look), false, 'centripetal');
    // arc-length would make the long surfacing flight feel as slow as a short hop;
    // sampling by key index keeps one scroll notch ≈ one step whatever the distance
    this.stops = keys.map((k, i) => (k.stop ? i : -1)).filter((i) => i >= 0);
    this.s = 0;
    this.target = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.idleT = 0;
    this.lastDir = 1;
    this.locked = false;
    this.maxS = this.n - 1;
    this.speed = 1.9;
  }

  sample(s, pos, look) {
    const t = clamp(s / (this.n - 1), 0, 1);
    this.posCurve.getPoint(t, pos);
    this.lookCurve.getPoint(t, look);
  }

  // Linear blend of a numeric key property along s.
  param(name, fallback, s = this.s) {
    const i = Math.floor(clamp(s, 0, this.n - 1));
    const j = Math.min(this.n - 1, i + 1);
    const f = s - i;
    const a = this.keys[i][name] ?? fallback;
    const b = this.keys[j][name] ?? fallback;
    return lerp(a, b, f);
  }

  nudge(ds) {
    if (this.locked) return;
    this.tw = null;
    // never fling more than a couple of stops ahead of where the camera is
    this.target = clamp(this.target + ds, Math.max(0, this.s - 3), Math.min(this.maxS, this.s + 3));
    this.lastDir = Math.sign(ds) || this.lastDir;
    this.idleT = 0;
  }

  nearestStop(s) {
    let best = this.stops[0];
    for (const i of this.stops) if (Math.abs(i - s) < Math.abs(best - s)) best = i;
    return best;
  }

  next() {
    const cur = this.nearestStop(this.target);
    const k = this.stops.find((i) => i > cur + 0.01);
    if (k !== undefined) this.goKey(k);
  }

  prev() {
    const cur = this.nearestStop(this.target);
    const ks = this.stops.filter((i) => i < cur - 0.01);
    if (ks.length) this.goKey(ks[ks.length - 1]);
  }

  goKey(k) {
    this.tw = null;
    this.target = clamp(k, 0, this.maxS);
    this.settled = this.target;
    this.lastDir = Math.sign(k - this.s) || this.lastDir;
    this.idleT = 10;
  }

  jumpKey(k) {
    this.tw = null;
    this.s = this.target = clamp(k, 0, this.maxS);
    this.settled = this.target;
    this.idleT = 10;
  }

  // Scripted move with an ease curve (the jump off the roof, the surfacing).
  tween(to, dur) {
    this.tw = { from: this.s, to, t: 0, dur };
    this.target = to;
    this.settled = to;
    this.idleT = 10;
  }

  update(dt) {
    if (this.tw) {
      const w = this.tw;
      w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.s = lerp(w.from, w.to, e);
      this.target = w.to;
      if (k >= 1) this.tw = null;
      this.sample(this.s, this.pos, this.look);
      return;
    }
    this.idleT += dt;
    if (this.idleT > 0.22 && this.idleT < 5) {
      // settle on a stop: a small nudge goes back, anything more carries on to the next stop that way
      const cur = this.settled ?? this.nearestStop(this.s);
      let k;
      if (Math.abs(this.target - cur) < 0.08) k = cur;
      else if (this.lastDir > 0) k = this.stops.find((i) => i >= this.target - 0.001) ?? this.stops[this.stops.length - 1];
      else k = [...this.stops].reverse().find((i) => i <= this.target + 0.001) ?? this.stops[0];
      this.target = k;
      this.settled = k;
      this.idleT = 5;
    }
    const gap = Math.abs(this.target - this.s);
    const lambda = this.speed * (gap > 2 ? 1.35 : 1);
    this.s = damp(this.s, this.target, lambda, dt);
    if (Math.abs(this.target - this.s) < 0.0005) this.s = this.target;
    this.sample(this.s, this.pos, this.look);
  }

  get activeKey() {
    const k = this.nearestStop(this.s);
    return Math.abs(k - this.s) < 0.28 ? k : -1;
  }
}
