// الربط العام: التنقل، النوافذ، البروفايل، تدفقات بدء اللعب
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

(() => {
  const $ = id => document.getElementById(id);

  // ===== جزيئات الخلفية =====
  function spawnParticles() {
    const wrap = $('bg-particles');
    const emojis = ['🍬', '🍭', '🍩', '🧁', '🍫', '⭐', '🍪'];
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      p.textContent = emojis[i % emojis.length];
      p.style.left = Math.random() * 100 + 'vw';
      p.style.animationDuration = (14 + Math.random() * 18) + 's';
      p.style.animationDelay = (-Math.random() * 20) + 's';
      p.style.fontSize = (16 + Math.random() * 22) + 'px';
      wrap.appendChild(p);
    }
  }

  // ===== التنقل بين الصفحات =====
  function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Sounds.click();
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        $(btn.dataset.page).classList.add('active');
      });
    });
  }

  // ===== البروفايل =====
  let pickedAvatar = null;

  function openProfileModal() {
    const p = Profile.data;
    $('profile-name-input').value = p.name;
    $('stat-wins').textContent = p.wins;
    $('stat-games').textContent = p.games;
    $('stat-damage').textContent = p.maxDamage;
    pickedAvatar = p.avatar;
    const picker = $('avatar-picker');
    picker.innerHTML = '';
    Profile.allAvatars().forEach(av => {
      const d = document.createElement('div');
      d.className = 'avatar-opt' + (av === pickedAvatar ? ' selected' : '');
      d.textContent = av;
      d.addEventListener('click', () => {
        pickedAvatar = av;
        picker.querySelectorAll('.avatar-opt').forEach(x => x.classList.remove('selected'));
        d.classList.add('selected');
        Sounds.click();
      });
      picker.appendChild(d);
    });
    UI.openModal('modal-profile');
  }

  function initProfile() {
    $('profile-chip').addEventListener('click', openProfileModal);
    $('btn-profile-save').addEventListener('click', () => {
      const name = $('profile-name-input').value.trim();
      if (name) Profile.data.name = name;
      if (pickedAvatar) Profile.data.avatar = pickedAvatar;
      Profile.save();
      Online.updateProfile();
      UI.closeModal('modal-profile');
      UI.toast('تم حفظ بروفايلك ✅', 'success');
      Sounds.buy();
    });
  }

  // ===== تدفقات بدء اللعب =====
  // cpu: صعوبة → طور → ابدأ | local: عدد → طور → ابدأ
  let pending = {};

  function initModes() {
    $('btn-mode-cpu').addEventListener('click', () => {
      Sounds.click();
      pending = { type: 'cpu' };
      UI.openModal('modal-difficulty');
    });

    $('btn-mode-local').addEventListener('click', () => {
      Sounds.click();
      pending = { type: 'local' };
      UI.openModal('modal-local');
    });

    $('btn-mode-online').addEventListener('click', () => {
      Sounds.click();
      $('mode-cards').classList.add('hidden');
      $('game-logo').classList.add('hidden');
      $('game-tagline').classList.add('hidden');
      $('online-section').classList.remove('hidden');
    });

    $('btn-online-back').addEventListener('click', () => {
      $('mode-cards').classList.remove('hidden');
      $('game-logo').classList.remove('hidden');
      $('game-tagline').classList.remove('hidden');
      $('online-section').classList.add('hidden');
    });

    // اختيار الصعوبة
    document.querySelectorAll('#modal-difficulty .choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        pending.difficulty = btn.dataset.diff;
        Sounds.click();
        UI.closeModal('modal-difficulty');
        UI.openModal('modal-mode');
      });
    });

    // عدد اللاعبين المحلي
    document.querySelectorAll('#modal-local .choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        pending.localCount = +btn.dataset.count;
        Sounds.click();
        UI.closeModal('modal-local');
        UI.openModal('modal-mode');
      });
    });

    // اختيار الطور → انطلاق!
    document.querySelectorAll('#modal-mode .choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        pending.mode = btn.dataset.gamemode;
        Sounds.turn();
        UI.closeModal('modal-mode');
        Battle.start(pending);
      });
    });
  }

  // ===== إنشاء روم =====
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
      const name = $('room-name-input').value.trim() || `روم ${Profile.data.name}`;
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

  // أزرار الإغلاق العامة
  function initModalCloses() {
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        Sounds.click();
        btn.closest('.overlay').classList.add('hidden');
      });
    });
  }

  // ===== الانطلاق =====
  document.addEventListener('DOMContentLoaded', () => {
    Profile.load();
    spawnParticles();
    initNav();
    initProfile();
    initModes();
    initRooms();
    initModalCloses();
    Shop.init();
    Friends.init();
    Battle.init();
    Online.connect();
  });
})();
