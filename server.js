// سيرفر حرب الحلويات - Express + Socket.IO
// يدير: الرومات (عامة/خاصة)، مزامنة المعارك أونلاين، الأصدقاء، الشات
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// ===== الحالة في الذاكرة =====
// players: socketId -> { id, code, name, avatar, socketId, status: 'lobby'|'room'|'battle' }
const players = new Map();
// playersByCode: friendCode -> player
const playersByCode = new Map();
// rooms: roomCode -> { code, name, isPublic, mode, hostCode, players: [playerCode], state, seed }
const rooms = new Map();
// friendships: playerCode -> Set(friendCode)
const friendships = new Map();
// pending friend requests: targetCode -> Set(fromCode)
const friendRequests = new Map();
// chat history: key "A|B" (sorted) -> [{from, text, ts}]
const chats = new Map();

const MODES = { classic: { time: 30, hp: 120 }, blitz: { time: 15, hp: 90 }, sudden: { time: 30, hp: 40 } };

function genCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function chatKey(a, b) { return [a, b].sort().join('|'); }

function publicRoomList() {
  return [...rooms.values()]
    .filter(r => r.isPublic && r.state === 'waiting')
    .map(r => ({
      code: r.code, name: r.name, mode: r.mode,
      players: r.players.length, host: playersByCode.get(r.hostCode)?.name || '؟'
    }));
}

function broadcastRooms() { io.emit('rooms:list', publicRoomList()); }

function friendPayload(code) {
  const p = playersByCode.get(code);
  return { code, name: p ? p.name : 'لاعب', avatar: p ? p.avatar : '🍬', online: !!p };
}

function sendFriendsList(player) {
  const set = friendships.get(player.code) || new Set();
  const reqs = friendRequests.get(player.code) || new Set();
  io.to(player.socketId).emit('friends:list', {
    friends: [...set].map(friendPayload),
    requests: [...reqs].map(friendPayload)
  });
}

function notifyFriendsStatus(player) {
  const set = friendships.get(player.code) || new Set();
  for (const fc of set) {
    const f = playersByCode.get(fc);
    if (f) sendFriendsList(f);
  }
}

function leaveRoom(player, reason) {
  if (!player.roomCode) return;
  const room = rooms.get(player.roomCode);
  player.roomCode = null;
  if (!room) return;
  room.players = room.players.filter(c => c !== player.code);
  if (room.players.length === 0) {
    rooms.delete(room.code);
  } else {
    if (room.hostCode === player.code) room.hostCode = room.players[0];
    for (const c of room.players) {
      const p = playersByCode.get(c);
      if (p) io.to(p.socketId).emit('room:playerLeft', { code: player.code, name: player.name, reason, room: roomInfo(room) });
    }
    // إذا كانت المعركة شغالة وانسحب لاعب → الباقي يفوز
    if (room.state === 'battle' && room.players.length === 1) {
      const winner = playersByCode.get(room.players[0]);
      if (winner) io.to(winner.socketId).emit('battle:opponentLeft');
      room.state = 'waiting';
    }
  }
  broadcastRooms();
}

function roomInfo(room) {
  return {
    code: room.code, name: room.name, isPublic: room.isPublic, mode: room.mode,
    hostCode: room.hostCode, state: room.state,
    players: room.players.map(c => {
      const p = playersByCode.get(c);
      return { code: c, name: p?.name || 'لاعب', avatar: p?.avatar || '🍬' };
    })
  };
}

