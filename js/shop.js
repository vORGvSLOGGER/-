// المتجر الملكي: معززات، اللوك (ثيمات)، أفاتارات، إطارات، عملات، جواهر
const Shop = (() => {
  const BOOSTERS = [
    { id: 'bomb',    icon: '💣', name: 'قنبلة حلوى', desc: 'تفجّر منطقة 3×3 وتضرب الخصم', price: 80 },
    { id: 'time',    icon: '⏰', name: 'وقت إضافي', desc: '+10 ثواني على دورك', price: 50 },
    { id: 'shuffle', icon: '🔀', name: 'خلط اللوحة', desc: 'يخلط الحلويات كلها من جديد', price: 40 },
    { id: 'shield',  icon: '🛡️', name: 'درع سكري', desc: 'يمتص 10 نقاط ضرر عنك', price: 60 },
  ];

  const THEMES = [
    { id: 'classic', icon: '🍬', name: 'الحلويات', desc: 'اللوك الأساسي', price: 0 },
    { id: 'fruits',  icon: '🍓', name: 'الفواكه',  desc: '🍓🍊🍋🍉🍇🥝', price: 300 },
    { id: 'gems',    icon: '💎', name: 'الجواهر',  desc: '💎🔶🟢🔷🟣❤️', price: 500 },
    { id: 'animals', icon: '🐱', name: 'الحيوانات', desc: '🐱🐶🐸🐼🦊🐵', price: 400 },
  ];

  const AVATARS = [
    { id: '👑', name: 'الملك',     price: 250 },
    { id: '🐉', name: 'التنين',    price: 350 },
    { id: '🦄', name: 'يونيكورن',  price: 300 },
    { id: '🤖', name: 'الروبوت',   price: 200 },
    { id: '😈', name: 'الشرير',    price: 220 },
    { id: '🥷', name: 'النينجا',   price: 280 },
    { id: '🧙', name: 'الساحر',    price: 320 },
    { id: '🦁', name: 'الأسد',     price: 260 },
  ];
  const FREE_AVATARS = ['🍬', '🍭', '🍩', '🧁', '🍫', '🍪', '🍓', '🐼', '🐸', '⭐'];

  const FRAMES = [
    { id: '',   icon: '⚪', name: 'بدون إطار', gems: 0 },
    { id: '✨', icon: '✨', name: 'اللامع',    gems: 3 },
    { id: '🔥', icon: '🔥', name: 'الناري',    gems: 5 },
    { id: '🌈', icon: '🌈', name: 'قوس قزح',   gems: 8 },
    { id: '👑', icon: '👑', name: 'الملكي',    gems: 12 },
    { id: '⚡', icon: '⚡', name: 'الصاعقة',   gems: 6 },
  ];

  const COIN_PACKS = [
    { icon: '🪙', name: 'كيس عملات',    amount: 500 },
    { icon: '💰', name: 'صندوق عملات',  amount: 1500 },
    { icon: '🏆', name: 'كنز الحلويات', amount: 4000 },
  ];
  const GEM_PACKS = [
    { icon: '💎', name: 'حفنة جواهر',  amount: 10 },
    { icon: '💠', name: 'كيس جواهر',   amount: 30 },
    { icon: '👑', name: 'كنز الجواهر', amount: 80 },
  ];

  let activeTab = 'boosters';

  function init() {
    document.querySelectorAll('.shop-tab[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        Sounds.click();
        render(btn.dataset.tab);
      });
    });
  }

  function itemCard({ icon, name, desc, footer }) {
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = `<span class="item-icon">${icon}</span>
      <span class="item-name">${name}</span>
      <span class="item-desc">${desc || ''}</span>`;
    div.appendChild(footer);
    return div;
  }

  function buyBtn(label, onClick, disabled, cls) {
    const b = document.createElement('button');
    b.className = 'btn-buy' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.disabled = !!disabled;
    b.addEventListener('click', onClick);
    return b;
  }

  function render(tab) {
    if (tab) {
      activeTab = tab;
      document.querySelectorAll('.shop-tab[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    }
    const wrap = document.getElementById('shop-items');
    if (!wrap) return;
    wrap.innerHTML = '';
    const p = Profile.data;

    if (activeTab === 'boosters') {
      BOOSTERS.forEach(item => {
        const count = p.boosters[item.id] || 0;
        const footer = document.createElement('div');
        if (count > 0) {
          const owned = document.createElement('span');
          owned.className = 'item-owned';
          owned.textContent = `تملك: ${count}`;
          footer.appendChild(owned);
        }
        footer.appendChild(buyBtn(`شراء 🪙${item.price}`, () => {
          if (!Profile.spendCoins(item.price)) return UI.toast('عملاتك ما تكفي 😢', 'error');
          p.boosters[item.id] = (p.boosters[item.id] || 0) + 1;
          Profile.save(); Sounds.buy();
          UI.toast(`اشتريت ${item.name} ${item.icon}`, 'success');
          render();
        }, p.coins < item.price));
        wrap.appendChild(itemCard({ ...item, footer }));
      });
    }

    if (activeTab === 'themes') {
      THEMES.forEach(item => {
        const owned = p.ownedThemes.includes(item.id);
        const equipped = p.equippedTheme === item.id;
        const footer = document.createElement('div');
        if (equipped) {
          const b = buyBtn('مُفعّل ✅', () => {});
          b.classList.add('equipped');
          footer.appendChild(b);
        } else if (owned) {
          footer.appendChild(buyBtn('تفعيل', () => {
            p.equippedTheme = item.id; Profile.save(); Sounds.click(); render();
          }));
        } else {
          footer.appendChild(buyBtn(`شراء 🪙${item.price}`, () => {
            if (!Profile.spendCoins(item.price)) return UI.toast('عملاتك ما تكفي 😢', 'error');
            p.ownedThemes.push(item.id); p.equippedTheme = item.id;
            Profile.save(); Sounds.buy();
            UI.toast(`مبروك! لوك ${item.name} ${item.icon}`, 'success');
            render();
          }, p.coins < item.price));
        }
        wrap.appendChild(itemCard({ ...item, footer }));
      });
    }

    if (activeTab === 'avatars') {
      // المجانية أولاً (تفعيل مباشر)
      FREE_AVATARS.forEach(av => {
        const equipped = p.avatar === av;
        const footer = document.createElement('div');
        const b = buyBtn(equipped ? 'مُفعّل ✅' : 'تفعيل', () => {
          p.avatar = av; Profile.save(); Sounds.click(); render();
        });
        if (equipped) b.classList.add('equipped');
        footer.appendChild(b);
        wrap.appendChild(itemCard({ icon: av, name: 'مجاني', desc: '', footer }));
      });
      AVATARS.forEach(item => {
        const owned = p.ownedAvatars.includes(item.id);
        const equipped = p.avatar === item.id;
        const footer = document.createElement('div');
        if (equipped) {
          const b = buyBtn('مُفعّل ✅', () => {}); b.classList.add('equipped'); footer.appendChild(b);
        } else if (owned) {
          footer.appendChild(buyBtn('تفعيل', () => { p.avatar = item.id; Profile.save(); Sounds.click(); render(); }));
        } else {
          footer.appendChild(buyBtn(`شراء 🪙${item.price}`, () => {
            if (!Profile.spendCoins(item.price)) return UI.toast('عملاتك ما تكفي 😢', 'error');
            p.ownedAvatars.push(item.id); p.avatar = item.id;
            Profile.save(); Sounds.buy();
            UI.toast(`مبروك أفاتار ${item.name} ${item.id}!`, 'success');
            render();
          }, p.coins < item.price));
        }
        wrap.appendChild(itemCard({ icon: item.id, name: item.name, desc: '', footer }));
      });
    }

    if (activeTab === 'frames') {
      FRAMES.forEach(item => {
        const owned = item.gems === 0 || p.ownedFrames.includes(item.id);
        const equipped = (p.frame || '') === item.id;
        const footer = document.createElement('div');
        if (equipped) {
          const b = buyBtn('مُفعّل ✅', () => {}); b.classList.add('equipped'); footer.appendChild(b);
        } else if (owned) {
          footer.appendChild(buyBtn('تفعيل', () => { p.frame = item.id; Profile.save(); Sounds.click(); render(); }));
        } else {
          footer.appendChild(buyBtn(`شراء 💎${item.gems}`, () => {
            if (!Profile.spendGems(item.gems)) return UI.toast('جواهرك ما تكفي 😢', 'error');
            p.ownedFrames.push(item.id); p.frame = item.id;
            Profile.save(); Sounds.buy();
            UI.toast(`مبروك إطار ${item.name} ${item.icon}!`, 'success');
            render();
          }, p.gems < item.gems, 'gem'));
        }
        wrap.appendChild(itemCard({ icon: item.icon, name: item.name, desc: item.gems ? `إطار حول أفاتارك ${item.icon}` : 'الشكل الافتراضي', footer }));
      });
    }

    if (activeTab === 'coins') {
      COIN_PACKS.forEach(item => {
        const footer = document.createElement('div');
        footer.appendChild(buyBtn('احصل عليها 🎁', () => {
          Profile.addCoins(item.amount);
          UI.toast(`+🪙${item.amount}! استمتع 🎉`, 'success');
          render();
        }));
        wrap.appendChild(itemCard({ ...item, desc: `+🪙${item.amount} — شراء تجريبي مجاني`, footer }));
      });
    }

    if (activeTab === 'gems') {
      GEM_PACKS.forEach(item => {
        const footer = document.createElement('div');
        footer.appendChild(buyBtn('احصل عليها 🎁', () => {
          Profile.addGems(item.amount);
          UI.toast(`+💎${item.amount}! استمتع 🎉`, 'success');
          render();
        }, false, 'gem'));
        wrap.appendChild(itemCard({ ...item, desc: `+💎${item.amount} — شراء تجريبي مجاني`, footer }));
      });
    }
  }

  function themeEmojis(id) {
    const map = {
      classic: ['🍬', '🍭', '🍩', '🧁', '🍫', '🍪'],
      fruits:  ['🍓', '🍊', '🍋', '🍉', '🍇', '🥝'],
      gems:    ['💎', '🔶', '🟢', '🔷', '🟣', '❤️'],
      animals: ['🐱', '🐶', '🐸', '🐼', '🦊', '🐵'],
    };
    return map[id] || map.classic;
  }

  return { init, render, themeEmojis, BOOSTERS };
})();
