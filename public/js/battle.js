// منطق المعركة: الأدوار، المؤقت، الضرر، طبقات الصحة، الفوز/الخسارة
// أنواع التحكم: 'me' (أنا)، 'cpu' (كمبيوتر)، 'remote' (خصم أونلاين)، 'hotseat' (محلي بالتناوب)

const GAME_MODES = {
  classic: { label: '⚔️ الكلاسيكي', time: 30, layers: [40, 40, 40] },
  blitz:   { label: '⚡ البرق',     time: 15, layers: [30, 30, 30] },
  sudden:  { label: '💀 الموت المفاجئ', time: 30, layers: [40] },
};

const Battle = (() => {
  let S = null; // حالة المعركة

  const $ = id => document.getElementById(id);

  function layersOf(mode) { return GAME_MODES[mode].layers; }
  function maxHpOf(mode) { return layersOf(mode).reduce((a, b) => a + b, 0); }

  /**
   * config = {
   *   type: 'cpu' | 'local' | 'online',
   *   mode: 'classic' | 'blitz' | 'sudden',
   *   difficulty?, localCount?, seed?, myIndex?, onlinePlayers? [{name, avatar}]
   * }
   */
  function start(config) {
    const mode = GAME_MODES[config.mode] ? config.mode : 'classic';
    const maxHp = maxHpOf(mode);
    const me = Profile.data;
    let players = [];

    if (config.type === 'cpu') {
      const diffName = { easy: '🤖 بوت سهل', medium: '🤖 بوت متوسط', hard: '😈 بوت شرير' }[config.difficulty];
      players = [
        { name: me.username, avatar: me.avatar, control: 'me' },
        { name: diffName, avatar: config.difficulty === 'hard' ? '😈' : '🤖', control: 'cpu' },
      ];
    } else if (config.type === 'local') {
      const colors = ['🔴', '🔵', '🟢', '🟡'];
      players = Array.from({ length: config.localCount }, (_, i) => ({
        name: `لاعب ${['١', '٢', '٣', '٤'][i]} ${colors[i]}`, avatar: colors[i], control: 'hotseat',
      }));
    } else { // online
      players = config.onlinePlayers.map((p, i) => ({
        name: p.name, avatar: p.avatar, frame: p.frame || '', control: i === config.myIndex ? 'me' : 'remote',
      }));
    }

    players.forEach(p => { p.hp = maxHp; p.maxHp = maxHp; p.alive = true; p.shield = 0; });

    S = {
      type: config.type, mode, difficulty: config.difficulty || null,
      players, turn: 0, myIndex: players.findIndex(p => p.control === 'me'),
      timeLeft: GAME_MODES[mode].time, timerId: null, expiredPending: false,
      board: null, over: false, totalMyDamage: 0,
      seed: config.seed ?? (Date.now() & 0x7fffffff),
      cpuTimer: null,
    };

    // بناء الواجهة
    $('screen-castle').classList.remove('active');
    $('screen-auth').classList.remove('active');
    $('screen-battle').classList.add('active');
    $('battle-end-overlay').classList.add('hidden');
    $('pass-device-overlay').classList.add('hidden');
    buildHud();
    buildBoosters();

    S.board = new Board($('board'), {
      seed: S.seed,
      theme: Shop.themeEmojis(Profile.data.equippedTheme),
      canPlay: () => canLocalPlay(),
      onSwap: (a, b) => { if (S.type === 'online') Online.sendEvent({ t: 'move', a, b }); },
      onMatchCells: (cells) => onMatchStep(cells),
      onResolved: (result) => onResolved(result),
      onBomb: (r, c) => useBombAt(r, c, true),
    });

    UI.toast(`${GAME_MODES[mode].label} — تبدأ المعركة! 🔥`, 'success');
    beginTurn(true);
  }

  function canLocalPlay() {
    if (!S || S.over || S.expiredPending) return false;
    const ctrl = S.players[S.turn].control;
    return ctrl === 'me' || ctrl === 'hotseat';
  }

  // ===== الواجهة: لوحات الصحة =====
  function buildHud() {
    const wrap = $('players-hud');
    wrap.innerHTML = '';
    S.players.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'player-hud';
      d.id = 'hud-' + i;
      const frame = (p.control === 'me' && Profile.data.frame) ? Profile.data.frame : (p.frame || '');
      d.innerHTML = `
        <div class="hud-row">
          <span class="hud-ava-ring">
            <span class="hud-avatar">${p.avatar}</span>
            ${frame ? `<span class="hud-frame">${frame}</span>` : ''}
          </span>
          <span class="hud-name">${p.name}</span>
          <span class="hud-shield hidden">🛡️</span>
          <span class="hud-hp-num">${p.hp}</span>
        </div>
        <div class="hp-bar"></div>`;
      wrap.appendChild(d);
      // شارة VS بين لاعبَين
      if (S.players.length === 2 && i === 0) {
        const vs = document.createElement('div');
        vs.id = 'vs-badge';
        vs.textContent = '⚔️';
        wrap.appendChild(vs);
      }
    });
    updateHud();
  }

  function updateHud() {
    const layers = layersOf(S.mode);
    S.players.forEach((p, i) => {
      const hud = $('hud-' + i);
      if (!hud) return;
      hud.classList.toggle('active-turn', i === S.turn && !S.over);
      hud.classList.toggle('dead', !p.alive);
      hud.querySelector('.hud-hp-num').textContent = Math.max(0, p.hp) + (p.shield ? ` (+${p.shield}🛡️)` : '');
      hud.querySelector('.hud-shield').classList.toggle('hidden', !p.shield);
      const bar = hud.querySelector('.hp-bar');
      bar.innerHTML = '';
      // الطبقات من الأسفل: أحمر ثم أصفر ثم أخضر — تنقص الخضراء أولاً
      const segs = ['red', 'yellow', 'green'].slice(0, layers.length);
      let acc = 0;
      segs.forEach((color, li) => {
        const cap = layers[li];
        const val = Math.min(Math.max(p.hp - acc, 0), cap);
        acc += cap;
        const seg = document.createElement('div');
        seg.className = 'hp-seg ' + color;
        seg.style.width = (val / p.maxHp * 100) + '%';
        bar.appendChild(seg);
      });
    });
    const cur = S.players[S.turn];
    $('turn-name').textContent = cur.name;
    $('turn-banner').classList.toggle('my-turn', canLocalPlay());
  }

  // ===== الأدوار =====
  function beginTurn(first) {
    if (S.over) return;
    S.expiredPending = false;
    S.timeLeft = GAME_MODES[S.mode].time;
    updateHud();
    if (!first) Sounds.turn();
    startTimer();

    const cur = S.players[S.turn];
    if (cur.control === 'hotseat' && S.players.filter(p => p.alive).length > 1) {
      showPassOverlay(cur);
    }
    if (cur.control === 'cpu') scheduleCpuMove();
  }

  function showPassOverlay(p) {
    stopTimer(); // المؤقت يبدأ لما يضغط جاهز
    $('pass-avatar').textContent = p.avatar;
    $('pass-title').textContent = 'دور: ' + p.name;
    $('pass-device-overlay').classList.remove('hidden');
  }

  function nextTurn() {
    if (S.over) return;
    let guard = 0;
    do {
      S.turn = (S.turn + 1) % S.players.length;
    } while (!S.players[S.turn].alive && guard++ < 8);
    beginTurn(false);
  }

  // الهدف: اللاعب الحي التالي بعد صاحب الدور
  function targetIndex() {
    let i = S.turn, guard = 0;
    do { i = (i + 1) % S.players.length; } while ((!S.players[i].alive || i === S.turn) && guard++ < 8);
    return i;
  }

  // ===== المؤقت =====
  function startTimer() {
    stopTimer();
    const total = GAME_MODES[S.mode].time;
    S.timerId = setInterval(() => {
      S.timeLeft -= 0.1;
      const ring = $('timer-ring');
      ring.style.setProperty('--p', Math.max(0, S.timeLeft / total));
      ring.classList.toggle('warn', S.timeLeft <= 6);
      const secs = Math.max(0, Math.ceil(S.timeLeft));
      const numEl = $('timer-num');
      if (numEl.textContent !== String(secs)) {
        numEl.textContent = secs;
        if (S.timeLeft <= 5 && S.timeLeft > 0) Sounds.tick();
      }
      if (S.timeLeft <= 0) onTimeExpired();
    }, 100);
  }

  function stopTimer() { if (S?.timerId) { clearInterval(S.timerId); S.timerId = null; } }

  function onTimeExpired() {
    stopTimer();
    const ctrl = S.players[S.turn].control;
    // أونلاين: فقط جهاز صاحب الدور يعلن انتهاء وقته (لتفادي اختلاف التوقيت)
    if (S.type === 'online' && ctrl === 'remote') {
      S.expiredPending = false;
      return; // ننتظر حدث timeout من الخصم
    }
    if (S.board.busy) { S.expiredPending = true; return; }
    announceTimeout();
  }

  function announceTimeout() {
    UI.toast('⏰ خلص الوقت! الدور للي بعده');
    if (S.type === 'online' && S.players[S.turn].control === 'me') Online.sendEvent({ t: 'timeout' });
    nextTurn();
  }

  // ===== الدمج والضرر =====
  // كل خطوة دمج: حلويات تطير للهدف وينطبق ضرر الخطوة فوراً
  function onMatchStep(cells) {
    if (S.over) return;
    const ctrl = S.players[S.turn].control;
    if (ctrl === 'me' || ctrl === 'hotseat') Missions.track('crush', cells.length);
    const dmg = cells.length;
    const ti = targetIndex();
    applyFlyingDamage(cells, ti, dmg);
  }

  function applyFlyingDamage(cells, ti, dmg) {
    const hud = $('hud-' + ti);
    Anim.flyToTarget(cells, hud, null, () => {
      if (S.over) return;
      dealDamage(ti, dmg);
    });
  }

  function dealDamage(ti, dmg) {
    const t = S.players[ti];
    if (!t.alive) return;
    let real = dmg;
    if (t.shield > 0) {
      const absorbed = Math.min(t.shield, real);
      t.shield -= absorbed;
      real -= absorbed;
      Sounds.shield();
    }
    t.hp -= real;
    if (S.players[S.turn].control === 'me') {
      S.totalMyDamage += real;
    }
    Sounds.hit();
    Anim.hudHit($('hud-' + ti));
    Anim.damageNumber($('hud-' + ti), dmg);
    Anim.shake();
    if (t.hp <= 0) {
      t.hp = 0;
      t.alive = false;
      UI.toast(`💀 ${t.name} خرج من المعركة!`);
    }
    updateHud();
  }

  // نهاية حل اللوحة بعد حركة: نقرر يكمل الدور أو يمرر
  function onResolved(result) {
    if (S.over || !result) return;
    const ctrl = S.players[S.turn]?.control;
    if (result.cascades >= 3 && (ctrl === 'me' || ctrl === 'hotseat')) Missions.track('combo', result.cascades);
    if (result.damage === 0) { checkEnd(); return; }

    // الموت المفاجئ: دمج 5+ يضاعف الضرر
    if (S.mode === 'sudden' && result.maxGroup >= 5) {
      const ti = targetIndex();
      if (S.players[ti].alive) {
        Anim.bigText('💀 ضرر مضاعف ×2!');
        dealDamage(ti, result.damage);
      }
    }

    if (checkEnd()) return;

    if (S.expiredPending) { S.expiredPending = false; announceTimeout(); return; }

    if (result.maxGroup >= 4) {
      Anim.bigText('🔥 دمج ' + result.maxGroup + '! كمّل دورك');
      updateHud();
      const cur = S.players[S.turn];
      if (cur.control === 'cpu') scheduleCpuMove();
      // المؤقت مستمر بدون تصفير — الحماس!
    } else {
      nextTurn();
    }
  }

  function checkEnd() {
    const alive = S.players.filter(p => p.alive);
    if (alive.length > 1) return false;
    endBattle(alive[0]);
    return true;
  }

  // ===== الكمبيوتر =====
  function scheduleCpuMove() {
    clearTimeout(S.cpuTimer);
    S.cpuTimer = setTimeout(async () => {
      if (S.over || S.players[S.turn].control !== 'cpu') return;
      if (S.board.busy) { scheduleCpuMove(); return; }
      const move = AI.pickMove(S.board.grid, S.difficulty);
      if (!move) { S.board.shuffle(); scheduleCpuMove(); return; }
      S.board.attemptSwap(move.a, move.b, false);
    }, AI.thinkDelay(S.difficulty));
  }

  // ===== المعززات =====
  function buildBoosters() {
    const wrap = $('battle-boosters');
    wrap.innerHTML = '';
    if (S.type === 'local') return; // عشان العدل بين اللاعبين المحليين
    Shop.BOOSTERS.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'booster-btn';
      btn.id = 'booster-' + b.id;
      btn.title = b.name;
      btn.innerHTML = `${b.icon}<span class="booster-count">0</span>`;
      btn.addEventListener('click', () => useBooster(b.id));
      wrap.appendChild(btn);
    });
    refreshBoosters();
  }

  function refreshBoosters() {
    if (S.type === 'local') return;
    Shop.BOOSTERS.forEach(b => {
      const btn = $('booster-' + b.id);
      if (!btn) return;
      const count = Profile.data.boosters[b.id] || 0;
      btn.querySelector('.booster-count').textContent = count;
      const myTurn = S.players[S.turn]?.control === 'me' && !S.over;
      btn.disabled = count <= 0 || !myTurn || !S.board || S.board.busy;
    });
  }

  function consumeBooster(id) {
    Profile.data.boosters[id]--;
    Profile.save();
    refreshBoosters();
  }

  function useBooster(id) {
    if (S.over || S.players[S.turn].control !== 'me' || S.board.busy) return;
    if ((Profile.data.boosters[id] || 0) <= 0) return;
    Sounds.click();

    if (id === 'bomb') {
      S.board.armBomb();
      const btn = $('booster-bomb');
      btn.classList.add('armed');
      return; // يُستهلك عند التفجير الفعلي
    }
    if (id === 'time') {
      consumeBooster('time');
      S.timeLeft = Math.min(S.timeLeft + 10, 99);
      UI.toast('⏰ +10 ثواني!', 'success');
      if (S.type === 'online') Online.sendEvent({ t: 'time' });
    }
    if (id === 'shuffle') {
      consumeBooster('shuffle');
      S.board.shuffle();
      UI.toast('🔀 انخلطت اللوحة!', 'success');
      if (S.type === 'online') Online.sendEvent({ t: 'shuffle' });
    }
    if (id === 'shield') {
      consumeBooster('shield');
      const me = S.players[S.myIndex];
      me.shield += 10;
      Sounds.shield();
      UI.toast('🛡️ درع +10!', 'success');
      updateHud();
      if (S.type === 'online') Online.sendEvent({ t: 'shield' });
    }
  }

  async function useBombAt(r, c, isLocal) {
    if (isLocal) {
      consumeBooster('bomb');
      $('booster-bomb')?.classList.remove('armed');
      if (S.type === 'online') Online.sendEvent({ t: 'bomb', r, c });
    }
    const result = await S.board.explode(r, c);
    onResolved(result);
  }

  // ===== أحداث الأونلاين الواردة =====
  function onRemoteEvent(data) {
    if (!S || S.over || S.type !== 'online') return;
    switch (data.t) {
      case 'move': S.board.applyRemoteSwap(data.a, data.b); break;
      case 'timeout': nextTurn(); break;
      case 'bomb': useBombAt(data.r, data.c, false); break;
      case 'time': S.timeLeft = Math.min(S.timeLeft + 10, 99); UI.toast('⏰ الخصم أضاف وقت!'); break;
      case 'shuffle': S.board.shuffle(); UI.toast('🔀 الخصم خلط اللوحة!'); break;
      case 'shield': {
        const idx = S.players.findIndex(p => p.control === 'remote');
        if (idx >= 0) { S.players[idx].shield += 10; updateHud(); UI.toast('🛡️ الخصم فعّل درع!'); }
        break;
      }
      case 'quit': opponentLeft(); break;
    }
  }

  function opponentLeft() {
    if (!S || S.over) return;
    UI.toast('🏃 الخصم انسحب!');
    const winner = S.players[S.myIndex];
    S.players.forEach((p, i) => { if (i !== S.myIndex) p.alive = false; });
    endBattle(winner);
  }

  // ===== النهاية =====
  function endBattle(winner) {
    if (S.over) return;
    S.over = true;
    stopTimer();
    clearTimeout(S.cpuTimer);

    const p = Profile.data;
    p.games++;
    p.maxDamage = Math.max(p.maxDamage, S.totalMyDamage);
    Missions.track('play');

    const iWon = winner && (S.myIndex >= 0 ? S.players.indexOf(winner) === S.myIndex : false);
    let coins = 0, gems = 0;
    if (S.type === 'local') {
      coins = 30; // مكافأة جلسة محلية
      $('end-emoji').textContent = '🏆';
      $('end-title').textContent = 'الفائز: ' + (winner ? winner.name : '؟');
      $('end-sub').textContent = 'مبروووك! 🎉';
      Sounds.win();
    } else if (iWon) {
      coins = S.type === 'online' ? 100 : ({ easy: 20, medium: 40, hard: 70 }[S.difficulty] || 30);
      gems = S.type === 'online' ? 3 : (S.difficulty === 'hard' ? 2 : 1);
      p.wins++;
      Missions.track('win');
      $('end-emoji').textContent = '🏆';
      $('end-title').textContent = 'فووووز! 🎉';
      $('end-sub').textContent = `دمّرت خصمك بـ ${S.totalMyDamage} نقطة ضرر 💥`;
      Sounds.win();
    } else {
      coins = 10;
      $('end-emoji').textContent = '💔';
      $('end-title').textContent = 'خسارة..';
      $('end-sub').textContent = 'المرة الجاية لك بإذن الله 💪';
      Sounds.lose();
    }
    Profile.addCoins(coins, true);
    if (gems) Profile.addGems(gems, true);
    Profile.save();
    $('end-coins').textContent = `+🪙${coins}` + (gems ? ` +💎${gems}` : '');

    $('btn-end-rematch').classList.toggle('hidden', S.type === 'online');
    setTimeout(() => $('battle-end-overlay').classList.remove('hidden'), 900);

    if (S.type === 'online') Online.battleEnded();
    S.lastConfig = null;
  }

  function quit() {
    if (!S) return;
    if (!S.over) {
      Profile.data.games++;
      Profile.save();
      if (S.type === 'online') { Online.sendEvent({ t: 'quit' }); Online.leaveRoom(); }
    }
    cleanup();
    goHome();
  }

  function cleanup() {
    stopTimer();
    if (S) clearTimeout(S.cpuTimer);
    S && (S.over = true);
  }

  function goHome() {
    $('screen-battle').classList.remove('active');
    $('screen-castle').classList.add('active');
    $('battle-end-overlay').classList.add('hidden');
    Castle.closeAllPanels();
    Castle.layout();
    Profile.render();
  }

  let lastConfig = null;
  function startWithMemory(config) { lastConfig = config; start(config); }
  function rematch() {
    if (lastConfig) { $('battle-end-overlay').classList.add('hidden'); start(lastConfig); }
    else goHome();
  }

  // ربط أزرار شاشة المعركة
  function init() {
    $('btn-battle-quit').addEventListener('click', () => quit());
    $('btn-end-home').addEventListener('click', () => { cleanup(); goHome(); });
    $('btn-end-rematch').addEventListener('click', () => rematch());
    $('btn-pass-ready').addEventListener('click', () => {
      $('pass-device-overlay').classList.add('hidden');
      Sounds.turn();
      startTimer();
    });
    // تحديث أزرار المعززات دورياً (تتأثر بالدور وانشغال اللوحة)
    setInterval(() => { if (S && !S.over) refreshBoosters(); }, 500);
  }

  return { init, start: startWithMemory, onRemoteEvent, opponentLeft };
})();
