// الأصدقاء: إضافة بالكود، طلبات الصداقة، الشات
const Friends = (() => {
  let socket = null;
  let friends = [];
  let requests = [];
  let chatWith = null; // كود الصديق المفتوح شاته
  let unread = 0;

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
      UI.toast(`📩 طلب صداقة من ${Online.esc(p.name)}`);
    });

    socket.on('chat:message', (msg) => {
      if (chatWith === msg.with) {
        appendMessage(msg);
      } else {
        unread++;
        updateBadge();
        Sounds.message();
        const f = friends.find(x => x.code === msg.with);
        UI.toast(`💬 رسالة من ${f ? Online.esc(f.name) : 'صديق'}`);
      }
    });
  }

  function init() {
    $('btn-add-friend').addEventListener('click', () => {
      const code = $('friend-code-input').value.trim().toUpperCase();
      if (code.length !== 6) return UI.toast('الكود لازم 6 أحرف/أرقام', 'error');
      if (!Online.isConnected) return UI.toast('🔌 ما في اتصال بالسيرفر', 'error');
      socket.emit('friend:request', { code }, (res) => {
        if (res.error) return UI.toast(res.error, 'error');
        UI.toast(`📨 أرسلنا طلب صداقة لـ ${Online.esc(res.name)}`, 'success');
        $('friend-code-input').value = '';
      });
    });

    $('btn-chat-back').addEventListener('click', closeChat);
    $('btn-chat-send').addEventListener('click', sendMessage);
    $('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
  }

  function render() {
    // طلبات الصداقة
    const reqWrap = $('friend-requests');
    $('friend-requests-wrap').classList.toggle('hidden', !requests.length);
    reqWrap.innerHTML = '';
    requests.forEach(p => {
      const d = document.createElement('div');
      d.className = 'friend-item';
      d.innerHTML = `<span class="avatar-bubble small">${p.avatar}</span>
        <div class="friend-meta"><span class="friend-name">${Online.esc(p.name)}</span><span class="friend-status">#${p.code}</span></div>`;
      const actions = document.createElement('div');
      actions.className = 'friend-actions';
      const ok = document.createElement('button');
      ok.className = 'btn btn-small'; ok.textContent = '✅';
      ok.addEventListener('click', (e) => { e.stopPropagation(); respond(p.code, true); });
      const no = document.createElement('button');
      no.className = 'btn btn-small btn-ghost'; no.textContent = '❌';
      no.addEventListener('click', (e) => { e.stopPropagation(); respond(p.code, false); });
      actions.append(ok, no);
      d.appendChild(actions);
      reqWrap.appendChild(d);
    });

    // قائمة الأصدقاء
    const wrap = $('friends-list');
    wrap.innerHTML = '';
    if (!friends.length) {
      wrap.innerHTML = '<p class="empty-hint">ما عندك أصدقاء بعد.. أضف صديق بكوده! 🫶</p>';
    }
    friends.forEach(p => {
      const d = document.createElement('div');
      d.className = 'friend-item';
      d.innerHTML = `<span class="avatar-bubble small">${p.avatar}</span>
        <div class="friend-meta">
          <span class="friend-name">${Online.esc(p.name)}</span>
          <span class="friend-status ${p.online ? 'online' : ''}">${p.online ? '🟢 متصل' : '⚪ غير متصل'} • #${p.code}</span>
        </div>
        <span style="font-size:20px">💬</span>`;
      d.addEventListener('click', () => openChat(p));
      wrap.appendChild(d);
    });

    updateBadge();
  }

  function respond(code, accept) {
    socket.emit('friend:respond', { code, accept });
    Sounds.click();
  }

  function openChat(friend) {
    chatWith = friend.code;
    unread = 0;
    updateBadge();
    $('chat-with-name').textContent = friend.name;
    $('chat-with-avatar').textContent = friend.avatar;
    $('chat-messages').innerHTML = '';
    $('chat-panel').classList.remove('hidden');
    socket.emit('chat:history', { with: friend.code }, (res) => {
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
    const me = msg.from === Profile.data.code;
    const d = document.createElement('div');
    d.className = 'chat-bubble ' + (me ? 'me' : 'them');
    const time = new Date(msg.ts).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    d.innerHTML = `${Online.esc(msg.text)}<span class="chat-time">${time}</span>`;
    const box = $('chat-messages');
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    if (me) Sounds.click();
  }

  function updateBadge() {
    const badge = $('nav-friends-badge');
    const n = unread + requests.length;
    badge.classList.toggle('hidden', n === 0);
    badge.textContent = n;
  }

  return { init, bindSocket };
})();
