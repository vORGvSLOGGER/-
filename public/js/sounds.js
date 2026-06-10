// مؤثرات صوتية مولدة بـ Web Audio API (بدون ملفات خارجية)
const Sounds = (() => {
  let ctx = null;
  let muted = false;

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.15, slideTo = null, delay = 0) {
    const c = ac();
    if (!c || muted) return;
    const o = c.createOscillator();
    const g = c.createGain();
    const t0 = c.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  return {
    click()   { tone(620, 0.07, 'triangle', 0.10); },
    swap()    { tone(380, 0.10, 'sine', 0.12, 520); },
    invalid() { tone(180, 0.16, 'sawtooth', 0.08, 120); },
    match(n)  {
      // كل ما زاد الدمج زادت النغمة حماساً
      const base = 440 + Math.min(n, 8) * 60;
      tone(base, 0.12, 'triangle', 0.14);
      tone(base * 1.5, 0.14, 'triangle', 0.10, null, 0.06);
      if (n >= 4) tone(base * 2, 0.18, 'square', 0.07, null, 0.12);
    },
    cascade(step) { tone(500 + step * 90, 0.1, 'triangle', 0.1, 700 + step * 90); },
    fly()     { tone(900, 0.35, 'sine', 0.08, 200); },
    hit()     { tone(140, 0.25, 'sawtooth', 0.16, 60); tone(90, 0.3, 'square', 0.1, 40, 0.05); },
    shield()  { tone(700, 0.2, 'sine', 0.12, 900); },
    tick()    { tone(950, 0.05, 'square', 0.05); },
    turn()    { tone(520, 0.12, 'sine', 0.12); tone(780, 0.14, 'sine', 0.1, null, 0.1); },
    coin()    { tone(988, 0.09, 'square', 0.08); tone(1319, 0.16, 'square', 0.08, null, 0.08); },
    buy()     { tone(660, 0.1, 'triangle', 0.12); tone(880, 0.1, 'triangle', 0.12, null, 0.09); tone(1100, 0.18, 'triangle', 0.12, null, 0.18); },
    win() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'triangle', 0.13, null, i * 0.13));
    },
    lose() {
      [400, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.09, null, i * 0.18));
    },
    bomb()    { tone(80, 0.5, 'sawtooth', 0.2, 30); tone(50, 0.6, 'square', 0.15, 25, 0.05); },
    message() { tone(740, 0.1, 'sine', 0.1); tone(990, 0.12, 'sine', 0.1, null, 0.09); },
    setMuted(m) { muted = m; },
  };
})();
