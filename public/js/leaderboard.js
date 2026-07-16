// قائمة المتصدرين (عالمي / أصدقاء)
const Leaderboard = (() => {
  const $ = id => document.getElementById(id);
  let data = null;
  let tab = 'global';

  function init() {
    document.querySelectorAll('[data-lbtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        Sounds.click();
        tab = btn.dataset.lbtab;
        document.querySelectorAll('[data-lbtab]').forEach(b => b.classList.toggle('active', b.dataset.lbtab === tab));
        render();
      });
    });
  }

  function open() {
    Castle.openPanel('panel-leaderboard');
    $('lb-list').innerHTML = '<p class="empty-hint">... جاري التحميل</p>';
    $('lb-me').classList.add('hidden');
    if (Profile.isGuest && !Online.isConnected) {
      $('lb-list').innerHTML = '<p class="empty-hint">🔌 المتصدرين يحتاجون اتصال بالسيرفر وحساب مسجل</p>';
      return;
    }
    Online.getLeaderboard((res) => {
      if (!res) {
        $('lb-list').innerHTML = '<p class="empty-hint">🔌 ما قدرنا نجيب القائمة.. تأكد من الاتصال</p>';
        return;
      }
      data = res;
      render();
    });
  }

  function row(entry, isMe) {
    const d = document.createElement('div');
    d.className = 'lb-row' + (entry.rank <= 3 ? ' top' + entry.rank : '') + (isMe ? ' me' : '');
    const medal = entry.rank === 1 ? '👑' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank;
    d.innerHTML = `
      <span class="lb-rank">${medal}</span>
      <span class="chip-avatar">${entry.avatar}</span>
      <span class="lb-name">${entry.frame || ''} ${Online.esc(entry.username)}</span>
      <span class="lb-stat">🏆 ${entry.wins}</span>
      <span class="lb-stat" style="opacity:0.7">🎮 ${entry.games}</span>`;
    return d;
  }

  function render() {
    if (!data) return;
    const wrap = $('lb-list');
    wrap.innerHTML = '';
    const list = tab === 'global' ? data.global : data.friends;
    if (!list || !list.length) {
      wrap.innerHTML = `<p class="empty-hint">${tab === 'friends' ? 'أضف أصدقاء عشان تتنافسون! 👥' : 'لا يوجد لاعبون بعد.. كن الأول! 👑'}</p>`;
      return;
    }
    const myName = Profile.data.username;
    list.forEach(e => wrap.appendChild(row(e, e.username === myName)));

    // رتبتي
    const meBox = $('lb-me');
    if (tab === 'global' && data.myRank && !Profile.isGuest) {
      meBox.classList.remove('hidden');
      meBox.innerHTML = '';
      meBox.appendChild(row({
        rank: data.myRank, username: Profile.data.username + ' (رتبتك)',
        avatar: Profile.data.avatar, frame: Profile.data.frame,
        wins: Profile.data.wins, games: Profile.data.games,
      }, true));
    } else {
      meBox.classList.add('hidden');
    }
  }

  return { init, open };
})();