io.on('connection', (socket) => {
  // ===== تسجيل اللاعب =====
  socket.on('player:register', ({ name, avatar, code }) => {
    // اللاعب يحتفظ بكوده من localStorage حتى يتعرف عليه أصدقاؤه
    let friendCode = (code && /^[A-Z2-9]{6}$/.test(code)) ? code : genCode();
    // لو الكود مستخدم من اتصال آخر نشط، افصل القديم
    const existing = playersByCode.get(friendCode);
    if (existing && existing.socketId !== socket.id) {
      players.delete(existing.socketId);
    }
    const player = {
      code: friendCode,
      name: String(name || 'لاعب').slice(0, 20),
      avatar: String(avatar || '🍬').slice(0, 4),
      socketId: socket.id,
      roomCode: null
    };
    players.set(socket.id, player);
    playersByCode.set(friendCode, player);
    socket.emit('player:registered', { code: friendCode });
    socket.emit('rooms:list', publicRoomList());
    sendFriendsList(player);
    notifyFriendsStatus(player);
  });

  socket.on('player:update', ({ name, avatar }) => {
    const p = players.get(socket.id);
    if (!p) return;
    if (name) p.name = String(name).slice(0, 20);
    if (avatar) p.avatar = String(avatar).slice(0, 4);
    notifyFriendsStatus(p);
    broadcastRooms();
  });

  // ===== الرومات =====
  socket.on('room:create', ({ name, isPublic, mode }, cb) => {
    const p = players.get(socket.id);
    if (!p) return cb && cb({ error: 'غير مسجل' });
    leaveRoom(p, 'switch');
    const room = {
      code: genCode(),
      name: String(name || `روم ${p.name}`).slice(0, 30),
      isPublic: !!isPublic,
      mode: MODES[mode] ? mode : 'classic',
      hostCode: p.code,
      players: [p.code],
      state: 'waiting',
      seed: null
    };
    rooms.set(room.code, room);
    p.roomCode = room.code;
    cb && cb({ room: roomInfo(room) });
    broadcastRooms();
  });

  socket.on('room:join', ({ code }, cb) => {
    const p = players.get(socket.id);
    if (!p) return cb && cb({ error: 'غير مسجل' });
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) return cb && cb({ error: 'الروم غير موجود ❌' });
    if (room.state !== 'waiting') return cb && cb({ error: 'المعركة بدأت بالفعل ⚔️' });
    if (room.players.length >= 2) return cb && cb({ error: 'الروم ممتلئ 👥' });
    leaveRoom(p, 'switch');
    room.players.push(p.code);
    p.roomCode = room.code;
    cb && cb({ room: roomInfo(room) });
    // أبلغ الجميع في الروم
    for (const c of room.players) {
      const pl = playersByCode.get(c);
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
    if (!room || room.hostCode !== p.code || room.players.length < 2) return;
    room.state = 'battle';
    room.seed = Math.floor(Math.random() * 2 ** 31);
    const info = roomInfo(room);
    room.players.forEach((c, idx) => {
      const pl = playersByCode.get(c);
      if (pl) io.to(pl.socketId).emit('battle:start', { room: info, seed: room.seed, yourIndex: idx, mode: room.mode });
    });
    broadcastRooms();
  });

  // مزامنة الحركات: صاحب الدور يرسل حركته (أو أي حدث معركة) فتُبث للخصم
  socket.on('battle:event', (data) => {
    const p = players.get(socket.id);
    if (!p || !p.roomCode) return;
    const room = rooms.get(p.roomCode);
    if (!room) return;
    for (const c of room.players) {
      const pl = playersByCode.get(c);
      if (pl && pl.socketId !== socket.id) io.to(pl.socketId).emit('battle:event', data);
    }
  });

  socket.on('battle:end', () => {
    const p = players.get(socket.id);
    if (!p || !p.roomCode) return;
    const room = rooms.get(p.roomCode);
    if (room) { room.state = 'waiting'; broadcastRooms(); }
  });

  // ===== الأصدقاء =====
  socket.on('friend:request', ({ code }, cb) => {
    const p = players.get(socket.id);
    if (!p) return cb && cb({ error: 'غير مسجل' });
    const target = String(code || '').toUpperCase().trim();
    if (target === p.code) return cb && cb({ error: 'هذا كودك أنت 😅' });
    const friend = playersByCode.get(target);
    if (!friend) return cb && cb({ error: 'ما لقينا لاعب بهذا الكود (لازم يكون متصل)' });
    const mySet = friendships.get(p.code) || new Set();
    if (mySet.has(target)) return cb && cb({ error: 'صديقك بالفعل ✅' });
    if (!friendRequests.has(target)) friendRequests.set(target, new Set());
    friendRequests.get(target).add(p.code);
    sendFriendsList(friend);
    io.to(friend.socketId).emit('friend:incoming', friendPayload(p.code));
    cb && cb({ ok: true, name: friend.name });
  });

  socket.on('friend:respond', ({ code, accept }) => {
    const p = players.get(socket.id);
    if (!p) return;
    const reqs = friendRequests.get(p.code);
    if (!reqs || !reqs.has(code)) return;
    reqs.delete(code);
    if (accept) {
      if (!friendships.has(p.code)) friendships.set(p.code, new Set());
      if (!friendships.has(code)) friendships.set(code, new Set());
      friendships.get(p.code).add(code);
      friendships.get(code).add(p.code);
    }
    sendFriendsList(p);
    const other = playersByCode.get(code);
    if (other) sendFriendsList(other);
  });

  // ===== الشات =====
  socket.on('chat:send', ({ to, text }) => {
    const p = players.get(socket.id);
    if (!p) return;
    const set = friendships.get(p.code);
    if (!set || !set.has(to)) return; // الشات للأصدقاء فقط
    const msg = { from: p.code, text: String(text || '').slice(0, 300), ts: Date.now() };
    const key = chatKey(p.code, to);
    if (!chats.has(key)) chats.set(key, []);
    const hist = chats.get(key);
    hist.push(msg);
    if (hist.length > 100) hist.shift();
    socket.emit('chat:message', { with: to, ...msg });
    const friend = playersByCode.get(to);
    if (friend) io.to(friend.socketId).emit('chat:message', { with: p.code, ...msg });
  });

  socket.on('chat:history', ({ with: other }, cb) => {
    const p = players.get(socket.id);
    if (!p) return cb && cb({ messages: [] });
    cb && cb({ messages: chats.get(chatKey(p.code, other)) || [] });
  });

  socket.on('disconnect', () => {
    const p = players.get(socket.id);
    if (!p) return;
    leaveRoom(p, 'disconnect');
    players.delete(socket.id);
    if (playersByCode.get(p.code)?.socketId === socket.id) playersByCode.delete(p.code);
    notifyFriendsStatus(p);
  });
});

server.listen(PORT, () => {
  console.log(`🍬 حرب الحلويات شغالة على http://localhost:${PORT}`);
});
