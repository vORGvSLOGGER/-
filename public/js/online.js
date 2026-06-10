// الاتصال بالسيرفر: الرومات، مزامنة المعركة، (الأصدقاء والشات في friends.js يستخدمون نفس الاتصال)
const Online = (() => {
  let socket = null;
  let connected = false;
  let currentRoom = null;

  const $ = id => document.getElementById(id);

  function connect() {
    if (typeof io === 'undefined') { setOffline(true); return; }
    try { socket = io({ reconnectionAttempts: Infinity, timeout: 5000 }); }
    catch (e) { setOffline(true); return; }

    socket.on('connect', () => {
      connected = true;
      setOffline(false);
      const p = Profile.data;
      socket.emit('player:register', { name: p.name, avatar: p.avatar, code: p.code });
    });

    socket.on('disconnect', () => { connected = false; setOffline(true); });
    socket.on('connect_error', () => { connected = false; setOffline(true); });

    socket.on('player:registered', ({ code }) => {
      Profile.data.code = code;
      Profile.save();
    });

    socket.on('rooms:list', renderRooms);

    socket.on('room:playerJoined', ({ room }) => {
      currentRoom = room;
      Sounds.message();
      renderLobby();
    });

    socket.on('room:playerLeft', ({ name, room }) => {
      currentRoom = room;
      UI.toast(`🏃 ${name} غادر الروم`);
      renderLobby();
    });

    socket.on('battle:start', ({ room, seed, yourIndex, mode }) => {
      UI.closeAllModals();
      currentRoom = room;
      Battle.start({
        type: 'online', mode, seed, myIndex: yourIndex,
        onlinePlayers: room.players.map(p => ({ name: p.name, avatar: p.avatar })),
      });
    });

    socket.on('battle:event', (data) => Battle.onRemoteEvent(data));
    socket.on('battle:opponentLeft', () => Battle.opponentLeft());

    Friends.bindSocket(socket);
  }

  function setOffline(off) {
    $('online-offline-msg').classList.toggle('hidden', !off);
    $('friends-offline-msg').classList.toggle('hidden', !off);
    if (off) $('public-rooms').innerHTML = '<p class="empty-hint">🔌 شغّل السيرفر بـ npm start عشان الأونلاين</p>';
  }

  function renderRooms(list) {
    const wrap = $('public-rooms');
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
          <span class="room-sub">${modeLabel[r.mode] || r.mode} • 👤 ${r.host} • ${r.players}/2</span>
        </div>`;
      const btn = document.createElement('button');
      btn.className = 'btn btn-small';
      btn.textContent = 'انضم ⚔️';
      btn.addEventListener('click', () => joinRoom(r.code));
      d.appendChild(btn);
      wrap.appendChild(d);
    });
  }

  function createRoom(name, isPublic, mode) {
    if (!connected) return UI.toast('🔌 ما في اتصال بالسيرفر', 'error');
    socket.emit('room:create', { name, isPublic, mode }, (res) => {
      if (res.error) return UI.toast(res.error, 'error');
      currentRoom = res.room;
      UI.closeAllModals();
      openLobby();
    });
  }

  function joinRoom(code) {
    if (!connected) return UI.toast('🔌 ما في اتصال بالسيرفر', 'error');
    socket.emit('room:join', { code }, (res) => {
      if (res.error) return UI.toast(res.error, 'error');
      currentRoom = res.room;
      Sounds.turn();
      openLobby();
    });
  }

  function openLobby() {
    UI.openModal('modal-room-lobby');
    renderLobby();
  }

  function renderLobby() {
    if (!currentRoom) return;
    $('lobby-room-name').textContent = (currentRoom.isPublic ? '🌍 ' : '🔒 ') + currentRoom.name;
    $('lobby-room-code').textContent = currentRoom.code;
    const wrap = $('lobby-players');
    wrap.innerHTML = '';
    currentRoom.players.forEach(p => {
      const d = document.createElement('div');
      d.className = 'lobby-player';
      d.innerHTML = `<span class="avatar-bubble small">${p.avatar}</span><span>${esc(p.name)}</span>${p.code === currentRoom.hostCode ? ' 👑' : ''}`;
      wrap.appendChild(d);
    });
    if (currentRoom.players.length < 2) {
      const d = document.createElement('div');
      d.className = 'lobby-player lobby-waiting';
      d.textContent = '⏳ بانتظار خصم...';
      wrap.appendChild(d);
    }
    const iAmHost = currentRoom.hostCode === Profile.data.code;
    $('btn-lobby-start').classList.toggle('hidden', !(iAmHost && currentRoom.players.length >= 2));
  }

  function startRoom() { if (connected) socket.emit('room:start'); }

  function leaveRoom() {
    if (connected) socket.emit('room:leave');
    currentRoom = null;
  }

  function sendEvent(data) { if (connected) socket.emit('battle:event', data); }
  function battleEnded() { if (connected) socket.emit('battle:end'); }

  function updateProfile() {
    if (connected) socket.emit('player:update', { name: Profile.data.name, avatar: Profile.data.avatar });
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  return {
    connect, createRoom, joinRoom, startRoom, leaveRoom, sendEvent, battleEnded, updateProfile,
    get socket() { return socket; },
    get isConnected() { return connected; },
    esc,
  };
})();
