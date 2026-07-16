// المهام اليومية + صندوق الهدية اليومية
const Missions = (() => {
  const $ = id => document.getElementById(id);

  const DAILY = [
    { id: 'play2',    icon: '🎮', title: 'العب مباراتين',            target: 2,   reward: { coins: 40 } },
    { id: 'win1',     icon: '🏆', title: 'افز بمباراة واحدة',        target: 1,   reward: { coins: 80, gems: 1 } },
    { id: 'crush100', icon: '🍬', title: 'ادمج 100 حلوى',            target: 100, reward: { coins: 60 } },
    { id: 'combo3',   icon: '🔥', title: 'سوّ كومبو ×3 أو أكثر',     target: 1,   reward: { coins: 50, gems: 1 } },
  ];

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function storageKey() {
    return 'candywar_missions_' + (Profile.data?.username || 'guest');
  }

  let state = null;

  function load() {
    try { state = JSON.parse(localStorage.getItem(storageKey())); } catch (e) { state = null; }
    if (!state || state.day !== todayKey()) {
      state = { day: todayKey(), progress: {}, claimed: {} };
      persist();
    }
  }

  function persist() {
    try { localStorage.setItem(storageKey(), JSON.stringify(state)); } catch (e) {}
  }

  function checkDaily() { load(); }

  // تتبع الأحداث من المعركة: play / win / crush(n) / combo(step)
  function track(event, n = 1) {
    if (!state) load();
    if (state.day !== todayKey()) load();
    const map = { play: 'play2', win: 'win1', crush: 'crush100' };
    let id = map[event];
    if (event === 'combo' && n >= 3) id = 'combo3';
    if (!id) return;
    const m = DAILY.find(x => x.id === id);
    const cur = state.progress[id] || 0;
    if (cur >= m.target) return;
    state.progress[id] = Math.min(m.target, cur + (event === 'crush' ? n : 1));
    persist();
  }

  function render() {
    load();
    const wrap = $('missions-list');
    wrap.innerHTML = '';
    DAILY.forEach(m => {
      const cur = state.progress[m.id] || 0;
      const done = cur >= m.target;
      const claimed = state.claimed[m.id];
      const d = document.createElement('div');
      d.className = 'mission-row';
      const rewardTxt = `🪙${m.reward.coins}${m.reward.gems ? ' + 💎' + m.reward.gems : ''}`;
      d.innerHTML = `
        <span class="mission-icon">${m.icon}</span>
        <div class="mission-meta">
          <b>${m.title}</b>
          <div class="mission-bar"><div style="width:${Math.min(100, cur / m.target * 100)}%"></div></div>
          <small>${cur} / ${m.target} — الجائزة: ${rewardTxt}</small>
        </div>`;
      const btn = document.createElement('button');
      if (claimed) {
        btn.className = 'btn-buy equipped';
        btn.textContent = 'استلمت ✅';
        btn.disabled = true;
      } else if (done) {
        btn.className = 'btn-buy';
        btn.textContent = 'استلم 🎁';
        btn.addEventListener('click', () => {
          state.claimed[m.id] = true;
          persist();
          Profile.addCoins(m.reward.coins);
          if (m.reward.gems) Profile.addGems(m.reward.gems, true);
          Sounds.buy();
          UI.toast(`استلمت ${rewardTxt} 🎉`, 'success');
          render();
        });
      } else {
        btn.className = 'btn-buy';
        btn.textContent = 'أكملها 💪';
        btn.disabled = true;
      }
      d.appendChild(btn);
      wrap.appendChild(d);
    });
  }

  // ===== صندوق الهدية اليومية =====
  const GIFT = { coins: 100, gems: 2 };

  function renderGift() {
    const wrap = $('gift-body');
    const last = Profile.data.lastGift || 0;
    const now = Date.now();
    const canClaim = new Date(last).toDateString() !== new Date(now).toDateString();
    wrap.innerHTML = `<span class="gift-big">🎁</span>`;
    if (canClaim) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = `هديتك اليومية جاهزة: 🪙${GIFT.coins} + 💎${GIFT.gems}`;
      const btn = document.createElement('button');
      btn.className = 'btn-royal wide';
      btn.textContent = 'افتح الصندوق! ✨';
      btn.addEventListener('click', () => {
        Profile.data.lastGift = Date.now();
        Profile.addCoins(GIFT.coins);
        Profile.addGems(GIFT.gems, true);
        Sounds.win();
        UI.toast(`🎁 +🪙${GIFT.coins} +💎${GIFT.gems}`, 'success');
        renderGift();
      });
      wrap.append(p, btn);
    } else {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = '⏰ فتحت صندوق اليوم.. ارجع بكرة لهدية جديدة!';
      wrap.appendChild(p);
    }
  }

  return { checkDaily, track, render, renderGift };
})();
