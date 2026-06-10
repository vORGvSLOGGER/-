// المتجر: معززات، ثيمات حلويات، أفاتارات، حزم عملات
const Shop = (() => {
  const BOOSTERS = [
    { id: 'bomb',    icon: '💣', name: 'قنبلة حلوى', desc: 'تفجّر منطقة 3×3 وتضرب الخصم', price: 80 },
    { id: 'time',    icon: '⏰', name: 'وقت إضافي', desc: '+10 ثواني على دورك', price: 50 },
    { id: 'shuffle', icon: '🔀', name: 'خلط اللوحة', desc: 'يخلط الحلويات كلها من جديد', price: 40 },
    { id: 'shield',  icon: '🛡️', name: 'درع سكري', desc: 'يمتص 10 نقاط ضرر عنك', price: 60 },
  ];

  const THEMES = [
    { id: 'classic', icon: '🍬', name: 'الحلويات', desc: 'الثيم الأساسي', price: 0 },
    { id: 'fruits',  icon: '🍓', name: 'الفواكه',  desc: '🍓🍊🍋🍉🍇🥝', price: 300 },
    { id: 'gems',    icon: '💎', name: 'الجواهر',  desc: '💎🔶🟢🔷🟣❤️', price: 500 },
    { id: 'animals', icon: '🐱', name: 'الحيوانات', desc: '🐱🐶🐸🐼🦊🐵', price: 400 },
  ];

  const AVATARS = [
    { id: '👑', icon: '👑', name: 'الملك',     price: 250 },
    { id: '🐉', icon: '🐉', name: 'التنين',    price: 350 },
    { id: '🦄', icon: '🦄', name: 'يونيكورن',  price: 300 },
    { id: '🤖', icon: '🤖', name: 'الروبوت',   price: 200 },
    { id: '😈', icon: '😈', name: 'الشرير',    price: 220 },
    { id: '🥷', icon: '🥷', name: 'النينجا',   price: 280 },
  ];

  const COIN_PACKS = [
    { id: 'p1', icon: '🪙', name: 'كيس عملات',   amount: 500,  desc: 'شراء تجريبي مجاني' },
    { id: 'p2', icon: '💰', name: 'صندوق عملات', amount: 1500, desc: 'شراء تجريبي مجاني' },
    { id: 'p3', icon: '🏆', name: 'كنز الحلويات', amount: 4000, desc: 'شراء تجريبي مجاني' },
  ];

  let activeTab = 'boosters';

  function init() {
    document.querySelectorAll('.shop-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.shop-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        Sounds.click();
        render();
      });
    });
    render();
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

  function buyBtn(label, onClick, disabled) {
    const b = document.createElement('button');
    b.className = 'btn-buy';
    b.textContent = label;
    b.disabled = !!disabled;
    b.addEventListener('click', onClick);
    return b;
  }

  function render() {
    const wrap = document.getElementById('shop-items');
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
            UI.toast(`مبروك! ثيم ${item.name} ${item.icon}`, 'success');
            render();
          }, p.coins < item.price));
        }
        wrap.appendChild(itemCard({ ...item, footer }));
      });
    }

    if (activeTab === 'avatars') {
      AVATARS.forEach(item => {
        const owned = p.ownedAvatars.includes(item.id);
        const footer = document.createElement('div');
        if (owned) {
          const span = document.createElement('span');
          span.className = 'item-owned';
          span.textContent = 'تملكه ✅ (من البروفايل)';
          footer.appendChild(span);
        } else {
          footer.appendChild(buyBtn(`شراء 🪙${item.price}`, () => {
            if (!Profile.spendCoins(item.price)) return UI.toast('عملاتك ما تكفي 😢', 'error');
            p.ownedAvatars.push(item.id);
            Profile.save(); Sounds.buy();
            UI.toast(`مبروك أفاتار ${item.name} ${item.icon}! فعّله من بروفايلك`, 'success');
            render();
          }, p.coins < item.price));
        }
        wrap.appendChild(itemCard({ ...item, desc: '', footer }));
      });
    }

    if (activeTab === 'coins') {
      COIN_PACKS.forEach(item => {
        const footer = document.createElement('div');
        footer.appendChild(buyBtn(`احصل عليها 🎁`, () => {
          Profile.addCoins(item.amount);
          UI.toast(`+🪙${item.amount}! استمتع 🎉`, 'success');
          render();
        }));
        wrap.appendChild(itemCard({ ...item, desc: `+🪙${item.amount} — ${item.desc}`, footer }));
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
