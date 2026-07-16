// القصر التفاعلي المتجاوب: مشهد بمقياس ثابت داخل حاوية سحب أفقي
// على الشاشات العريضة يغطي الشاشة، وعلى الجوال العمودي تسحب يمين/يسار لاستكشاف القصر
const Castle = (() => {
  const IW = 1408, IH = 768; // أبعاد صورة القصر الأصلية
  const $ = id => document.getElementById(id);
  let scale = 1;

  // كل مكان: مركزه وحجمه على الصورة الأصلية + التسمية + الفعل
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

  // المشهد بمقياس cover: لو الشاشة أطول من نسبة الصورة يصير المشهد أعرض من الشاشة → سحب أفقي
  function layout() {
    const W = window.innerWidth, H = window.innerHeight;
    scale = Math.max(W / IW, H / IH);
    const stageW = Math.round(IW * scale);
    const stageH = Math.round(IH * scale);
    const stage = $('castle-stage');
    stage.style.width = stageW + 'px';
    stage.style.height = stageH + 'px';
    // توسيط عمودي (الشاشات العريضة جداً يزيد ارتفاع المشهد عن الشاشة)
    stage.style.marginTop = Math.min(0, (H - stageH) / 2) + 'px';

    for (const s of SPOTS) {
      const el = $(s.id);
      if (!el) continue;
      el.style.left = (s.x * scale) + 'px';
      el.style.top = (s.y * scale) + 'px';
      el.style.width = Math.max(64, s.w * scale) + 'px';
      el.style.height = Math.max(54, s.h * scale) + 'px';
    }

    centerOnThrone();
    // تلميح السحب إذا كان المشهد أعرض من الشاشة
    const scrollable = stageW > W + 10;
    maybeShowSwipeHint(scrollable);
  }

  function centerOnThrone() {
    const sc = $('castle-scroll');
    const W = window.innerWidth;
    sc.scrollLeft = Math.max(0, 702 * scale - W / 2);
  }

  let hintShown = false;
  function maybeShowSwipeHint(scrollable) {
    const hint = $('swipe-hint');
    if (!scrollable || hintShown || !$('screen-castle').classList.contains('active')) {
      if (!scrollable) hint.classList.add('hidden');
      return;
    }
    hintShown = true;
    hint.classList.remove('hidden');
    const hide = () => hint.classList.add('hidden');
    setTimeout(hide, 4500);
    $('castle-scroll').addEventListener('scroll', hide, { once: true });
  }

  function zoomTo(s) {
    const bg = $('castle-bg');
    bg.style.transformOrigin = `${(s.x / IW) * 100}% ${(s.y / IH) * 100}%`;
    bg.style.transform = 'scale(1.25)';
    bg.style.filter = 'brightness(1.15)';
  }

  function resetZoom() {
    const bg = $('castle-bg');
    bg.style.transform = '';
    bg.style.filter = '';
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
    $('chip-coins').addEventListener('click', () => { Sounds.click(); Shop.render('coins'); openPanel('panel-shop'); });
    $('chip-gems').addEventListener('click', () => { Sounds.click(); Shop.render('gems'); openPanel('panel-shop'); });
    $('castle-profile').addEventListener('click', () => { Sounds.click(); openPanel('panel-settings'); });
  }

  return { init, onEnter, openPanel, closeAllPanels, layout };
})();
