// الأصدقاء بالاسم المستخدم: إضافة، طلبات، شات
const Friends = (() => {
  let socket = null;
  let friends = [];
  let requests = [];
  let chatWith = null; // اسم المستخدم (lowercase)

  const $ = id => document.getElementById(id);

  function bindSocket(s) {
    socket = s;

    socket.on('friends:list', (data) => {
      friends = data.friends || [];
      requests = data.requests || [];
      render();
    });

    socket.on('friend:incoming', (p) => {
      Sounds.message();
      UI.toast(`📩 طلب صداقة من ${Online.esc(p.username)}`);
      render();
    });

    socket.on('chat:message', (msg) => {
      if (chatWith === msg.with) {
        appendMessage(msg);
      } else {
        Sounds.message();
        UI.toast(`💬 رسالة من ${Online.esc(msg.from)}`);
      }
    });
  }

  function init() {
    $('btn-add-friend').addEventListener('click', () => {
      const username = $('friend-name-input').value.trim();
      if (username.length < 3) return UI.toast('اكتب اسم المستخدم كاملاً', 'error');
      if (Profile.isGuest) return UI.toast('الأصدقاء يحتاجون حساب — سجل دخولك 👑', 'error');
      if (!Online.isConnected) return UI.toast('🔌 ما في اتصال بالسيرفر', 'error');
      socket.emit('friend:request', { username }, (res) => {
        if (res.error) return UI.toast(res.error, 'error');
        UI.toast(`📨 أرسلنا طلب صداقة لـ ${Online.esc(res.name)}`, 'success');
        $('friend-name-input').value = '';
      });
    });

    $('btn-chat-back').addEventListener('click', closeChat);
    $('btn-chat-send').addEventListener('click', sendMessage);
    $('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
  }

  function render() {
    const reqWrap = $('friend-requests');
    if (!reqWrap) return;
    $('friend-requests-wrap').classList.toggle('hidden', !requests.length);
    reqWrap.innerHTML = '';
    requests.forEach(p => {
      const d = document.createElement('div');
      d.className = 'friend-item';
      d.innerHTML = `<span class="chip-avatar">${p.avatar}</span>
        <div class="friend-meta"><span class="friend-name">${Online.esc(p.username)}</span><span class="friend-status">يريد صداقتك 🫶</span></div>`;
      const actions = document.createElement('div');
      actions.className = 'friend-actions';
      const ok = document.createElement('button');
      ok.className = 'btn-royal small'; ok.textContent = '✅';
      ok.addEventListener('click', (e) => { e.stopPropagation(); respond(p.username, true); });
      const no = document.createElement('button');
      no.className = 'btn-ghost-choco small'; no.textContent = '❌';
      no.addEventListener('click', (e) => { e.stopPropagation(); respond(p.username, false); });
      actions.append(ok, no);
      d.appendChild(actions);
      reqWrap.appendChild(d);
    });

    const wrap = $('friends-list');
    wrap.innerHTML = '';
    if (!friends.length) {
      wrap.innerHTML = '<p class="empty-hint">أضف أصدقاءك باسم المستخدم! 🫶</p>';
    }
    friends.forEach(p => {
      const d = document.createElement('div');
      d.className = 'friend-item';
      d.innerHTML = `<span class="chip-avatar">${p.avatar}</span>
        <div class="friend-meta">
          <span class="friend-name">${p.frame || ''} ${Online.esc(p.username)}</span>
          <span class="friend-status ${p.online ? 'online' : ''}">${p.online ? '🟢 متصل' : '⚪ غير متصل'} • 🏆 ${p.wins}</span>
        </div>
        <span style="font-size:20px">💬</span>`;
      d.addEventListener('click', () => openChat(p));
      wrap.appendChild(d);
    });
  }

  function respond(username, accept) {
    socket.emit('friend:respond', { username: username.toLowerCase(), accept });
    Sounds.click();
  }

  function openChat(friend) {
    chatWith = friend.username.toLowerCase();
    $('chat-with-name').textContent = friend.username;
    $('chat-with-avatar').textContent = friend.avatar;
    $('chat-messages').innerHTML = '';
    $('chat-panel').classList.remove('hidden');
    socket.emit('chat:history', { with: chatWith }, (res) => {
      (res.messages || []).forEach(appendMessage);
    });
  }

  function closeChat() {
    chatWith = null;
    $('chat-panel').classList.add('hidden');
  }

  function sendMessage() {
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text || !chatWith) return;
    socket.emit('chat:send', { to: chatWith, text });
    input.value = '';
  }

  function appendMessage(msg) {
    const me = msg.from === Profile.data.username;
    const d = document.createElement('div');
    d.className = 'chat-bubble ' + (me ? 'me' : 'them');
    const time = new Date(msg.ts).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    d.innerHTML = `${Online.esc(msg.text)}<span class="chat-time">${time}</span>`;
    const box = $('chat-messages');
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    if (me) Sounds.click();
  }

  return { init, bindSocket };
})();
