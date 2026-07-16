// محرك لوحة الحلويات 8×8: توليد، تبديل، كشف الدمج، تساقط، إعادة تعبئة
// كله deterministic عبر seed مشترك حتى تتطابق اللوحات في الأونلاين

const SIZE = 8;
const TYPES = 6;

// مولد أرقام عشوائية ثابت بالبذرة (mulberry32)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ===== منطق نقي (يستخدمه الذكاء الاصطناعي أيضاً) =====
const Match3 = {
  cloneGrid(g) { return g.map(row => row.slice()); },

  // يرجع مجموعات الدمج: كل مجموعة { cells:[{r,c}], size } مع دمج الأشكال المتقاطعة (L/T)
  findMatches(grid) {
    const runs = [];
    // أفقي
    for (let r = 0; r < SIZE; r++) {
      let c = 0;
      while (c < SIZE) {
        const v = grid[r][c];
        let len = 1;
        while (c + len < SIZE && grid[r][c + len] === v) len++;
        if (v !== -1 && len >= 3) runs.push(Array.from({ length: len }, (_, i) => ({ r, c: c + i })));
        c += len;
      }
    }
    // عمودي
    for (let c = 0; c < SIZE; c++) {
      let r = 0;
      while (r < SIZE) {
        const v = grid[r][c];
        let len = 1;
        while (r + len < SIZE && grid[r + len][c] === v) len++;
        if (v !== -1 && len >= 3) runs.push(Array.from({ length: len }, (_, i) => ({ r: r + i, c })));
        r += len;
      }
    }
    if (!runs.length) return [];
    // دمج المتقاطع في مجموعة واحدة
    const groups = [];
    const owner = new Map(); // "r,c" -> group index
    for (const run of runs) {
      let target = -1;
      for (const cell of run) {
        const k = cell.r + ',' + cell.c;
        if (owner.has(k)) { target = owner.get(k); break; }
      }
      if (target === -1) { groups.push(new Set()); target = groups.length - 1; }
      for (const cell of run) {
        const k = cell.r + ',' + cell.c;
        const prev = owner.get(k);
        if (prev !== undefined && prev !== target) {
          // ادمج المجموعتين
          for (const kk of groups[prev]) { groups[target].add(kk); owner.set(kk, target); }
          groups[prev] = new Set();
        }
        groups[target].add(k);
        owner.set(k, target);
      }
    }
    return groups.filter(g => g.size > 0).map(set => ({
      cells: [...set].map(k => { const [r, c] = k.split(','); return { r: +r, c: +c }; }),
      size: set.size,
    }));
  },

  // كل الحركات الصحيحة الممكنة مع حجم أكبر دمج تنتجه مباشرة
  validMoves(grid) {
    const moves = [];
    const dirs = [[0, 1], [1, 0]];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      for (const [dr, dc] of dirs) {
        const r2 = r + dr, c2 = c + dc;
        if (r2 >= SIZE || c2 >= SIZE) continue;
        const g = grid;
        [g[r][c], g[r2][c2]] = [g[r2][c2], g[r][c]];
        const groups = Match3.findMatches(g);
        [g[r][c], g[r2][c2]] = [g[r2][c2], g[r][c]];
        if (groups.length) {
          const best = Math.max(...groups.map(x => x.size));
          const total = groups.reduce((s, x) => s + x.size, 0);
          moves.push({ a: { r, c }, b: { r: r2, c: c2 }, best, total });
        }
      }
    }
    return moves;
  },

  // محاكاة كاملة لحركة (مع التساقطات) — للذكاء الصعب. rng عشوائي عادي لأنه تقدير
  simulateMove(grid, a, b) {
    const g = Match3.cloneGrid(grid);
    [g[a.r][a.c], g[b.r][b.c]] = [g[b.r][b.c], g[a.r][a.c]];
    let damage = 0, maxGroup = 0, guard = 0;
    const rnd = Math.random;
    while (guard++ < 20) {
      const groups = Match3.findMatches(g);
      if (!groups.length) break;
      for (const grp of groups) {
        damage += grp.size;
        maxGroup = Math.max(maxGroup, grp.size);
        for (const { r, c } of grp.cells) g[r][c] = -1;
      }
      // جاذبية وتعبئة
      for (let c = 0; c < SIZE; c++) {
        let write = SIZE - 1;
        for (let r = SIZE - 1; r >= 0; r--) if (g[r][c] !== -1) g[write--][c] = g[r][c];
        for (let r = write; r >= 0; r--) g[r][c] = Math.floor(rnd() * TYPES);
      }
    }
    return { damage, maxGroup };
  },
};

// ===== اللوحة المرئية =====
class Board {
  /**
   * opts: { seed, theme: [emoji×6], canPlay: ()=>bool, onSwap: (a,b)=>void, onResolved: (result)=>void }
   */
  constructor(container, opts) {
    this.el = container;
    this.opts = opts;
    this.rng = mulberry32(opts.seed);
    this.theme = opts.theme;
    this.grid = [];
    this.cells = []; // DOM
    this.busy = false;
    this.selected = null;
    this.bombArmed = false;
    this._buildGrid();
    this._render();
    this._bindInput();
  }

