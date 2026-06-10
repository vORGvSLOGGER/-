// ذكاء الكمبيوتر بثلاث صعوبات
const AI = (() => {

  function pickMove(grid, difficulty) {
    const moves = Match3.validMoves(grid);
    if (!moves.length) return null;

    if (difficulty === 'easy') {
      // عشوائي تماماً، وأحياناً يتعمد يختار أضعف حركة (يغفل عن الدمج الكبير)
      if (Math.random() < 0.4) {
        moves.sort((a, b) => a.best - b.best);
        return moves[0];
      }
      return moves[Math.floor(Math.random() * moves.length)];
    }

    if (difficulty === 'medium') {
      // يفضّل أي حركة تعطي دمج 4+ حتى يكمل دوره، وإلا الأكبر مجموعاً
      const big = moves.filter(m => m.best >= 4);
      if (big.length) return big[Math.floor(Math.random() * big.length)];
      moves.sort((a, b) => b.total - a.total);
      // مو مثالي 100%: يختار من أفضل 3
      return moves[Math.floor(Math.random() * Math.min(3, moves.length))];
    }

    // hard: يحاكي كل حركة مع التساقطات (عدة مرات لتقدير المتوسط) ويختار الأقوى
    let best = null, bestScore = -1;
    for (const m of moves) {
      let score = 0;
      for (let i = 0; i < 3; i++) {
        const sim = Match3.simulateMove(grid, m.a, m.b);
        // الدمج 4+ يخليه يكمل دوره → قيمة إضافية كبيرة
        score += sim.damage + (sim.maxGroup >= 4 ? 12 : 0);
      }
      score /= 3;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  // تأخير "تفكير" طبيعي حسب الصعوبة
  function thinkDelay(difficulty) {
    const ranges = { easy: [1800, 3500], medium: [1300, 2600], hard: [900, 2000] };
    const [lo, hi] = ranges[difficulty] || ranges.medium;
    return lo + Math.random() * (hi - lo);
  }

  return { pickMove, thinkDelay };
})();
