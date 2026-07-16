// الربط العام: أدوات الواجهة، تدفقات بدء اللعب، الإعدادات
const UI = (() => {
  const $ = id => document.getElementById(id);

  function toast(text, type = '') {
    const wrap = $('toast-wrap');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = text;
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; }, 2400);
    setTimeout(() => t.remove(), 2800);
  }

  function openModal(id) { $(id).classList.remove('hidden'); }
  function closeModal(id) { $(id).classList.add('hidden'); }
  function closeAllModals() {
    document.querySelectorAll('.overlay').forEach(o => {
      if (o.id !== 'pass-device-overlay' && o.id !== 'battle-end-overlay') o.classList.add('hidden');
    });
  }

  return { toast, openModal, closeModal, closeAllModals };
})();

const Main = (() => {
  const $ = id => document.getElementById(id);
  let pending = {};

  function startLocalFlow() {
    pending = { type: 'local' };
    UI.openModal('modal-local');
  }

  function initPlayFlows() {
    $('play-cpu').addEventListener('click', () => {
      Sounds.click();
      pending = { type: 'cpu' };
      UI.openModal('modal-difficulty');
    });

    $('play-local').addEventListener('click', () => { Sounds.click(); startLocalFlow(); });

    $('play-online').addEventListener('click', () => {
      Sounds.click();
      if (Profile.isGuest) return UI.toast('الأونلاين يحتاج حساب — سجل دخولك 👑', 'error');
      $('play-options').classList.add('hidden');
      $('online-area').classList.remove('hidden');
    });

    $('btn-online-back').addEventListener('click', () => {
      Sounds.click();
      $('online-area').classList.add('hidden');
      $('play-options').classList.remove('hidden');
    });

    document.querySelectorAll('#modal-difficulty .choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        pending.difficulty = btn.dataset.diff;
        Sounds.click();
        UI.closeModal('modal-difficulty');
        UI.openModal('modal-mode');
      });
    });

    document.querySelectorAll('#modal-local .choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        pending.localCount = +btn.dataset.count;
        Sounds.click();
        UI.closeModal('modal-local');
        UI.openModal('modal-mode');
      });
    });

    document.querySelectorAll('#modal-mode .choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        pending.mode = btn.dataset.gamemode;
        Sounds.turn();
        UI.closeModal('modal-mode');
        Castle.closeAllPanels();
        Battle.start(pending);
      });
    });
  }

  function initRooms() {
    let roomIsPublic = true;
    let roomMode = 'classic';

    $('btn-create-room').addEventListener('click', () => {
      Sounds.click();
      $('room-name-input').value = '';
      UI.openModal('modal-create-room');
    });

    $('room-type-public').addEventListener('click', () => {
      roomIsPublic = true;
      $('room-type-public').classList.add('active');
      $('room-type-private').classList.remove('active');
      Sounds.click();
    });
    $('room-type-private').addEventListener('click', () => {
      roomIsPublic = false;
      $('room-type-private').classList.add('active');
      $('room-type-public').classList.remove('active');
      Sounds.click();
    });

    document.querySelectorAll('[data-roommode]').forEach(btn => {
      btn.addEventListener('click', () => {
        roomMode = btn.dataset.roommode;
        document.querySelectorAll('[data-roommode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Sounds.click();
      });
    });

    $('btn-room-create-confirm').addEventListener('click', () => {
      const name = $('room-name-input').value.trim() || `روم ${Profile.data.username}`;
      Online.createRoom(name, roomIsPublic, roomMode);
    });

    $('btn-join-private').addEventListener('click', () => {
      const code = $('private-code-input').value.trim().toUpperCase();
      if (code.length !== 6) return UI.toast('كود الروم 6 أحرف/أرقام', 'error');
      Online.joinRoom(code);
    });

    $('btn-lobby-start').addEventListener('click', () => { Sounds.turn(); Online.startRoom(); });
    $('btn-lobby-leave').addEventListener('click', () => {
      Online.leaveRoom();
      UI.closeModal('modal-room-lobby');
    });
  }

  function initSettings() {
    $('set-sfx').addEventListener('change', (e) => {
      Sounds.setMuted(!e.target.checked);
      localStorage.setItem('candywar_sfx', e.target.checked ? '1' : '0');
      if (e.target.checked) Sounds.click();
    });
    $('set-music').addEventListener('change', (e) => {
      localStorage.setItem('candywar_music', e.target.checked ? '1' : '0');
      if (e.target.checked) Sounds.startMusic(); else Sounds.stopMusic();
    });
    // استرجاع الحفظ
    const sfx = localStorage.getItem('candywar_sfx') !== '0';
    const music = localStorage.getItem('candywar_music') === '1';
    $('set-sfx').checked = sfx;
    Sounds.setMuted(!sfx);
    $('set-music').checked = music;

    $('btn-logout').addEventListener('click', () => { Sounds.click(); Auth.logout(); });
    $('btn-open-friends').addEventListener('click', () => { Sounds.click(); Castle.openPanel('panel-friends'); });
    $('btn-support').addEventListener('click', () => { location.href = 'mailto:support@candywar.game?subject=' + encodeURIComponent('دعم حرب الحلويات'); });
    $('btn-privacy').addEventListener('click', () => UI.openModal('modal-terms'));
    $('btn-terms2').addEventListener('click', () => UI.openModal('modal-terms'));
  }

  function initModalCloses() {
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        Sounds.click();
        btn.closest('.overlay').classList.add('hidden');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    Castle.init();
    Shop.init();
    Friends.init();
    Leaderboard.init();
    Battle.init();
    Auth.init();
    initPlayFlows();
    initRooms();
    initSettings();
    initModalCloses();
    Online.connect();
  });

  return { startLocalFlow };
})();