  _buildGrid() {
    // توليد لوحة بدون دمج جاهز ومع وجود حركة ممكنة
    let guard = 0;
    do {
      this.grid = [];
      for (let r = 0; r < SIZE; r++) {
        const row = [];
        for (let c = 0; c < SIZE; c++) {
          let v;
          do {
            v = Math.floor(this.rng() * TYPES);
          } while (
            (c >= 2 && row[c - 1] === v && row[c - 2] === v) ||
            (r >= 2 && this.grid[r - 1][c] === v && this.grid[r - 2][c] === v)
          );
          row.push(v);
        }
        this.grid.push(row);
      }
    } while (!Match3.validMoves(this.grid).length && guard++ < 50);
  }

  _render() {
    this.el.innerHTML = '';
    this.cells = [];
    for (let r = 0; r < SIZE; r++) {
      const rowEls = [];
      for (let c = 0; c < SIZE; c++) {
        const d = document.createElement('div');
        d.className = 'candy';
        d.dataset.r = r; d.dataset.c = c;
        d.textContent = this.theme[this.grid[r][c]];
        this.el.appendChild(d);
        rowEls.push(d);
      }
      this.cells.push(rowEls);
    }
  }

  setTheme(theme) {
    this.theme = theme;
    this._refreshAll();
  }

