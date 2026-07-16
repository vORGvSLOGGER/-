// سيرفر حرب الحلويات - Express + Socket.IO
// يدير: الحسابات (تسجيل/دخول/استرجاع)، الرومات، مزامنة المعارك، الأصدقاء، الشات، المتصدرين
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 1e5 });

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'accounts.json');

// ===== الحسابات (مخزنة في ملف) =====
// accounts: usernameLower -> {username, email, salt, codeHash, birthdate, country, city,
//   createdAt, avatar, frame, coins, gems, wins, games, maxDamage,
//   boosters, ownedThemes, equippedTheme, ownedAvatars, ownedFrames, friends:[usernameLower], lastGift}
let accounts = {};
try { accounts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { accounts = {}; }

let saveTimer = null;
function saveAccounts() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(DATA_FILE, JSON.stringify(accounts), () => {});
  }, 300);
}

function hashCode(code, salt) {
  return crypto.scryptSync(String(code), salt, 32).toString('hex');
}

const USERNAME_RE = /^[ء-يa-zA-Z0-9_]{3,16}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE_RE = /^\d{6}$/;

function publicProfile(acc) {
  return {
    username: acc.username, avatar: acc.avatar, frame: acc.frame,
    coins: acc.coins, gems: acc.gems, wins: acc.wins, games: acc.games, maxDamage: acc.maxDamage,
    boosters: acc.boosters, ownedThemes: acc.ownedThemes, equippedTheme: acc.equippedTheme,
    ownedAvatars: acc.ownedAvatars, ownedFrames: acc.ownedFrames, lastGift: acc.lastGift || 0,
  };
}

// ===== الحالة اللحظية =====
// players: socketId -> { username (key lower), socketId, roomCode }
const players = new Map();
const playersByName = new Map(); // usernameLower -> player
const rooms = new Map();
const friendRequests = new Map(); // usernameLower -> Set(fromLower)
const chats = new Map();

const MODES = { classic: 1, blitz: 1, sudden: 1 };

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(s) ? genRoomCode() : s;
}

function chatKey(a, b) { return [a, b].sort().join('|'); }

function accOf(player) { return player ? accounts[player.username] : null; }

function publicRoomList() {
  return [...rooms.values()]
    .filter(r => r.isPublic && r.state === 'waiting')
    .map(r => ({ code: r.code, name: r.name, mode: r.mode, players: r.players.length, host: accounts[r.hostName]?.username || '؟' }));
}
function broadcastRooms() { io.emit('rooms:list', publicRoomList()); }

function friendPayload(unameLower) {
  const acc = accounts[unameLower];
  return {
    username: acc ? acc.username : unameLower,
    avatar: acc ? acc.avatar : '🍬',
    frame: acc ? acc.frame : '',
    wins: acc ? acc.wins : 0,
    online: playersByName.has(unameLower),
  };
}

function sendFriendsList(unameLower) {
  const p = playersByName.get(unameLower);
  if (!p) return;
  const acc = accounts[unameLower];
  const reqs = friendRequests.get(unameLower) || new Set();
  io.to(p.socketId).emit('friends:list', {
    friends: (acc.friends || []).map(friendPayload),
    requests: [...reqs].map(friendPayload),
  });
}

function notifyFriendsStatus(unameLower) {
  const acc = accounts[unameLower];
  if (!acc) return;
  for (const f of acc.friends || []) sendFriendsList(f);
}

function roomInfo(room) {
  return {
    code: room.code, name: room.name, isPublic: room.isPublic, mode: room.mode,
    host: accounts[room.hostName]?.username, state: room.state,
    players: room.players.map(u => {
      const a = accounts[u];
      return { username: a?.username || u, avatar: a?.avatar || '🍬', frame: a?.frame || '' };
    }),
  };
}

function leaveRoom(player, reason) {
  if (!player.roomCode) return;
  const room = rooms.get(player.roomCode);
  player.roomCode = null;
  if (!room) return;
  room.players = room.players.filter(u => u !== player.username);
  if (room.players.length === 0) {
    rooms.delete(room.code);
  } else {
    if (room.hostName === player.username) room.hostName = room.players[0];
    for (const u of room.players) {
      const pl = playersByName.get(u);
      if (pl) io.to(pl.socketId).emit('room:playerLeft', { username: accounts[player.username]?.username, reason, room: roomInfo(room) });
    }
    if (room.state === 'battle' && room.players.length === 1) {
      const winner = playersByName.get(room.players[0]);
      if (winner) io.to(winner.socketId).emit('battle:opponentLeft');
      room.state = 'waiting';
    }
  }
  broadcastRooms();
}

