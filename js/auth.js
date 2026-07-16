// شاشات التسجيل والدخول والاسترجاع + أنيميشن دخول القصر
const Auth = (() => {
  const CRED_KEY = 'candywar_auth_v1';
  const $ = id => document.getElementById(id);
  let currentPanel = 'login';

  function init() {
    fillCountries($('reg-country'));
    fillCountries($('rec-country'));
    bindCityFollow($('reg-country'), $('reg-city'));
    bindCityFollow($('rec-country'), $('rec-city'));

    $('link-to-register').addEventListener('click', () => switchPanel('register'));
    $('link-to-login').addEventListener('click', () => switchPanel('login'));
    $('link-back-login').addEventListener('click', () => switchPanel('login'));
    $('link-recover').addEventListener('click', () => switchPanel('recover'));
    $('link-terms').addEventListener('click', () => UI.openModal('modal-terms'));

    $('btn-login').addEventListener('click', doLogin);
    $('btn-register').addEventListener('click', doRegister);
    $('btn-recover').addEventListener('click', doRecover);
    $('btn-guest').addEventListener('click', () => { Sounds.click(); Profile.loadGuest(); enterCastle(); });

    ['login-code', 'reg-code', 'rec-newcode'].forEach(id => {
      $(id).addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
    });
    $('login-code').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

    // حالة الاتصال
    Online.onStatus((status) => {
      const st = $('auth-status');
      if (!st) return;
      if (status === 'online') {
        st.textContent = '✅ متصل بالمملكة';
        st.className = 'auth-status online';
        $('btn-guest').classList.add('hidden');
        tryAutoLogin();
      } else if (status === 'offline') {
        st.textContent = '🔌 ما قدرنا نوصل للسيرفر — تقدر تلعب كضيف بدون أونلاين';
        st.className = 'auth-status offline';
        $('btn-guest').classList.remove('hidden');
      } else {
        st.textContent = '... جاري الاتصال بالمملكة';
        st.className = 'auth-status';
      }
    });
  }

  function fillCountries(sel) {
    for (const country of Object.keys(GEO)) {
      const o = document.createElement('option');
      o.value = country; o.textContent = country;
      sel.appendChild(o);
    }
  }

  function bindCityFollow(countrySel, citySel) {
    countrySel.addEventListener('change', () => {
      citySel.innerHTML = '';
      const cities = GEO[countrySel.value] || [];
      if (!cities.length) {
        citySel.disabled = true;
        citySel.innerHTML = '<option value="">اختر الدولة أولاً</option>';
        return;
      }
      citySel.disabled = false;
      citySel.innerHTML = '<option value="">اختر المدينة 🏙️</option>';
      for (const c of cities) {
        const o = document.createElement('option');
        o.value = c; o.textContent = c;
        citySel.appendChild(o);
      }
    });
  }

  // تبديل اللوحات مع أنيميشن المشهد الخلفي (الشمس تتحرك والألوان تتغير)
  function switchPanel(name) {
    Sounds.click();
    currentPanel = name;
    ['login', 'register', 'recover'].forEach(p => $('auth-' + p).classList.toggle('hidden', p !== name));
    $('auth-scenery').classList.toggle('alt', name !== 'login');
    const panel = $('auth-' + name);
    panel.style.animation = 'none';
    void panel.offsetWidth;
    panel.style.animation = '';
  }

  function storedCreds() {
    try { return JSON.parse(localStorage.getItem(CRED_KEY)); } catch (e) { return null; }
  }

  let autoTried = false;
  function tryAutoLogin() {
    if (autoTried) return;
    const creds = storedCreds();
    if (!creds) return;
    autoTried = true;
    Online.login(creds.username, creds.code, (res) => {
      if (res.ok) {
        Profile.setAccount(res.profile);
        enterCastle();
      } else {
        localStorage.removeItem(CRED_KEY);
      }
    });
  }

  function doLogin() {
    const username = $('login-username').value.trim();
    const code = $('login-code').value;
    if (!username) return UI.toast('اكتب اسم المستخدم', 'error');
    if (code.length !== 6) return UI.toast('رمز الدخول 6 أرقام', 'error');
    if (!Online.isConnected) return UI.toast('🔌 ما في اتصال بالسيرفر', 'error');
    Sounds.click();
    Online.login(username, code, (res) => {
      if (res.error) return UI.toast(res.error, 'error');
      localStorage.setItem(CRED_KEY, JSON.stringify({ username, code }));
      Profile.setAccount(res.profile);
      Sounds.win();
      enterCastle();
    });
  }

  function doRegister() {
    const d = {
      email: $('reg-email').value.trim(),
      username: $('reg-username').value.trim(),
      code: $('reg-code').value,
      birthdate: $('reg-birthdate').value,
      country: $('reg-country').value,
      city: $('reg-city').value,
      agreed: $('reg-agree').checked,
    };
    if (!d.email) return UI.toast('اكتب بريدك الإلكتروني', 'error');
    if (!d.username) return UI.toast('اكتب اسم المستخدم', 'error');
    if (d.code.length !== 6) return UI.toast('رمز الدخول 6 أرقام بالضبط', 'error');
    if (!d.birthdate) return UI.toast('اختر تاريخ ميلادك', 'error');
    if (!d.country) return UI.toast('اختر دولتك 🌍', 'error');
    if (!d.city) return UI.toast('اختر مدينتك 🏙️', 'error');
    if (!d.agreed) return UI.toast('وافق على الشروط أولاً ✅', 'error');
    if (!Online.isConnected) return UI.toast('🔌 ما في اتصال بالسيرفر', 'error');
    Sounds.click();
    Online.register(d, (res) => {
      if (res.error) return UI.toast(res.error, 'error');
      localStorage.setItem(CRED_KEY, JSON.stringify({ username: d.username, code: d.code }));
      Profile.setAccount(res.profile);
      UI.toast('🎉 مبروك! انشأنا حسابك', 'success');
      Sounds.win();
      enterCastle();
    });
  }

  function doRecover() {
    const d = {
      username: $('rec-username').value.trim(),
      email: $('rec-email').value.trim(),
      birthdate: $('rec-birthdate').value,
      country: $('rec-country').value,
      city: $('rec-city').value,
      newCode: $('rec-newcode').value,
    };
    if (!d.username || !d.email || !d.birthdate || !d.country || !d.city) return UI.toast('عبّي كل بيانات الاسترجاع', 'error');
    if (d.newCode.length !== 6) return UI.toast('الرمز الجديد 6 أرقام', 'error');
    if (!Online.isConnected) return UI.toast('🔌 ما في اتصال بالسيرفر', 'error');
    Online.recover(d, (res) => {
      if (res.error) return UI.toast(res.error, 'error');
      UI.toast('🔓 تم استرجاع حسابك! سجل دخولك بالرمز الجديد', 'success');
      switchPanel('login');
      $('login-username').value = d.username;
    });
  }

  // أنيميشن دخول القصر
  function enterCastle() {
    const auth = $('screen-auth');
    const content = $('auth-content');
    const scenery = $('auth-scenery');
    content.classList.add('auth-zooming');
    scenery.classList.add('auth-zooming');
    $('castle-entry').classList.remove('hidden');
    Sounds.turn();
    setTimeout(() => {
      auth.classList.remove('active');
      $('screen-castle').classList.add('active');
      Castle.onEnter();
      Profile.render();
      Sounds.startMusicIfEnabled();
    }, 800);
    setTimeout(() => {
      $('castle-entry').classList.add('hidden');
      content.classList.remove('auth-zooming');
      scenery.classList.remove('auth-zooming');
    }, 1700);
  }

  function logout() {
    localStorage.removeItem(CRED_KEY);
    autoTried = false;
    location.reload();
  }

  return { init, logout, enterCastle };
})();
