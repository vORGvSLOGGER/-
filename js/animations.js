// أنيميشن المعركة: الحلويات الطائرة للخصم، الانفجارات، أرقام الضرر، الكومبو، الاهتزاز
const Anim = (() => {

  // حلويات تطير من خلايا الدمج إلى شريط صحة الهدف
  function flyToTarget(cellEls, targetEl, emoji, onArrive) {
    if (!targetEl || !cellEls.length) { onArrive && onArrive(); return; }
    const tr = targetEl.getBoundingClientRect();
    const tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
    const picks = cellEls.slice(0, 8); // ما نحتاج أكثر من 8 حلويات طايرة
    let arrived = 0;

    picks.forEach((cell, i) => {
      const r = cell.getBoundingClientRect();
      const f = document.createElement('div');
      f.className = 'flying-candy';
      f.textContent = cell.textContent || emoji || '🍬';
      f.style.left = (r.left + r.width / 2 - 13) + 'px';
      f.style.top = (r.top + r.height / 2 - 13) + 'px';
      document.body.appendChild(f);
      Sounds.fly();

      setTimeout(() => {
        f.style.left = (tx - 13) + 'px';
        f.style.top = (ty - 13) + 'px';
        f.style.transform = 'scale(0.5) rotate(540deg)';
        f.style.opacity = '0.85';
      }, 30 + i * 70);

      setTimeout(() => {
        f.remove();
        burst(tx, ty);
        if (++arrived === picks.length) onArrive && onArrive();
      }, 760 + i * 70);
    });
  }

  function burst(x, y) {
    const b = document.createElement('div');
    b.className = 'impact-burst';
    b.textContent = '💥';
    b.style.left = (x - 15) + 'px';
    b.style.top = (y - 15) + 'px';
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 520);
  }

  function damageNumber(targetEl, amount) {
    if (!targetEl) return;
    const r = targetEl.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'damage-float';
    d.textContent = '-' + amount;
    d.style.left = (r.left + r.width / 2 - 14) + 'px';
    d.style.top = (r.top + 8) + 'px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1050);
  }

  function combo(step) {
    const texts = ['', '', 'كومبو ×2 🔥', 'كومبو ×3 ⚡', 'كومبو ×4 💥', 'جنووون ×5 🌟'];
    const c = document.createElement('div');
    c.className = 'combo-banner';
    c.textContent = texts[Math.min(step, 5)] || `كومبو ×${step} 🌟`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1050);
  }

  function bigText(text) {
    const c = document.createElement('div');
    c.className = 'combo-banner';
    c.textContent = text;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1050);
  }

  function shake() {
    const s = document.getElementById('screen-battle');
    s.classList.remove('screen-shake'); void s.offsetWidth;
    s.classList.add('screen-shake');
  }

  function hudHit(hudEl) {
    if (!hudEl) return;
    hudEl.classList.remove('hit'); void hudEl.offsetWidth;
    hudEl.classList.add('hit');
  }

  return { flyToTarget, burst, damageNumber, combo, bigText, shake, hudHit };
})();
