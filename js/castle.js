// القصر: أماكن مبنية بالكود، تتكيف تلقائياً مع أي شاشة (CSS Grid — بدون سحب)
const Castle = (() => {
  const $ = id => document.getElementById(id);

  function openPanel(id) {
    document.querySelectorAll('.royal-overlay').forEach(p => p.classList.add('hidden'));
    $(id).classList.remove('hidden');
  }

  function closeAllPanels() {
    document.querySelectorAll('.royal-overlay').forEach(p => p.classList.add('hidden'));
  }

  // معاينة أفضل ٣ أبطال على لوحة المتصدرين في القصر
  function refreshLbPreview() {
    const box = $('lb-preview');
    if (!box) return;
    const medals = ['👑', '🥈', '🥉'];
    if (!Online.isConnected || Profile.isGuest) {
      box.innerHTML = medals.map(m => `<i>${m} —</i>`).join('');
      return;
    }
    Online.getLeaderboard((res) => {
      if (!res || !res.global) return;
      box.innerHTML = medals.map((m, i) => {
        const e = res.global[i];
        return `<i>${m} ${e ? Online.esc(e.username) : '—'}</i>`;
      }).join('');
    });
  }

  function onEnter() {
    Missions.checkDaily();
    refreshLbPreview();
  }

  function init() {
    const bind = (id, fn) => $(id).addEventListener('click', () => { Sounds.click(); fn(); });

    bind('pl-play', () => openPanel('panel-play'));
    bind('pl-bot', () => openPanel('panel-play'));
    bind('pl-local', () => Main.startLocalFlow());
    bind('pl-shop', () => { Shop.render(); openPanel('panel-shop'); });
    bind('pl-missions', () => { Missions.render(); openPanel('panel-missions'); });
    bind('pl-lb', () => Leaderboard.open());
    bind('pl-settings', () => openPanel('panel-settings'));
    bind('pl-gift', () => { Missions.renderGift(); openPanel('panel-gift'); });

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

  // layout() ما عادت مطلوبة (CSS يتكفل بالتكيف) — نبقيها للتوافق
  function layout() { refreshLbPreview(); }

  return { init, onEnter, openPanel, closeAllPanels, layout };
})();
