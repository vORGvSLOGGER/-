// بروفايل اللاعب — مرتبط بالحساب على السيرفر، أو وضع الضيف محلياً
const Profile = (() => {
  const GUEST_KEY = 'candywar_guest_v2';

  let mode = 'guest'; // 'account' | 'guest'
  let data = null;

  const fresh = () => ({
    username: 'ضيف', avatar: '🍬', frame: '',
    coins: 200, gems: 5, wins: 0, games: 0, maxDamage: 0,
    boosters: { bomb: 1, time: 1, shuffle: 1, shield: 0 },
    ownedThemes: ['classic'], equippedTheme: 'classic',
    ownedAvatars: [], ownedFrames: [], lastGift: 0,
  });

  function loadGuest() {
    mode = 'guest';
    try { data = { ...fresh(), ...(JSON.parse(localStorage.getItem(GUEST_KEY)) || {}) }; }
    catch (e) { data = fresh(); }
    data.username = 'ضيف 👤';
    save();
  }

  function setAccount(profile) {
    mode = 'account';
    data = { ...fresh(), ...profile };
    render();
  }

  let syncTimer = null;
  function save() {
    if (mode === 'guest') {
      try { localStorage.setItem(GUEST_KEY, JSON.stringify(data)); } catch (e) {}
    } else {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => Online.syncProfile(data), 400);
    }
    render();
  }

  function render() {
    if (!data) return;
    const $ = id => document.getElementById(id);
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('c-username', data.username);
    set('c-avatar', data.avatar);
    set('c-wins', '🏆 ' + data.wins);
    set('c-coins', data.coins);
    set('c-gems', data.gems);
    set('shop-coins', data.coins);
    set('shop-gems', data.gems);
    set('set-username', data.username);
    set('set-avatar', data.avatar);
    set('set-stats', `🏆 ${data.wins} فوز • 🎮 ${data.games} مباراة • 💥 ${data.maxDamage} أعلى ضرر`);
  }

  function pop(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.parentElement.classList.remove('coin-pop');
    void el.parentElement.offsetWidth;
    el.parentElement.classList.add('coin-pop');
  }

  function addCoins(n, silent) {
    data.coins += n; save();
    if (!silent && n > 0) { Sounds.coin(); pop('c-coins'); }
  }
  function spendCoins(n) {
    if (data.coins < n) return false;
    data.coins -= n; save(); return true;
  }
  function addGems(n, silent) {
    data.gems += n; save();
    if (!silent && n > 0) { Sounds.coin(); pop('c-gems'); }
  }
  function spendGems(n) {
    if (data.gems < n) return false;
    data.gems -= n; save(); return true;
  }

  return {
    loadGuest, setAccount, save, render,
    addCoins, spendCoins, addGems, spendGems,
    get data() { return data; },
    get mode() { return mode; },
    get isGuest() { return mode === 'guest'; },
  };
})();