  _refreshAll() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      this.cells[r][c].textContent = this.theme[this.grid[r][c]];
      this.cells[r][c].className = 'candy';
    }
  }

  _bindInput() {
    let startCell = null, startX = 0, startY = 0;

    this.el.addEventListener('pointerdown', (e) => {
      const cell = e.target.closest('.candy');
      if (!cell || this.busy || !this.opts.canPlay()) return;
      const r = +cell.dataset.r, c = +cell.dataset.c;

      // وضع القنبلة: ضغطة واحدة تفجر
      if (this.bombArmed) {
        this.bombArmed = false;
        this.el.classList.remove('bomb-mode');
        this.opts.onBomb && this.opts.onBomb(r, c);
        return;
      }

      startCell = { r, c };
      startX = e.clientX; startY = e.clientY;

      if (this.selected) {
        const s = this.selected;
        if (Math.abs(s.r - r) + Math.abs(s.c - c) === 1) {
          this._clearSelection();
          this.attemptSwap(s, { r, c }, true);
          startCell = null;
          return;
        }
        this._clearSelection();
      }
      this.selected = { r, c };
      this.cells[r][c].classList.add('selected');
      Sounds.click();
    });

    this.el.addEventListener('pointermove', (e) => {
      if (!startCell || this.busy) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
      let target;
      if (Math.abs(dx) > Math.abs(dy)) {
        // الصفحة RTL لكن إحداثيات الشاشة ثابتة: نحسب العمود من اتجاه السحب الفعلي
        const dir = dx > 0 ? this._screenDirToCol() : -this._screenDirToCol();
        target = { r: startCell.r, c: startCell.c + dir };
      } else {
        target = { r: startCell.r + (dy > 0 ? 1 : -1), c: startCell.c };
      }
      const from = startCell;
      startCell = null;
      this._clearSelection();
      if (target.r >= 0 && target.r < SIZE && target.c >= 0 && target.c < SIZE) {
        this.attemptSwap(from, target, true);
      }
    });

    this.el.addEventListener('pointerup', () => { startCell = null; });
  }

  // في RTL الشبكة معكوسة بصرياً: السحب يمين الشاشة = عمود أقل
  _screenDirToCol() {
    return getComputedStyle(this.el).direction === 'rtl' ? -1 : 1;
  }

  _clearSelection() {
    if (this.selected) this.cells[this.selected.r][this.selected.c].classList.remove('selected');
    this.selected = null;
  }

  armBomb() {
    this.bombArmed = true;
    UI.toast('اضغط على المكان اللي تبي تفجره 💣');
  }

  // محاولة تبديل: isLocal=true يعني من لاعب هذا الجهاز (نبلغ الأونلاين)
  async attemptSwap(a, b, isLocal) {
    if (this.busy) return;
    const moves = Match3.cloneGrid(this.grid);
    [moves[a.r][a.c], moves[b.r][b.c]] = [moves[b.r][b.c], moves[a.r][a.c]];
    const willMatch = Match3.findMatches(moves).length > 0;

    this.busy = true;
    await this._animSwap(a, b);

    if (!willMatch) {
      Sounds.invalid();
      this.cells[a.r][a.c].classList.add('shake-invalid');
      this.cells[b.r][b.c].classList.add('shake-invalid');
      await wait(180);
      await this._animSwap(a, b); // رجوع
      this.cells[a.r][a.c].classList.remove('shake-invalid');
      this.cells[b.r][b.c].classList.remove('shake-invalid');
      this.busy = false;
      return;
    }

    // التبديل صحيح
    [this.grid[a.r][a.c], this.grid[b.r][b.c]] = [this.grid[b.r][b.c], this.grid[a.r][a.c]];
    this._refreshAll();
    Sounds.swap();
    if (isLocal && this.opts.onSwap) this.opts.onSwap(a, b);

    const result = await this._resolveLoop();
    this.busy = false;
    this.opts.onResolved && this.opts.onResolved(result);
  }

  // تنفيذ تبديل قادم من الخصم (أونلاين) — نفس المسار بدون إرسال
  applyRemoteSwap(a, b) { this.attemptSwap(a, b, false); }

  async _animSwap(a, b) {
    const ea = this.cells[a.r][a.c], eb = this.cells[b.r][b.c];
    const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
    ea.classList.add('swap-anim'); eb.classList.add('swap-anim');
    ea.style.transform = `translate(${rb.left - ra.left}px, ${rb.top - ra.top}px)`;
    eb.style.transform = `translate(${ra.left - rb.left}px, ${ra.top - rb.top}px)`;
    await wait(230);
    ea.style.transform = ''; eb.style.transform = '';
    ea.classList.remove('swap-anim'); eb.classList.remove('swap-anim');
    // بدّل النص مباشرة
    const t = ea.textContent; ea.textContent = eb.textContent; eb.textContent = t;
  }

  // حلقة الحل: دمج → ضرر → تساقط → تكرار
  async _resolveLoop() {
    let totalDamage = 0, maxGroup = 0, cascade = 0;
    let guard = 0;
    while (guard++ < 30) {
      const groups = Match3.findMatches(this.grid);
      if (!groups.length) break;

      cascade++;
      if (cascade > 1) { Sounds.cascade(cascade); Anim.combo(cascade); }

      const matchedCells = [];
      for (const grp of groups) {
        totalDamage += grp.size;
        maxGroup = Math.max(maxGroup, grp.size);
        Sounds.match(grp.size);
        for (const { r, c } of grp.cells) {
          this.grid[r][c] = -1;
          this.cells[r][c].classList.add('matched');
          matchedCells.push(this.cells[r][c]);
        }
      }
      // أبلغ المعركة بالخلايا المدمجة (لأنيميشن الطيران)
      this.opts.onMatchCells && this.opts.onMatchCells(matchedCells);
      await wait(420);

      this._applyGravity();
      await wait(380);
    }

    // إذا ما بقت حركات → خلط تلقائي
    if (!Match3.validMoves(this.grid).length) {
      UI.toast('ما في حركات.. خلط تلقائي! 🔀');
      this.shuffle();
      await wait(400);
    }

    return { damage: totalDamage, maxGroup, cascades: cascade };
  }

  _applyGravity() {
    const fallDepth = [];
    for (let c = 0; c < SIZE; c++) {
      let write = SIZE - 1;
      for (let r = SIZE - 1; r >= 0; r--) {
        if (this.grid[r][c] !== -1) {
          if (write !== r) {
            this.grid[write][c] = this.grid[r][c];
            fallDepth.push({ r: write, c, depth: write - r });
          }
          write--;
        }
      }
      for (let r = write; r >= 0; r--) {
        this.grid[r][c] = Math.floor(this.rng() * TYPES);
        fallDepth.push({ r, c, depth: write + 1 });
      }
    }
    this._refreshAll();
    for (const { r, c, depth } of fallDepth) {
      const el = this.cells[r][c];
      el.style.setProperty('--fall', depth);
      el.classList.add('falling');
      el.addEventListener('animationend', () => el.classList.remove('falling'), { once: true });
    }
  }

  // قنبلة 3×3 — ترجع نتيجة مثل الدمج
  async explode(r, c) {
    if (this.busy) return null;
    this.busy = true;
    Sounds.bomb();
    Anim.shake();
    let destroyed = 0;
    const cellEls = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
      this.grid[rr][cc] = -1;
      this.cells[rr][cc].classList.add('matched');
      cellEls.push(this.cells[rr][cc]);
      destroyed++;
    }
    this.opts.onMatchCells && this.opts.onMatchCells(cellEls);
    await wait(420);
    this._applyGravity();
    await wait(380);
    const chain = await this._resolveLoop();
    this.busy = false;
    return { damage: destroyed + chain.damage, maxGroup: Math.max(9, chain.maxGroup), cascades: chain.cascades };
  }

  shuffle() {
    // إعادة توزيع بنفس rng (deterministic) حتى تتطابق أونلاين
    const flat = this.grid.flat().filter(v => v !== -1);
    let guard = 0;
    do {
      for (let i = flat.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [flat[i], flat[j]] = [flat[j], flat[i]];
      }
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) this.grid[r][c] = flat[r * SIZE + c];
    } while ((Match3.findMatches(this.grid).length || !Match3.validMoves(this.grid).length) && guard++ < 80);
    this._refreshAll();
    Sounds.swap();
  }

  showHint() {
    const moves = Match3.validMoves(this.grid);
    if (!moves.length) return;
    const m = moves[Math.floor(Math.random() * moves.length)];
    [m.a, m.b].forEach(({ r, c }) => {
      const el = this.cells[r][c];
      el.classList.add('hint-glow');
      setTimeout(() => el.classList.remove('hint-glow'), 2500);
    });
  }
}

function wait(ms) { return new Promise(res => setTimeout(res, ms)); }
