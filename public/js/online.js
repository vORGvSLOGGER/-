// الاتصال بالسيرفر: الحسابات، الرومات، مزامنة المعركة، المتصدرين
const Online = (() => {
  let socket = null;
  let connected = false;
  let currentRoom = null;
  let statusCb = null;
  let firstTry = true;

  const $ = id => document.getElementById(id);

  function onStatus(cb) { statusCb = cb; cb(connected ? 'online' : 'connecting'); }
  function emitStatus(s) { statusCb && statusCb(s); }

  function connect() {
    if (typeof io === 'undefined') { emitStatus('offline'); markOffline(true); return; }
    try { socket = io({ reconnectionAttempts: Infinity, timeout: 6000 }); }
    catch (e) { emitStatus('offline'); markOffline(true); return; }

    // لو ما اتصلنا خلال 5 ثواني نعلن الأوفلاين (يظهر زر الضيف)
    setTimeout(() => { if (!connected) { emitStatus('offline'); markOffline(true); } }, 5000);

    socket.on('connect', () => {
      connected = true;
      firstTry = false;
      emitStatus('online');
      markOffline(false);
    });
    socket.on('disconnect', () => { connected = false; emitStatus('offline'); markOffline(true); });
    socket.on('connect_error', () => { connected = false; if (!firstTry) emitStatus('offline'); });

    socket.on('auth:kicked', () => {
      UI.toast('⚠️ تم فتح حسابك من جهاز آخر');
    });

    socket.on('rooms:list', renderRooms);
    socket.on('room:playerJoined', ({ room }) => { currentRoom = room; Sounds.message(); renderLobby(); });
    socket.on('room:playerLeft', ({ username, room }) => { currentRoom = room; UI.toast(`🏃 ${esc(username || 'لاعب')} غادر الروم`); renderLobby(); });

    socket.on('battle:start', ({ room, seed, yourIndex, mode }) => {
      UI.closeAllModals();
      Castle.closeAllPanels();
      currentRoom = room;
      Battle.start({
        type: 'online', mode, seed, myIndex: yourIndex,
        onlinePlayers: room.players.map(p => ({ name: p.username, avatar: p.avatar, frame: p.frame })),
      });
    });
    socket.on('battle:event', (data) => Battle.onRemoteEvent(data));
    socket.on('battle:opponentLeft', () => Battle.opponentLeft());

    Friends.bindSocket(socket);
  }

  function markOffline(off) {
    const ids = ['online-offline-msg', 'friends-offline-msg'];
    ids.forEach(id => { const el = $(id); if (el) el.classList.toggle('hidden', !off); });
    if (off) {
      const pr = $('public-rooms');
      if (pr) pr.innerHTML = '<p class="empty-hint">🔌 الأونلاين يحتاج اتصال بالسيرفر</p>';
    }
  }

  // ===== الحسابات =====
  function register(d, cb) { socket.emit('auth:register', d, cb); }
  function login(username, code, cb) { socket.emit('auth:login', { username, code }, cb); }
  function recover(d, cb) { socket.emit('auth:recover', d, cb); }
  function syncProfile(data) { if (connected && !Profile.isGuest) socket.emit('profile:sync', data); }
  function getLeaderboard(cb) {
    if (!connected) return cb(null);
    socket.emit('leaderboard:get', {}, cb);
  }

  // ===== الرومات =====
  function renderRooms(list) {
    const wrap = $('public-rooms');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!list.length) {
      wrap.innerHTML = '<p class="empty-hint">لا توجد رومات عامة حالياً.. أنشئ واحدة! ✨</p>';
      return;
    }
    const modeLabel = { classic: '⚔️ كلاسيكي', blitz: '⚡ برق', sudden: '💀 مفاجئ' };
    list.forEach(r => {
      const d = document.createElement('div');
      d.className = 'room-item';
      d.innerHTML = `
        <div class="room-meta">
          <span class="room-name">${esc(r.name)}</span>
          <span class="room-sub">${modeLabel[r.mode] || r.mode} • 👤 ${esc(r.host)} • ${r.players}/2</span>
        </div>`;
      const btn = document.createElement('button');
      btn.className = 'btn-royal small';
      btn.textContent = 'انضم ⚔️';
      btn.addEventListener('click', () => joinRoom(r.code));
      d.appendChild(btn);
      wrap.appendChild(d);
    });
  }

  function guardOnline() {
    if (Profile.isGuest) { UI.toast('الأونلاين يحتاج حساب — سجل دخولك أولاً 👑', 'error'); return false; }
    if (!connected) { UI.toast('🔌 ما في اتصال بالسيرفر', 'error'); return false; }
    return true;
  }

  function createRoom(name, isPublic, mode) {
    if (!guardOnline()) return;
    socket.emit('room:create', { name, isPublic, mode }, (res) => {
      if (res.error) return UI.toast(res.error, 'error');
      currentRoom = res.room;
      UI.closeAllModals();
      openLobby();
    });
  }

  function joinRoom(code) {
    if (!guardOnline()) return;
    socket.emit('room:join', { code }, (res) => {
      if (res.error) return UI.toast(res.error, 'error');
      currentRoom = res.room;
      Sounds.turn();
      openLobby();
    });
  }

  function openLobby() { UI.openModal('modal-room-lobby'); renderLobby(); }

  function renderLobby() {
    if (!currentRoom) return;
    $('lobby-room-name').textContent = (currentRoom.isPublic ? '🌍 ' : '🔒 ') + currentRoom.name;
    $('lobby-room-code').textContent = currentRoom.code;
    const wrap = $('lobby-players');
    wrap.innerHTML = '';
    currentRoom.players.forEach(p => {
      const d = document.createElement('div');
      d.className = 'lobby-player';
      d.innerHTML = `<span class="chip-avatar">${p.avatar}</span><span>${esc(p.username)}</span>${p.username === currentRoom.host ? ' 👑' : ''}`;
      wrap.appendChild(d);
    });
    if (currentRoom.players.length < 2) {
      const d = document.createElement('div');
      d.className = 'lobby-player lobby-waiting';
      d.textContent = '⏳ بانتظار خصم...';
      wrap.appendChild(d);
    }
    const iAmHost = currentRoom.host === Profile.data.username;
    $('btn-lobby-start').classList.toggle('hidden', !(iAmHost && currentRoom.players.length >= 2));
  }

  function startRoom() { if (connected) socket.emit('room:start'); }
  function leaveRoom() { if (connected) socket.emit('room:leave'); currentRoom = null; }
  function sendEvent(data) { if (connected) socket.emit('battle:event', data); }
  function battleEnded() { if (connected) socket.emit('battle:end'); }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }

  return {
    connect, onStatus, register, login, recover, syncProfile, getLeaderboard,
    createRoom, joinRoom, startRoom, leaveRoom, sendEvent, battleEnded, esc,
    get socket() { return socket; },
    get isConnected() { return connected; },
  };
})();