io.on('connection', (socket) => {
  // ================= الحسابات =================
  socket.on('auth:register', (d, cb) => {
    if (!cb) return;
    try {
      const email = String(d.email || '').trim().toLowerCase();
      const username = String(d.username || '').trim();
      const code = String(d.code || '');
      const birthdate = String(d.birthdate || '');
      const country = String(d.country || '').slice(0, 30);
      const city = String(d.city || '').slice(0, 40);

      if (!EMAIL_RE.test(email)) return cb({ error: 'البريد الإلكتروني غير صحيح 📧' });
      if (!USERNAME_RE.test(username)) return cb({ error: 'اسم المستخدم: 3-16 حرف (عربي/إنجليزي/أرقام/_) بدون مسافات' });
      if (!CODE_RE.test(code)) return cb({ error: 'رمز الدخول لازم يكون 6 أرقام بالضبط 🔢' });
      const bd = new Date(birthdate);
      const age = (Date.now() - bd.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (isNaN(bd.getTime()) || age < 7 || age > 100) return cb({ error: 'تاريخ الميلاد غير صحيح 🎂' });
      if (!country) return cb({ error: 'اختر دولتك 🌍' });
      if (!city) return cb({ error: 'اختر مدينتك 🏙️' });
      if (!d.agreed) return cb({ error: 'لازم توافق على الشروط وسياسة الاستخدام ✅' });

      const key = username.toLowerCase();
      if (accounts[key]) return cb({ error: 'اسم المستخدم محجوز، جرب غيره 😅' });
      if (Object.values(accounts).some(a => a.email === email)) return cb({ error: 'هذا البريد مسجل بحساب من قبل 📧' });

      const salt = crypto.randomBytes(16).toString('hex');
      accounts[key] = {
        username, email, salt, codeHash: hashCode(code, salt),
        birthdate, country, city, createdAt: Date.now(),
        avatar: '🍬', frame: '', coins: 200, gems: 5,
        wins: 0, games: 0, maxDamage: 0,
        boosters: { bomb: 1, time: 1, shuffle: 1, shield: 0 },
        ownedThemes: ['classic'], equippedTheme: 'classic',
        ownedAvatars: [], ownedFrames: [], friends: [], lastGift: 0,
      };
      saveAccounts();
      bindSocket(key);
      cb({ ok: true, profile: publicProfile(accounts[key]) });
    } catch (e) { cb({ error: 'صار خطأ غير متوقع، حاول مرة ثانية' }); }
  });

  socket.on('auth:login', (d, cb) => {
    if (!cb) return;
    const key = String(d.username || '').trim().toLowerCase();
    const code = String(d.code || '');
    const acc = accounts[key];
    if (!acc || !CODE_RE.test(code) || hashCode(code, acc.salt) !== acc.codeHash) {
      return cb({ error: 'اسم المستخدم أو رمز الدخول غير صحيح ❌' });
    }
    bindSocket(key);
    cb({ ok: true, profile: publicProfile(acc) });
  });

  socket.on('auth:recover', (d, cb) => {
    if (!cb) return;
    const key = String(d.username || '').trim().toLowerCase();
    const acc = accounts[key];
    const email = String(d.email || '').trim().toLowerCase();
    const birthdate = String(d.birthdate || '');
    const country = String(d.country || '');
    const city = String(d.city || '');
    const newCode = String(d.newCode || '');
    if (!acc) return cb({ error: 'ما لقينا حساب بهذا الاسم' });
    if (acc.email !== email || acc.birthdate !== birthdate || acc.country !== country || acc.city !== city) {
      return cb({ error: 'بيانات الاسترجاع ما تطابق المسجلة عندنا ❌' });
    }
    if (!CODE_RE.test(newCode)) return cb({ error: 'الرمز الجديد لازم 6 أرقام' });
    acc.salt = crypto.randomBytes(16).toString('hex');
    acc.codeHash = hashCode(newCode, acc.salt);
    saveAccounts();
    cb({ ok: true });
  });

  function bindSocket(key) {
    // افصل أي جلسة قديمة لنفس الحساب
    const old = playersByName.get(key);
    if (old && old.socketId !== socket.id) {
      io.to(old.socketId).emit('auth:kicked');
      players.delete(old.socketId);
    }
    const player = { username: key, socketId: socket.id, roomCode: null };
    players.set(socket.id, player);
    playersByName.set(key, player);
    socket.emit('rooms:list', publicRoomList());
    sendFriendsList(key);
    notifyFriendsStatus(key);
  }

  // مزامنة حالة الحساب (عملات/جواهر/إحصائيات/مشتريات) — نسخة مبسطة موثوقة من العميل
  socket.on('profile:sync', (d) => {
    const p = players.get(socket.id);
    const acc = accOf(p);
    if (!acc || !d) return;
    const nums = ['coins', 'gems', 'wins', 'games', 'maxDamage'];
    for (const k of nums) if (typeof d[k] === 'number' && isFinite(d[k])) acc[k] = Math.max(0, Math.floor(d[k]));
    if (typeof d.avatar === 'string') acc.avatar = d.avatar.slice(0, 4);
    if (typeof d.frame === 'string') acc.frame = d.frame.slice(0, 4);
    if (typeof d.equippedTheme === 'string') acc.equippedTheme = d.equippedTheme.slice(0, 20);
    if (d.boosters && typeof d.boosters === 'object') {
      for (const k of ['bomb', 'time', 'shuffle', 'shield']) {
        if (typeof d.boosters[k] === 'number') acc.boosters[k] = Math.max(0, Math.floor(d.boosters[k]));
      }
    }
    for (const k of ['ownedThemes', 'ownedAvatars', 'ownedFrames']) {
      if (Array.isArray(d[k])) acc[k] = d[k].slice(0, 50).map(x => String(x).slice(0, 20));
    }
    if (typeof d.lastGift === 'number') acc.lastGift = d.lastGift;
    saveAccounts();
  });

  // ================= المتصدرين =================
  socket.on('leaderboard:get', (d, cb) => {
    if (!cb) return;
    const p = players.get(socket.id);
    const acc = accOf(p);
    const all = Object.values(accounts)
      .sort((a, b) => b.wins - a.wins || b.maxDamage - a.maxDamage)
      .slice(0, 50)
      .map((a, i) => ({ rank: i + 1, username: a.username, avatar: a.avatar, frame: a.frame, wins: a.wins, games: a.games }));
    let myRank = null;
    if (acc) {
      const sorted = Object.values(accounts).sort((a, b) => b.wins - a.wins || b.maxDamage - a.maxDamage);
      myRank = sorted.findIndex(a => a.username === acc.username) + 1;
    }
    // متصدرو الأصدقاء
    let friends = [];
    if (acc) {
      friends = [acc.username.toLowerCase(), ...(acc.friends || [])]
        .map(u => accounts[u]).filter(Boolean)
        .sort((a, b) => b.wins - a.wins)
        .map((a, i) => ({ rank: i + 1, username: a.username, avatar: a.avatar, frame: a.frame, wins: a.wins, games: a.games }));
    }
    cb({ global: all, friends, myRank });
  });

  // ================= الرومات =================
  socket.on('room:create', ({ name, isPublic, mode }, cb) => {
    const p = players.get(socket.id);
    const acc = accOf(p);
    if (!acc) return cb && cb({ error: 'سجّل دخولك أولاً' });
    leaveRoom(p, 'switch');
    const room = {
      code: genRoomCode(),
      name: String(name || `روم ${acc.username}`).slice(0, 30),
      isPublic: !!isPublic,
      mode: MODES[mode] ? mode : 'classic',
      hostName: p.username, players: [p.username], state: 'waiting', seed: null,
    };
    rooms.set(room.code, room);
    p.roomCode = room.code;
    cb && cb({ room: roomInfo(room) });
    broadcastRooms();
  });

  socket.on('room:join', ({ code }, cb) => {
    const p = players.get(socket.id);
    const acc = accOf(p);
    if (!acc) return cb && cb({ error: 'سجّل دخولك أولاً' });
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) return cb && cb({ error: 'الروم غير موجود ❌' });
    if (room.state !== 'waiting') return cb && cb({ error: 'المعركة بدأت بالفعل ⚔️' });
    if (room.players.length >= 2) return cb && cb({ error: 'الروم ممتلئ 👥' });
    leaveRoom(p, 'switch');
    room.players.push(p.username);
    p.roomCode = room.code;
    cb && cb({ room: roomInfo(room) });
    for (const u of room.players) {
      const pl = playersByName.get(u);
      if (pl && pl.socketId !== socket.id) io.to(pl.socketId).emit('room:playerJoined', { room: roomInfo(room) });
    }
    broadcastRooms();
  });

  socket.on('room:leave', () => {
    const p = players.get(socket.id);
    if (p) leaveRoom(p, 'left');
  });

  socket.on('room:start', () => {
    const p = players.get(socket.id);
    if (!p || !p.roomCode) return;
    const room = rooms.get(p.roomCode);
    if (!room || room.hostName !== p.username || room.players.length < 2) return;
    room.state = 'battle';
    room.seed = Math.floor(Math.random() * 2 ** 31);
    const info = roomInfo(room);
    room.players.forEach((u, idx) => {
      const pl = playersByName.get(u);
      if (pl) io.to(pl.socketId).emit('battle:start', { room: info, seed: room.seed, yourIndex: idx, mode: room.mode });
    });
    broadcastRooms();
  });

  socket.on('battle:event', (data) => {
    const p = players.get(socket.id);
    if (!p || !p.roomCode) return;
    const room = rooms.get(p.roomCode);
    if (!room) return;
    for (const u of room.players) {
      const pl = playersByName.get(u);
      if (pl && pl.socketId !== socket.id) io.to(pl.socketId).emit('battle:event', data);
    }
  });

  socket.on('battle:end', () => {
    const p = players.get(socket.id);
    if (!p || !p.roomCode) return;
    const room = rooms.get(p.roomCode);
    if (room) { room.state = 'waiting'; broadcastRooms(); }
  });

  // ================= الأصدقاء (بالاسم المستخدم) =================
  socket.on('friend:request', ({ username }, cb) => {
    const p = players.get(socket.id);
    const acc = accOf(p);
    if (!acc) return cb && cb({ error: 'سجّل دخولك أولاً' });
    const target = String(username || '').trim().toLowerCase();
    if (target === p.username) return cb && cb({ error: 'هذا أنت 😅' });
    const tAcc = accounts[target];
    if (!tAcc) return cb && cb({ error: 'ما لقينا لاعب بهذا الاسم' });
    if ((acc.friends || []).includes(target)) return cb && cb({ error: 'صديقك بالفعل ✅' });
    if (!friendRequests.has(target)) friendRequests.set(target, new Set());
    friendRequests.get(target).add(p.username);
    sendFriendsList(target);
    const tp = playersByName.get(target);
    if (tp) io.to(tp.socketId).emit('friend:incoming', friendPayload(p.username));
    cb && cb({ ok: true, name: tAcc.username });
  });

  socket.on('friend:respond', ({ username, accept }) => {
    const p = players.get(socket.id);
    const acc = accOf(p);
    if (!acc) return;
    const from = String(username || '').trim().toLowerCase();
    const reqs = friendRequests.get(p.username);
    if (!reqs || !reqs.has(from)) return;
    reqs.delete(from);
    if (accept && accounts[from]) {
      acc.friends = acc.friends || [];
      accounts[from].friends = accounts[from].friends || [];
      if (!acc.friends.includes(from)) acc.friends.push(from);
      if (!accounts[from].friends.includes(p.username)) accounts[from].friends.push(p.username);
      saveAccounts();
    }
    sendFriendsList(p.username);
    sendFriendsList(from);
  });

  // ================= الشات =================
  socket.on('chat:send', ({ to, text }) => {
    const p = players.get(socket.id);
    const acc = accOf(p);
    if (!acc) return;
    const target = String(to || '').trim().toLowerCase();
    if (!(acc.friends || []).includes(target)) return;
    const msg = { from: acc.username, text: String(text || '').slice(0, 300), ts: Date.now() };
    const key = chatKey(p.username, target);
    if (!chats.has(key)) chats.set(key, []);
    const hist = chats.get(key);
    hist.push(msg);
    if (hist.length > 100) hist.shift();
    socket.emit('chat:message', { with: target, ...msg });
    const tp = playersByName.get(target);
    if (tp) io.to(tp.socketId).emit('chat:message', { with: p.username, ...msg });
  });

  socket.on('chat:history', ({ with: other }, cb) => {
    const p = players.get(socket.id);
    if (!p) return cb && cb({ messages: [] });
    cb && cb({ messages: chats.get(chatKey(p.username, String(other || '').toLowerCase())) || [] });
  });

  socket.on('disconnect', () => {
    const p = players.get(socket.id);
    if (!p) return;
    leaveRoom(p, 'disconnect');
    players.delete(socket.id);
    if (playersByName.get(p.username)?.socketId === socket.id) playersByName.delete(p.username);
    notifyFriendsStatus(p.username);
  });
});

server.listen(PORT, () => {
  console.log(`🍬 حرب الحلويات شغالة على http://localhost:${PORT}`);
});
