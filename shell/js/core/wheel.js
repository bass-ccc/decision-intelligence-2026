// One wheel gesture = one stop.
//
// A wheel event says very little about what the hand did. A notched mouse sends one event per
// click (100 px on Windows, about 4 px on macOS, 33 px when set to one line). A trackpad sends an
// event every frame while the fingers move and then keeps sending for a second or more after they
// lift (momentum). So: a gesture takes its step once 50 px have added up, and the rest of that
// gesture is thrown away. The next step needs a pause, a turn the other way, a clearly harder
// push, or a wheel that is still being turned notch by notch.
//
// No DOM and no imports, so the same file runs under Node for the replay tests.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// step(dir)        take one step, dir is +1 or -1
// blocked()        true while steps must not be taken (a panel is open)
// frozenIn(a, b)   ms between two timestamps during which the page drew no frame
export function createWheelStepper({ step, blocked = () => false, frozenIn = () => 0, timers = globalThis }) {
  const wh = {
    acc: 0, // px gathered by the gesture that has not stepped yet
    n: 0, // events in it
    min: Infinity, // its smallest event
    t: 0, // time of the last event
    t0: 0, // time the gesture began
    abs: 0, // size of the last event
    dir: 0,
    spent: false, // this gesture has taken its step
    until: 0, // nothing re-arms a spent gesture before this
    lo: Infinity, // slowest the discarded tail has been, px per ms
    hi: 0, // fastest the gesture has been
    pr: 0, // rate of the previous event
    runT: 0, // since when the tail has been clearly speeding up
    idle: 0, // timer that settles a short burst
    denseT: -Infinity, // last time events came trackpad-close
    calm: Infinity, // how long before this gesture that was
  };

  const take = (dir, now) => {
    wh.acc = 0;
    wh.spent = true;
    wh.until = now + 420;
    wh.lo = Infinity;
    wh.runT = 0;
    step(dir);
  };

  const disarm = () => {
    timers.clearTimeout(wh.idle);
    wh.idle = 0;
  };

  // Some wheels send too little per notch to ever reach 50 px. Their events come far apart (a
  // trackpad's come every frame) and none is under 4 px (a trackpad brush has 1-3 px events), so
  // a short burst like that, once it has gone quiet, counts as one step. Not right after
  // trackpad-like input: a hiccup can leave a few stray pixels at the end of a flick.
  const settle = () => {
    const wheelLike = wh.n === 1 || (wh.t - wh.t0) / (wh.n - 1) >= 40 || wh.min >= 4;
    if (wh.spent || blocked() || wh.calm < 600 || !wheelLike || Math.abs(wh.acc) < 4) return;
    take(Math.sign(wh.acc), wh.t + 200);
  };

  return {
    // d: pixels (line and page deltas already converted), now: when the event was made (not when
    // it got handled: a busy frame must not look like a pause), line: the device reports lines
    wheel(d, now, line = false) {
      const a = Math.abs(d);
      const dir = Math.sign(d);
      const gap = now - wh.t;
      // time the page was frozen is not time the reader paused: after a long frame the browser
      // hands over the queued events as one big one with the newest timestamp
      const frozen = wh.spent ? frozenIn(wh.t, now) : 0;
      // "harder push" is judged in px per ms against the slowest the tail has been, not event
      // against event, so one summed event does not look like a shove
      const rate = a / (frozen ? Math.max(gap, 8) : clamp(gap, 8, 180));
      const notch = line || (a >= 100 && a === wh.abs);
      // fingers back on the pad while it still coasts: momentum only ever decays, so a rise that
      // holds for 80 ms is a new gesture. Only after a real flick, so one slow uneven drag still
      // takes one stop.
      let rise = false;
      if (wh.spent && now > wh.until && wh.hi >= 1.2 && gap <= 180 && dir === wh.dir && rate > wh.lo * 3) {
        if (!wh.runT) wh.runT = now;
        else if (now - wh.runT >= 80) rise = true;
      } else wh.runT = 0;

      const pause = gap - frozen > 180;
      if (pause || dir !== wh.dir || (wh.spent && now > wh.until && (notch || rise || rate > wh.lo * 3 + 0.5))) {
        // a burst still waiting for its timer is settled now, or the new notch would wipe it out
        if (pause && wh.idle) {
          disarm();
          settle();
        }
        wh.spent = false;
        wh.acc = 0;
        wh.n = 0;
        wh.min = Infinity;
        wh.t0 = now;
        wh.calm = now - wh.denseT;
        wh.runT = 0;
        wh.hi = 0;
        wh.pr = 0;
      }
      // the slower of two neighbours, so one jittered timestamp cannot fake a flick
      wh.hi = Math.max(wh.hi, Math.min(rate, wh.pr));
      wh.pr = rate;
      // tiny events this close together are a trackpad; wheel notches are never under 4 px
      if (gap < 40 && a < 4) wh.denseT = now;
      wh.t = now;
      wh.abs = a;
      wh.dir = dir;
      if (wh.spent) {
        wh.lo = Math.min(wh.lo, rate);
        return;
      }
      wh.acc += d;
      wh.n++;
      wh.min = Math.min(wh.min, a);
      disarm();
      if (Math.abs(wh.acc) >= 50) {
        take(dir, now);
        return;
      }
      wh.idle = timers.setTimeout(() => {
        wh.idle = 0;
        settle();
      }, 200);
    },

    // The reader went somewhere by other means (home, a jump from the index or the gauge):
    // whatever the wheel was still gathering no longer applies.
    reset() {
      disarm();
      wh.acc = 0;
    },
  };
}
