// القصر التفاعلي: أماكن حقيقية فوق صورة القصر (إحداثيات على الصورة الأصلية 1408×768)
const Castle = (() => {
  const IW = 1408, IH = 768;
  const $ = id => document.getElementById(id);

  // كل مكان: مركزه وحجمه على الصورة + التسمية + الفعل
  const SPOTS = [
    { id: 'hs-play',     x: 702,  y: 425, w: 200, h: 210, label: '⚔️ ابدأ اللعب',      primary: true, action: () => openPanel('panel-play') },
    { id: 'hs-bot',      x: 553,  y: 450, w: 140, h: 240, label: '🤖 بوت أو أونلاين',  action: () => { openPanel('panel-play'); } },
    { id: 'hs-local',    x: 877,  y: 450, w: 140, h: 240, label: '📱 بنفس الجهاز',     action: () => Main.startLocalFlow() },
    { id: 'hs-shop',     x: 198,  y: 335, w: 250, h: 350, label: '🏪 المتجر الملكي',   action: () => { Shop.render(); openPanel('panel-shop'); } },
    { id: 'hs-missions', x: 398,  y: 308, w: 108, h: 132, label: '📜 المهام اليومية',  action: () => { Missions.render(); openPanel('panel-missions'); } },
    { id: 'hs-lb',       x: 1218, y: 298, w: 225, h: 270, label: '🏆 المتصدرين',       action: () => { Leaderboard.open(); } },
    { id: 'hs-settings', x: 1192, y: 515, w: 230, h: 145, label: '⚙️ الإعدادات',       action: () => openPanel('panel-settings') },
    { id: 'hs-gift',     x: 395,  y: 640, w: 250, h: 195, label: '🎁 الصندوق الملكي',  action: () => { Missions.renderGift(); openPanel('panel-gift'); } },
  ];

  function build() {
    const wrap = $('hotspots');
    wrap.innerHTML = '';
    for (const s of SPOTS) {
      const b = document.createElement('button');
      b.className = 'hotspot' + (s.primary ? ' primary' : '');
      b.id = s.id;
      b.innerHTML = `<span class="hs-zone"></span><span class="hs-label">${s.label}</span>`;
      b.addEventListener('click', () => {
        Sounds.click();
        zoomTo(s);
        setTimeout(() => s.action(), 240);
      });
      wrap.appendChild(b);
    }
    layout();
  }

  // تحويل إحداثيات الصورة إلى الشاشة (الخلفية بوضع cover)
  function layout() {
    const W = window.innerWidth, H = window.innerHeight;
    const scale = Math.max(W / IW, H / IH);
    const ox = (W - IW * scale) / 2;
    const oy = (H - IH * scale) / 2;
    for (const s of SPOTS) {
      const el = $(s.id);
      if (!el) continue;
      let cx = s.x * scale + ox;
      let cy = s.y * scale + oy;
      const w = Math.max(64, s.w * scale);
      const h = Math.max(54, s.h * scale);
      // لو انقص المكان خارج الشاشة (شاشات طولية) نسحبه للداخل حتى يظل قابلاً للمس
      cx = Math.min(Math.max(cx, w / 2 + 6), W - w / 2 - 6);
      cy = Math.min(Math.max(cy, h / 2 + 60), H - h / 2 - 10);
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      el.style.width = w + 'px';
      el.style.height = h + 'px';
    }
  }

  function zoomTo(s) {
    const stage = $('castle-stage');
    stage.classList.add('zoom-to');
    stage.style.transformOrigin = `${(s.x / IW) * 100}% ${(s.y / IH) * 100}%`;
    stage.style.transform = 'scale(1.28)';
    stage.style.filter = 'brightness(1.15)';
  }

  function resetZoom() {
    const stage = $('castle-stage');
    stage.style.transform = '';
    stage.style.filter = '';
  }

  function openPanel(id) {
    document.querySelectorAll('.royal-overlay').forEach(p => p.classList.add('hidden'));
    $(id).classList.remove('hidden');
  }

  function closeAllPanels() {
    document.querySelectorAll('.royal-overlay').forEach(p => p.classList.add('hidden'));
    resetZoom();
  }

  function onEnter() {
    build();
    Missions.checkDaily();
  }

  function init() {
    window.addEventListener('resize', layout);
    document.querySelectorAll('.panel-close').forEach(btn => {
      btn.addEventListener('click', () => { Sounds.click(); closeAllPanels(); });
    });
    document.querySelectorAll('.royal-overlay').forEach(ov => {
      ov.addEventListener('click', (e) => { if (e.target === ov) closeAllPanels(); });
    });
    // شرائح العملات والبروفايل
    $('chip-coins').addEventListener('click', () => { Sounds.click(); Shop.render('coins'); openPanel('panel-shop'); });
    $('chip-gems').addEventListener('click', () => { Sounds.click(); Shop.render('gems'); openPanel('panel-shop'); });
    $('castle-profile').addEventListener('click', () => { Sounds.click(); openPanel('panel-settings'); });
  }

  return { init, onEnter, openPanel, closeAllPanels, layout };
})();
