// بروفايل اللاعب: الاسم، الأفاتار، العملات، الإحصائيات، الممتلكات (localStorage)
const Profile = (() => {
  const KEY = 'candywar_profile_v1';

  const FREE_AVATARS = ['🍬', '🍭', '🍩', '🧁', '🍫', '🍪', '🍓', '🍉', '🐼', '🐸', '⭐', '🔥'];

  const defaults = () => ({
    name: 'لاعب ' + Math.floor(Math.random() * 900 + 100),
    avatar: '🍬',
    code: null,           // كود الصداقة (يثبته السيرفر أول اتصال)
    coins: 150,           // هدية البداية
    wins: 0,
    games: 0,
    maxDamage: 0,
    boosters: { bomb: 1, time: 1, shuffle: 1, shield: 0 }, // هدايا بداية
    ownedThemes: ['classic'],
    equippedTheme: 'classic',
    ownedAvatars: [],
  });

  let data = null;

  function load() {
    try {
      data = { ...defaults(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
      data.boosters = { ...defaults().boosters, ...(data.boosters || {}) };
    } catch (e) { data = defaults(); }
    save();
    return data;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    renderTopbar();
  }

  function renderTopbar() {
    const $ = id => document.getElementById(id);
    if (!$('top-name')) return;
    $('top-name').textContent = data.name;
    $('top-avatar').textContent = data.avatar;
    $('top-code').textContent = data.code ? '#' + data.code : '#------';
    $('top-trophy').textContent = '🏆 ' + data.wins;
    $('top-coins').textContent = '🪙 ' + data.coins;
    const sc = $('shop-coins');
    if (sc) sc.textContent = '🪙 ' + data.coins;
  }

  function addCoins(n, silent) {
    data.coins += n;
    save();
    if (!silent && n > 0) {
      Sounds.coin();
      const el = document.getElementById('top-coins');
      el.classList.remove('coin-pop'); void el.offsetWidth; el.classList.add('coin-pop');
    }
  }

  function spendCoins(n) {
    if (data.coins < n) return false;
    data.coins -= n;
    save();
    return true;
  }

  return {
    load, save, addCoins, spendCoins, renderTopbar,
    get data() { return data; },
    FREE_AVATARS,
    allAvatars() { return [...FREE_AVATARS, ...data.ownedAvatars]; },
  };
})();
