/*!
 * 斗地主军师 · 牌局引擎
 * 只按点数建模（花色不影响斗地主牌型），一副牌 54 张。
 * 点数：3..15 为 3..2，16 小王，17 大王
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DDZ = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const N = 15;                 // 手牌桶数量，index = 点数 - 3
  const idx = r => r - 3;
  const rk = i => i + 3;

  const NAME = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '小王', '大王'];
  const TYPE_CN = {
    single: '单张', pair: '对子', trio: '三张', trio1: '三带一', trio2: '三带二',
    straight: '顺子', pairseq: '连对', plane: '飞机', plane1: '飞机带单', plane2: '飞机带对',
    four2: '四带二', four2pair: '四带两对', bomb: '炸弹', rocket: '王炸'
  };

  /* ---------------- 基础工具 ---------------- */

  function zero() { return new Array(N).fill(0); }
  function total(c) { let s = 0; for (let i = 0; i < N; i++) s += c[i]; return s; }
  function countsOf(cards) {
    const c = zero();
    for (let i = 0; i < cards.length; i++) c[cards[i] - 3]++;
    return c;
  }
  function minus(c, cards) {
    const d = c.slice();
    for (let i = 0; i < cards.length; i++) d[cards[i] - 3]--;
    return d;
  }
  function addCards(c, cards) {
    const d = c.slice();
    for (let i = 0; i < cards.length; i++) d[cards[i] - 3]++;
    return d;
  }
  function cardsOf(c) {
    const out = [];
    for (let i = 0; i < N; i++) for (let k = 0; k < c[i]; k++) out.push(i + 3);
    return out;
  }
  function fullDeck() {
    const out = [];
    for (let r = 3; r <= 15; r++) for (let k = 0; k < 4; k++) out.push(r);
    out.push(16, 17);
    return out;
  }
  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  const rankName = r => NAME[r - 3] || String(r);

  /* ---------------- 牌型识别 ---------------- */

  function isRun(c, start, len, need) {
    for (let r = start; r < start + len; r++) {
      if (r > 14) return false;          // 2 和大小王不能进顺子
      if (c[r - 3] < need) return false;
    }
    return true;
  }

  function classify(cards) {
    if (!cards || !cards.length) return null;
    for (let i = 0; i < cards.length; i++) if (!(cards[i] >= 3 && cards[i] <= 17)) return null;
    const sorted = cards.slice().sort((a, b) => a - b);
    const n = sorted.length;
    const c = countsOf(sorted);
    const g = [];
    for (let i = 0; i < N; i++) if (c[i]) g.push({ r: i + 3, k: c[i] });

    const mk = (type, rank, len) => ({
      type, rank, len: len || 1, cards: sorted.slice(),
      key: type + '|' + (len || 1) + '|' + rank, cn: TYPE_CN[type]
    });

    // 王炸
    if (n === 2 && c[13] === 1 && c[14] === 1) return mk('rocket', 17, 1);
    if (n === 1) return mk('single', sorted[0], 1);

    if (g.length === 1) {
      if (n === 2) return mk('pair', g[0].r, 1);
      if (n === 3) return mk('trio', g[0].r, 1);
      if (n === 4) return mk('bomb', g[0].r, 1);
      return null;
    }

    // 三带一 / 三带二（带牌可能比三张本身还小，不能只看 g[0]）
    if (n === 4) {
      const t3 = g.find(x => x.k === 3);
      const wings = g.filter(x => x !== t3);
      if (t3 && wings.length === 1 && wings[0].k === 1) return mk('trio1', t3.r, 1);
    }
    if (n === 5) {
      const t3 = g.find(x => x.k === 3);
      const wings = g.filter(x => x !== t3);
      if (t3 && wings.length === 1 && wings[0].k === 2) return mk('trio2', t3.r, 1);
    }

    // 顺子
    if (n >= 5 && g.length === n && sorted[n - 1] <= 14) {
      let ok = true;
      for (let i = 1; i < n; i++) if (sorted[i] !== sorted[i - 1] + 1) { ok = false; break; }
      if (ok) return mk('straight', sorted[0], n);
    }

    // 连对
    if (n >= 6 && n % 2 === 0 && g.length === n / 2) {
      let ok = g.every(x => x.k === 2) && g[g.length - 1].r <= 14;
      if (ok) {
        for (let i = 1; i < g.length; i++) if (g[i].r !== g[i - 1].r + 1) { ok = false; break; }
        if (ok) return mk('pairseq', g[0].r, g.length);
      }
    }

    // 纯飞机
    if (n >= 6 && n % 3 === 0) {
      const k = n / 3;
      if (g.length === k && g.every(x => x.k === 3) && g[g.length - 1].r <= 14) {
        let ok = true;
        for (let i = 1; i < g.length; i++) if (g[i].r !== g[i - 1].r + 1) { ok = false; break; }
        if (ok) return mk('plane', g[0].r, k);
      }
    }

    // 四带二（带双王不算合法四带二，与 rlcard 一致）
    const four = g.find(x => x.k === 4);
    if (four) {
      const rest = g.filter(x => x !== four);
      const jokers = rest.length === 2 && rest[0].k === 1 && rest[1].k === 1 &&
        rest[0].r + rest[1].r === 33;
      if (n === 6 && rest.length === 2 && rest[0].k === 1 && rest[1].k === 1) {
        return jokers ? null : mk('four2', four.r, 1);
      }
      if (n === 6 && rest.length === 1 && rest[0].k === 2) return mk('four2', four.r, 1);
      if (n === 8 && rest.length === 2 && rest[0].k === 2 && rest[1].k === 2) return mk('four2pair', four.r, 1);
    }

    // 飞机带翅膀
    for (let k = 2; k <= 5; k++) {
      if (n !== 4 * k && n !== 5 * k) continue;
      const wingPairs = n === 5 * k;
      for (let start = 3; start + k - 1 <= 14; start++) {
        let ok = true;
        for (let r = start; r < start + k; r++) if (c[r - 3] !== 3) { ok = false; break; }
        if (!ok) continue;
        const restC = c.slice();
        for (let r = start; r < start + k; r++) restC[r - 3] -= 3;
        let restTotal = 0, okWing = true;
        for (let i = 0; i < N; i++) restTotal += restC[i];
        if (restTotal !== (wingPairs ? 2 * k : k)) continue;
        if (wingPairs) {
          for (let i = 0; i < N; i++) if (restC[i] !== 0 && restC[i] !== 2) { okWing = false; break; }
        } else {
          // rlcard 允许单翅膀同点多达 3 张（4 张会成炸，不允许）
          for (let i = 0; i < N; i++) if (restC[i] > 3) { okWing = false; break; }
          // 双王不能同时当翅膀
          if (restC[13] === 1 && restC[14] === 1) okWing = false;
          // 与飞机相邻的点数若当翅膀，最多 2 张（3 张会并成更长的飞机；2 除外）
          if (okWing) {
            for (const r of [start - 1, start + k]) {
              if (r < 3 || r > 15 || r === 15) continue;
              if (restC[r - 3] === 3) { okWing = false; break; }
            }
          }
        }
        if (okWing) return mk(wingPairs ? 'plane2' : 'plane1', start, k);
      }
    }
    return null;
  }

  /* ---------------- 比较 ---------------- */

  function beats(a, b) {
    if (!a) return false;
    if (!b) return true;
    if (a.type === 'rocket') return true;
    if (b.type === 'rocket') return false;
    if (a.type === 'bomb') return b.type === 'bomb' ? a.rank > b.rank : true;
    if (b.type === 'bomb') return false;
    return a.type === b.type && a.len === b.len && a.rank > b.rank;
  }

  /* ---------------- 出牌生成 ---------------- */

  function comboRanks(c, wantPairs, count, limit) {
    const cand = [];
    for (let i = 0; i < N; i++) {
      if (wantPairs) { if (c[i] >= 2) cand.push(i + 3); }
      else if (c[i] > 0) cand.push(i + 3);
    }
    const out = [];
    const cap = limit || 4096;
    const recursion = (start, acc) => {
      if (out.length >= cap) return;
      if (acc.length === count) { out.push(acc.slice()); return; }
      for (let i = start; i < cand.length; i++) {
        acc.push(cand[i]);
        recursion(i + 1, acc);
        acc.pop();
        if (out.length >= cap) return;
      }
    };
    recursion(0, []);
    return out;
  }

  // 单牌翅膀：允许同点数重复（最多 maxPerRank 张，4 张会成炸故不允许）
  function wingRanks(c, count, maxPerRank) {
    const out = [];
    const acc = [];
    const cap = 2048;
    const dfs = start => {
      if (out.length >= cap) return;
      if (acc.length === count) { out.push(acc.slice()); return; }
      for (let i = start; i < N; i++) {
        const m = Math.min(c[i], maxPerRank, count - acc.length);
        for (let take = 1; take <= m; take++) {
          for (let t = 0; t < take; t++) acc.push(i + 3);
          dfs(i + 1);
          for (let t = 0; t < take; t++) acc.pop();
          if (out.length >= cap) return;
        }
      }
    };
    if (count > 0) dfs(0);
    return out;
  }

  function generateMoves(c, follow) {
    const out = [];
    const seen = new Set();
    const add = cards => {
      const m = classify(cards);
      if (!m) return;
      const k = m.cards.join(',');
      if (seen.has(k)) return;
      seen.add(k);
      out.push(m);
    };

    for (let i = 0; i < N; i++) {
      const k = c[i]; if (!k) continue;
      const r = i + 3;
      add([r]);
      if (k >= 2) add([r, r]);
      if (k >= 3) add([r, r, r]);
      if (k >= 4) add([r, r, r, r]);
    }
    if (c[13] === 1 && c[14] === 1) add([16, 17]);

    // 三带一 / 三带二
    for (let i = 0; i < N; i++) {
      if (c[i] < 3) continue;
      const r = i + 3, trio = [r, r, r];
      const rest = c.slice(); rest[i] -= 3;
      comboRanks(rest, false, 1).forEach(w => add(trio.concat(w)));
      comboRanks(rest, true, 1).forEach(w => add(trio.concat(w, w)));
    }

    // 四带二（单翅膀允许同点成对；对翅膀需两个不同对）
    for (let i = 0; i < N; i++) {
      if (c[i] !== 4) continue;
      const r = i + 3, q = [r, r, r, r];
      const rest = c.slice(); rest[i] = 0;
      wingRanks(rest, 2, 3).forEach(w => add(q.concat(w)));
      comboRanks(rest, true, 2).forEach(w => add(q.concat(w[0], w[0], w[1], w[1])));
    }

    // 顺子
    for (let len = 5; len <= 12; len++) {
      for (let s = 3; s + len - 1 <= 14; s++) {
        if (!isRun(c, s, len, 1)) continue;
        const cards = [];
        for (let r = s; r < s + len; r++) cards.push(r);
        add(cards);
      }
    }
    // 连对
    for (let len = 3; len <= 10; len++) {
      for (let s = 3; s + len - 1 <= 14; s++) {
        if (!isRun(c, s, len, 2)) continue;
        const cards = [];
        for (let r = s; r < s + len; r++) cards.push(r, r);
        add(cards);
      }
    }
    // 飞机
    for (let len = 2; len <= 6; len++) {
      for (let s = 3; s + len - 1 <= 14; s++) {
        if (!isRun(c, s, len, 3)) continue;
        const main = [];
        for (let r = s; r < s + len; r++) main.push(r, r, r);
        add(main);
        const rest = minus(c, main);
        wingRanks(rest, len, 3).forEach(w => add(main.concat(w)));
        comboRanks(rest, true, len).forEach(w => add(main.concat(...w.map(x => [x, x]))));
      }
    }

    if (!follow) return out;
    return out.filter(m => beats(m, follow));
  }

  /* ---------------- 手牌质量：约几手能出完 ---------------- */

  const planMemo = new Map();
  const exactMemo = new Map();

  function planCount(c) {
    const key = c.join('');
    if (planMemo.has(key)) return planMemo.get(key);
    let v;
    const t = total(c);
    if (!t) v = 0;
    else if (t > 16) v = greedyPlans(c, [0]);
    else {
      const r = exactPlans(c, { nodes: 0, budget: 30000 });
      v = (r == null) ? greedyPlans(c, [0]) : r;
    }
    if (planMemo.size > 30000) planMemo.clear();
    planMemo.set(key, v);
    return v;
  }

  function exactPlans(c, ctx) {
    const key = c.join('');
    if (exactMemo.has(key)) return exactMemo.get(key);
    if (!total(c)) return 0;
    let i0 = 0; while (!c[i0]) i0++;
    const cands = anchoredMoves(c, i0);
    let best = 99;
    for (let i = 0; i < cands.length; i++) {
      if (++ctx.nodes > ctx.budget) return null;
      const rest = minus(c, cands[i].cards);
      const v = exactPlans(rest, ctx);
      if (v == null) return null;
      if (v + 1 < best) best = v + 1;
      if (best === 1) break;
    }
    if (exactMemo.size > 60000) exactMemo.clear();
    exactMemo.set(key, best);
    return best;
  }

  function anchoredMoves(c, i0) {
    const out = [], seen = new Set();
    const r = i0 + 3, k = c[i0];
    const add = cs => {
      const m = classify(cs);
      if (!m) return;
      const key = m.cards.join(',');
      if (seen.has(key)) return;
      seen.add(key); out.push(m);
    };
    add([r]);
    if (k >= 2) add([r, r]);
    if (k >= 3) add([r, r, r]);
    if (k === 4) add([r, r, r, r]);
    if (c[13] && c[14]) add([16, 17]);

    // r 作为翅膀挂到更高的三张 / 炸弹上
    for (let j = i0 + 1; j < N; j++) {
      if (c[j] >= 3) {
        add([j + 3, j + 3, j + 3, r]);
        if (c[j] >= 4) add([j + 3, j + 3, j + 3, j + 3, r]);
      }
    }

    // 三张带牌（带最低的几张）
    if (k >= 3) {
      const rest = c.slice(); rest[i0] -= 3;
      comboRanks(rest, false, 1, 2).forEach(w => add([r, r, r].concat(w)));
      comboRanks(rest, true, 1, 2).forEach(w => add([r, r, r].concat(w, w)));
    }

    // 顺子 / 连对 / 飞机（以 r 开头）
    for (let len = 5; len <= 12; len++) {
      if (!isRun(c, r, len, 1)) continue;
      const cs = []; for (let x = r; x < r + len; x++) cs.push(x);
      add(cs);
    }
    for (let len = 3; len <= 10; len++) {
      if (!isRun(c, r, len, 2)) continue;
      const cs = []; for (let x = r; x < r + len; x++) cs.push(x, x);
      add(cs);
    }
    for (let len = 2; len <= 6; len++) {
      if (!isRun(c, r, len, 3)) continue;
      const main = []; for (let x = r; x < r + len; x++) main.push(x, x, x);
      add(main);
      const rest = minus(c, main);
      comboRanks(rest, false, len, 8).forEach(w => add(main.concat(w)));
      comboRanks(rest, true, len, 8).forEach(w => add(main.concat(...w.map(x => [x, x]))));
    }

    // 四带二
    if (k === 4) {
      const rest = c.slice(); rest[i0] = 0;
      comboRanks(rest, false, 2, 4).forEach(w => add([r, r, r, r].concat(w)));
      comboRanks(rest, true, 2, 4).forEach(w => add([r, r, r, r].concat(w, w)));
    }
    return out;
  }

  // modeList 默认 [0,1,2] 供测试与 SOTA 适配；planCount 只传 [0]：
  // 三模式取最小手数会让 planCount 系统性偏低（实测 arena landlord 500 副 −14 局），
  // mode1/2 的理想拆法在对局里兑现不了，启发式会误判自己快走完了。
  function greedyPlans(c, modeList) {
    const modes = modeList || [0, 1, 2];
    let best = 999;
    for (const mode of modes) {
      const cc = c.slice();
      let cnt = 0, guard = 0;
      while (total(cc) > 0 && guard++ < 40) {
        if (cc[13] && cc[14]) { cc[13]--; cc[14]--; cnt++; continue; }
        const m = greedyPick(cc, mode);
        if (!m) break;
        for (const x of m.cards) cc[x - 3]--;
        cnt++;
      }
      if (cnt < best) best = cnt;
    }
    return best;
  }

  // 三种拆牌偏好，候选集完全相同，只改排序权重：
  //   mode 0 = 基线（长牌型优先，与改造前逐字一致）
  //   mode 1 = 整把带走：有长牌型就挑一次扔牌最多的那手
  //   mode 2 = 攒长牌型：先走三张/对子/单张，长牌型留到后面整把出
  // 三种模式是并列的拆牌方案，不互相嵌套：planCount 只用 mode 0，
  // 因为实测把 min(mode0..2) 当手数会让决策过度乐观（arena −14/500）。
  // 注意：mode 0 必须保持与旧实现完全一致，否则 planCount 会整体漂移。
  function greedyPick(cc, mode) {
    // 候选：优先长顺子/连对/飞机，再看三张、对子、单张
    const cand = [];
    for (let len = 12; len >= 5; len--) {
      for (let s = 3; s + len - 1 <= 14; s++) {
        if (isRun(cc, s, len, 1)) {
          const cs = []; for (let x = s; x < s + len; x++) cs.push(x);
          cand.push({ m: classify(cs), w: 100 + len });
        }
      }
    }
    for (let len = 10; len >= 3; len--) {
      for (let s = 3; s + len - 1 <= 14; s++) {
        if (isRun(cc, s, len, 2)) {
          const cs = []; for (let x = s; x < s + len; x++) cs.push(x, x);
          cand.push({ m: classify(cs), w: 90 + len });
        }
      }
    }
    for (let len = 6; len >= 2; len--) {
      for (let s = 3; s + len - 1 <= 14; s++) {
        if (isRun(cc, s, len, 3)) {
          const cs = []; for (let x = s; x < s + len; x++) cs.push(x, x, x);
          cand.push({ m: classify(cs), w: 80 + len });
        }
      }
    }
    for (let i = 0; i < N; i++) {
      if (cc[i] === 4) cand.push({ m: classify([i + 3, i + 3, i + 3, i + 3]), w: 70 });
      if (cc[i] >= 3) cand.push({ m: classify([i + 3, i + 3, i + 3]), w: 60 });
      if (cc[i] >= 2) cand.push({ m: classify([i + 3, i + 3]), w: 50 });
      if (cc[i] >= 1) cand.push({ m: classify([i + 3]), w: 40 });
    }
    const long = { straight: 1, pairseq: 1, plane: 1, plane1: 1, plane2: 1 };
    if (mode === 1) {
      // 整把带走：存在长牌型时，挑一次能扔掉最多牌的那手（同长比小）
      const longs = cand.filter(c => c.m && long[c.m.type]);
      if (longs.length) {
        longs.sort((a, b) => b.m.cards.length - a.m.cards.length || a.m.rank - b.m.rank);
        return longs[0].m;
      }
    } else if (mode === 2) {
      // 攒长牌型：优先走三张/对子/单张，把顺子连对留到后面整把出
      const shorts = cand.filter(c => c.m && !long[c.m.type]);
      if (shorts.length) {
        shorts.sort((a, b) => b.w - a.w);
        return shorts[0].m;
      }
    }
    cand.sort((a, b) => b.w - a.w);
    const pick = cand[0];
    return pick ? pick.m : null;
  }

  /* ---------------- 场上信息 ---------------- */

  // 还没露面的牌（我手牌以外、且尚未打出）
  function unseen(hand, played) {
    const c = zero();
    for (let i = 0; i < N; i++) {
      const full = (i === 13 || i === 14) ? 1 : 4;   // 大小王各一张
      c[i] = Math.max(0, full - hand[i] - played[i]);
    }
    return c;
  }

  // 用「所有未现牌」粗略判断：这手牌有没有可能被压
  function canBeatProxy(u, m) {
    if (m.type === 'rocket') return false;
    if (u[13] && u[14]) return true;
    for (let i = 0; i < N; i++) if (u[i] === 4) return true;
    const t = m.type, len = m.len;
    const NEED = { single: 1, pair: 2, trio: 3, trio1: 3, trio2: 3, straight: 1, pairseq: 2, plane: 3, plane1: 3, plane2: 3 };
    const need = NEED[t] || 0;
    if (!need) return false;
    if (t === 'single' || t === 'pair') {
      for (let i = idx(m.rank) + 1; i < N; i++) if (u[i] >= need) return true;
      return false;
    }
    if (t === 'trio' || t === 'trio1' || t === 'trio2') {
      for (let i = idx(m.rank) + 1; i < N; i++) {
        if (u[i] >= 3) {
          if (t === 'trio') return true;
          let others = 0;
          for (let j = 0; j < N; j++) if (j !== i) others += u[j];
          if (t === 'trio1' && others >= 1) return true;
          if (t === 'trio2') {
            for (let j = 0; j < N; j++) if (j !== i && u[j] >= 2) return true;
          }
        }
      }
      return false;
    }
    if (t === 'straight' || t === 'pairseq') {
      for (let s = m.rank + 1; s + len - 1 <= 14; s++) if (isRun(u, s, len, need)) return true;
      return false;
    }
    if (t === 'plane' || t === 'plane1' || t === 'plane2') {
      for (let s = m.rank + 1; s + len - 1 <= 14; s++) {
        if (!isRun(u, s, len, 3)) continue;
        let rest = 0;
        for (let r = s; r < s + len; r++) rest += u[r - 3] - 3;
        for (let r = 3; r <= 14; r++) if (r < s || r >= s + len) rest += u[r - 3];
        if (t === 'plane' || rest >= len) return true;
      }
      return false;
    }
    return false;
  }

  /* ---------------- 出牌建议 ---------------- */

  function describe(m) {
    if (!m) return '不出';
    const t = m.type, r = rankName(m.rank);
    if (t === 'single') return '单张 ' + r;
    if (t === 'pair') return '对 ' + r;
    if (t === 'trio') return '三张 ' + r;
    if (t === 'trio1') return '三带一 ' + r;
    if (t === 'trio2') return '三带二 ' + r;
    if (t === 'straight') return '顺子 ' + r + '-' + rankName(m.rank + m.len - 1);
    if (t === 'pairseq') return '连对 ' + r + '-' + rankName(m.rank + m.len - 1);
    if (t === 'plane') return '飞机 ' + r + '-' + rankName(m.rank + m.len - 1);
    if (t === 'plane1') return '飞机带单 ' + r + '-' + rankName(m.rank + m.len - 1);
    if (t === 'plane2') return '飞机带对 ' + r + '-' + rankName(m.rank + m.len - 1);
    if (t === 'four2') return '四带二 ' + r;
    if (t === 'four2pair') return '四带两对 ' + r;
    if (t === 'bomb') return '炸弹 ' + r;
    if (t === 'rocket') return '王炸';
    return TYPE_CN[t] || t;
  }

  // 把「334455789TJQKA2」「3 3 4 4 …」「小王 大王」之类解析成 counts
  const TEXT_RANK = {
    '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    t: 10, j: 11, q: 12, k: 13, a: 14, '2': 15,
    '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '二': 15, '两': 15, '小': 16, '大': 17, r: 16, R: 17
  };

  function parseCards(text) {
    const c = zero();
    let s = String(text == null ? '' : text);
    s = s.replace(/大王|大怪|大鬼/g, 'R').replace(/小王|小怪|小鬼/g, 'r').replace(/王/g, '');
    s = s.replace(/10/g, 't');
    s = s.replace(/[\s,，、;；|/\\\-_+。.]/g, '');
    for (const ch of s) {
      const r = TEXT_RANK[ch] || TEXT_RANK[ch.toLowerCase()];
      if (!r) continue;
      const i = r - 3, max = r >= 16 ? 1 : 4;
      if (c[i] >= max) throw new Error(rankName(r) + ' 超过 ' + max + ' 张了');
      c[i]++;
    }
    return c;
  }

  function cardsText(cards) {
    return cards.slice().sort((a, b) => a - b).map(rankName).join(' ');
  }

  function breaksBomb(hand, m) {
    const used = countsOf(m.cards);
    for (let i = 0; i < N; i++) {
      if (hand[i] === 4 && used[i] > 0 && used[i] < 4) return true;
    }
    return false;
  }

  function pruneCandidates(cands) {
    // 同牌型同长度只留最小的 4 个，炸弹/王炸全留，控制计算量
    const groups = new Map();
    const keep = [];
    for (const m of cands) {
      if (m.type === 'bomb' || m.type === 'rocket') { keep.push(m); continue; }
      const k = m.type + '|' + m.len;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    }
    for (const arr of groups.values()) {
      arr.sort((a, b) => a.rank - b.rank);
      keep.push.apply(keep, arr.slice(0, 4));
    }
    return keep;
  }

  /**
   * state = {
   *   hand: counts(15) 我的牌,
   *   me: 0|1|2 我的座位,
   *   landlord: 座位号,
   *   seatCounts: [n,n,n] 每家剩几张,
   *   played: counts(15) 已经打出的所有牌,
   *   last: {seat, move} | null  桌面上最后一手（pass 不改变它）
   * }
   * 返回 {pass, move, options[], reason, notes[], plan, best}
   */
  function heuristicAdvice(state) {
    const hand = state.hand, me = state.me, landlord = state.landlord;
    const last = state.last;
    const follows = !!(last && last.seat !== me);
    const notes = [];
    const lm = last ? last.move : null;

    const teammate = (s) => s !== me && s !== landlord && me !== landlord;
    const nextSeat = (me + 1) % 3;
    const oppNextCount = state.seatCounts[nextSeat];

    const isLandlord = me === landlord;
    const iAmDown = !isLandlord && me === (landlord + 1) % 3; // 地主下家：跑牌为主
    const iAmUp = !isLandlord && me === (landlord + 2) % 3;   // 地主上家：顶牌、变牌
    const bottom = state.bottom || null;

    let plan = planCount(hand);
    notes.push('你手里约 ' + plan + ' 手能出完');

    // 记牌：外面还剩什么（王、2、7、10、整副没露面的点数）
    const rest = unseen(hand, state.played);
    if (bottom && !isLandlord && total(bottom) === 3) {
      notes.push('地主底牌：' + cardsText(cardsOf(bottom)));
    }
    const wang = rest[13] + rest[14], two = rest[12];
    if (wang || two) {
      const parts = [];
      if (wang) parts.push('王 ' + wang + ' 张');
      if (two) parts.push('2 ' + two + ' 张');
      notes.push('外面还有 ' + parts.join('、') + '，单张的控制权还没定');
    }
    if (!rest[4] && !hand[4]) notes.push('7 出光了，外面组不成顺子');
    if (!rest[7] && !hand[7]) notes.push('10 出光了，外面组不成顺子');
    for (let i = 12; i >= 0; i--) {
      if (rest[i] === 4 && !hand[i] && !state.played[i]) {
        notes.push(rankName(i + 3) + ' 四张一张没露，提防有人攥着炸弹');
        break;
      }
    }

    // 队友刚出过牌 → 让队友带牌；能一手走完就直接收
    if (follows && teammate(last.seat) && lm.type !== 'bomb' && lm.type !== 'rocket') {
      const fin = generateMoves(hand, lm).find(m => total(minus(hand, m.cards)) === 0);
      if (fin) {
        return {
          pass: false, move: fin, plan: 0,
          reason: '队友这手正好垫给你：用「' + describe(fin) + '」一手走完，收下这局。',
          options: [], notes: notes.concat(['队友剩 ' + state.seatCounts[last.seat] + ' 张'])
        };
      }
      const mateLeft = state.seatCounts[last.seat];
      return {
        pass: true, move: null, plan,
        reason: '这手是队友出的，让队友继续带牌；你压了反而挡住自己人。',
        options: [],
        notes: notes.concat([mateLeft <= 2 ? '队友只剩 ' + mateLeft + ' 张，稳住别抢' : '地主没接，队友拿回出牌权'])
      };
    }

    const urgency = (() => {
      if (isLandlord) return state.seatCounts.some((n, s) => s !== me && n <= 2);
      return state.seatCounts[landlord] <= 2;
    })();
    if (urgency) notes.push('有人快走完了，该出手就得出手');

    const raw = follows ? generateMoves(hand, lm) : generateMoves(hand, null);
    const cands = pruneCandidates(raw);
    if (follows && !cands.length) {
      const extra = (last.seat === landlord && lm.type === 'single' && lm.rank <= 10)
        ? '地主在放小单，你顶不住——记住他手里可能还有更小的单牌。' : '建议过，别去拆炸弹';
      return {
        pass: true, move: null, plan,
        reason: '要不起，这手压不了。',
        options: [], notes: notes.concat([extra])
      };
    }

    const scored = [];
    for (const m of cands) {
      const restHand = minus(hand, m.cards);
      const restPlan = planCount(restHand);
      let s = -restPlan * 12;
      s -= (m.rank - 3) * (follows ? 0.8 : 0.35);
      if (m.type === 'bomb') s -= urgency ? 0 : 20;
      if (m.type === 'rocket') s -= urgency ? 0 : 28;
    if (breaksBomb(hand, m)) s -= 24;
    // 拆牌惩罚：单张拆对/拆三要付出代价
    if (m.type === 'single' || m.type === 'pair') {
      const same = hand[m.rank - 3];
      const bulk = m.type === 'single' ? 1 : 2;
      if (same > bulk) s -= (same - bulk) * 5.5;
    }
      if (restPlan === 0) s += 260;
      if (restPlan === 1) s += 12;
      if (urgency && restPlan <= 1) s += 30;
      // 2 和大小王是控制牌，不急着用来管小牌
      if (!urgency && m.rank >= 15 && m.type !== 'rocket' && m.type !== 'bomb') s -= 9;

      if (!follows) {
        // 领出：能不能被压，尽量别把控制权送出去
        const canBeat = canBeatProxy(rest, m);
        if (!canBeat) s += 6;
        // 下家只剩 1 张时别领单张
        if (m.type === 'single' && oppNextCount === 1) s -= 14;
        if (m.type === 'pair' && oppNextCount === 2) s -= 6;
        // 留大牌
        const bigBefore = hand[12] + hand[13] + hand[14];
        const bigAfter = restHand[12] + restHand[13] + restHand[14];
        s += (bigAfter - bigBefore) * 3;
        // 地主上家领出：别先送小单让地主顺走
        if (iAmUp && !urgency && m.type === 'single' && m.rank <= 10) s -= 5;
      } else {
        // 跟牌：能出小就别出大；对面快走要压住
        if (!canBeatProxyForFollow(hand, state.played, lm)) s += 2;
        // 地主出牌：小单别放跑，顶牌值得花点代价
        if (!isLandlord && last.seat === landlord) {
          if (lm.type === 'single' && lm.rank <= 10) s += 6;
          if (lm.type === 'pair' && lm.rank <= 10) s += 3;
          if (m.type === 'single' && m.rank >= 11 && m.rank <= 14) s += 3; // K/A 顶牌最划算
        }
        // 地主：压下家、放上家
        if (isLandlord) s += last.seat === (me + 2) % 3 ? -4 : 3;
      }
      scored.push({ m, s, restPlan });
    }
    scored.sort((a, b) => b.s - a.s);

    const best = scored[0];
    const options = scored.slice(0, 4).map(x => ({
      move: x.m, score: Math.round(x.s), restPlan: x.restPlan,
      label: describe(x.m), tag: tagFor(x.m, hand, urgency, follows)
    }));

    let reason;
    // 地主放上家：上家出小牌，别拿 2/王 硬管，留给下一手更划算
    if (isLandlord && follows && !urgency && last.seat === (me + 2) % 3 &&
        best.m.rank >= 15 && best.restPlan > 0) {
      return {
        pass: true, move: null, plan,
        reason: '上家出的小牌，先过一手；别拿 ' + rankName(best.m.rank) + ' 去管，留着压他下一手更划算。',
        options, notes: notes.concat(['手上有' + describe(best.m) + '，可以留着'])
      };
    }
    // 只为压一手小牌就开炸，不划算：除非对面快走完，否则宁可先过
    if (follows && !urgency && (best.m.type === 'bomb' || best.m.type === 'rocket') && best.restPlan > 0) {
      const word = best.m.type === 'rocket' ? '王炸' : '炸弹';
      return {
        pass: true, move: null, plan,
        reason: '只有拿' + word + '才压得住「' + describe(lm) + '」，太亏；先过，' + word + '留着关键时候用。',
        options,
        notes: notes.concat(['手上有' + describe(best.m)])
      };
    }
    if (best.restPlan === 0) {
      reason = '出这手就直接走完了。';
    } else if (!follows) {
      reason = '领出「' + describe(best.m) + '」，出完之后约 ' + best.restPlan + ' 手结束，大牌留在手里压阵。';
    } else if (!isLandlord && last.seat === landlord && lm.type === 'single' && lm.rank <= 10 && best.m.rank <= 14) {
      reason = '地主在放小单，必须顶：用「' + describe(best.m) + '」管住，别让他顺走小牌（压完还剩约 ' + best.restPlan + ' 手）。';
    } else if (isLandlord && last.seat === (me + 2) % 3) {
      reason = '上家出的：「' + describe(best.m) + '」拿走牌权，压完还剩约 ' + best.restPlan + ' 手。';
    } else {
      reason = '用最小的代价压住：' + describe(best.m) + '，压完还剩约 ' + best.restPlan + ' 手。';
    }
    if (best.m.type === 'bomb' || best.m.type === 'rocket') {
      reason = urgency
        ? '要动炸弹/王炸了：' + describe(best.m) + '（对面快走完，保住出牌权）。'
        : '用炸弹终结这一轮：' + describe(best.m) + '（打完只剩约 ' + best.restPlan + ' 手，划算）。';
    }
    return { pass: false, move: best.m, plan: best.restPlan, options, reason, notes };
  }

  /* ---------------- 难度档：free / go / plus / pro100 / pro200 / pro500 / pro9999 / sota ---------------- */

  const TIERS = ['free', 'go', 'plus', 'pro100', 'pro200', 'pro500', 'pro9999', 'sota'];

  // 每档的思考预算：budget = 最多推演多少次，ms = 每手最多花多久
  // sota 不做蒙特卡洛：它是 DouZero WP 神经网络的一次前向（约 30–80ms），预算只作上限提示
  const TIER_CFG = {
    free:    { budget: 0,    ms: 0 },
    go:      { budget: 0,    ms: 0 },
    plus:    { budget: 12,   ms: 120 },
    pro100:  { budget: 100,  ms: 500 },
    pro200:  { budget: 200,  ms: 1000 },
    pro500:  { budget: 500,  ms: 2000 },
    pro9999: { budget: 9999, ms: 4000 },
    sota:    { budget: 0,    ms: 4000 }
  };

  function tierOf(t) {
    if (typeof t === 'number') return TIERS[Math.max(0, Math.min(TIERS.length - 1, t | 0))];
    if (typeof t === 'string') {
      const s = t.toLowerCase();
      if (TIER_CFG[s]) return s;
    }
    return 'go';
  }

  function addCard(c, r) { c[r - 3] = (c[r - 3] || 0) + 1; }

  // 把还没露面的牌随机分给另外两家（推演用）
  // 牌池守恒：发出去的牌必须全部来自「54 张 - 自己手牌 - 已出牌」，
  // 绝不凭空补牌（旧实现在池子不够时随机 addCard，等于给对手塞了牌库里没有的牌）。
  // knownHands[s] 非 null 表示该座位手牌已完全确定（明牌 / 自己），直接照抄、不参与采样。
  function sampleHands(hand, played, seatCounts, me, knownHands) {
    const pool = [];
    const u = unseen(hand, played);
    for (let i = 0; i < N; i++) for (let k = 0; k < u[i]; k++) pool.push(i + 3);

    const hands = [zero(), zero(), zero()];
    hands[me] = hand.slice();

    const fixed = [false, false, false];
    const known = Array.isArray(knownHands) ? knownHands : null;
    for (let s = 0; s < 3; s++) {
      if (s === me) { fixed[s] = true; continue; }
      const kh = known ? known[s] : null;
      if (!kh) continue;
      hands[s] = kh.slice();
      fixed[s] = true;
      for (let i = 0; i < N; i++) {
        const take = Math.min(hands[s][i], pool.filter(r => r === i + 3).length);
        for (let k = 0; k < take; k++) {
          const at = pool.indexOf(i + 3);
          if (at >= 0) pool.splice(at, 1);
        }
      }
    }

    // 只把池子里的牌按未知座位的张数切分；池子不够就少发，绝不凭空造牌
    const unknown = [];
    for (let s = 0; s < 3; s++) if (!fixed[s]) unknown.push(s);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    let p = 0;
    for (const s of unknown) {
      const want = Math.min(seatCounts[s] || 0, pool.length - p);
      for (let k = 0; k < want; k++) addCard(hands[s], pool[p++]);
    }
    // 剩下的牌（张数与 seatCounts 对不上时）补给还缺牌的未知座位，仍只发池内牌
    for (const s of unknown) {
      const want = (seatCounts[s] || 0) - total(hands[s]);
      for (let k = 0; k < want && p < pool.length; k++) addCard(hands[s], pool[p++]);
    }
    // 仍有剩余（调用方 seatCounts 与实际不符）→ 轮转发给未知座位，保证 54 张守恒
    let k = 0;
    while (p < pool.length && unknown.length) {
      addCard(hands[unknown[k % unknown.length]], pool[p++]);
      k++;
    }

    const dealt = total(hands[0]) + total(hands[1]) + total(hands[2]) + total(played);
    if (dealt !== 54) {
      throw new Error('sampleHands 牌数不平：' + dealt + ' != 54（hand=' + total(hand) + ', played=' + total(played) + ', pool=' + u + '）');
    }
    return hands;
  }

  // 推演里各家用同一套轻量策略
  function policyMove(hand, ctx) {
    const last = ctx.last;
    const follows = !!(last && last.seat !== ctx.me);
    const lm = last ? last.move : null;
    const isMate = follows && ctx.landlord !== ctx.me && last.seat !== ctx.landlord;
    if (isMate) {
      const fin = generateMoves(hand, lm).find(m => total(minus(hand, m.cards)) === 0);
      return fin ? { move: fin } : { pass: true };
    }
    const moves = generateMoves(hand, lm);
    if (!moves.length) return { pass: true };
    const urgency = ctx.landlord === ctx.me
      ? ctx.seatCounts.some((n, s) => s !== ctx.me && n <= 2)
      : ctx.seatCounts[ctx.landlord] <= 2;
    let best = null, bs = -1e9;
    for (const m of moves) {
      const rest = minus(hand, m.cards);
      const rp = planCount(rest);
      let s = -rp * 12 - (m.rank - 3) * (follows ? 0.8 : 0.35);
      if (m.type === 'bomb' || m.type === 'rocket') s -= urgency ? 0 : 26;
      if (breaksBomb(hand, m)) s -= 24;
      if (rp === 0) s += 320;
      if (s > bs) { bs = s; best = m; }
    }
    return { move: best };
  }

  function playout(hands, landlord, turn, lastSeat, lastMove) {
    let guard = 0, passes = 0;
    while (guard++ < 400) {
      if (total(hands[turn]) === 0) return turn;
      const ctx = {
        me: turn, landlord,
        seatCounts: [total(hands[0]), total(hands[1]), total(hands[2])],
        last: lastMove ? { seat: lastSeat, move: lastMove } : null
      };
      const act = policyMove(hands[turn], ctx);
      if (act.move) {
        hands[turn] = minus(hands[turn], act.move.cards);
        lastMove = act.move; lastSeat = turn; passes = 0;
      } else {
        passes++;
        if (passes >= 2) { lastMove = null; lastSeat = -1; passes = 0; }
      }
      turn = (turn + 1) % 3;
    }
    return -1;
  }

  // 我下这手（move=null 表示过）的估计胜率
  function estimate(state, move, samples, deadline) {
    let wins = 0, done = 0;
    for (let k = 0; k < samples; k++) {
      if (deadline && Date.now() > deadline) break;
      const hands = sampleHands(state.hand, state.played, state.seatCounts, state.me, state.knownHands);
      let lastSeat = -1, lastMove = null;
      if (move) {
        hands[state.me] = minus(hands[state.me], move.cards);
        if (total(hands[state.me]) === 0) { wins++; done++; continue; }
        lastSeat = state.me; lastMove = move;
      } else {
        if (!state.last) continue;  // 领出不能过
        lastSeat = state.last.seat; lastMove = state.last.move;
      }
      const w = playout(hands, state.landlord, (state.me + 1) % 3, lastSeat, lastMove);
      if (w < 0) continue;
      done++;
      const won = state.me === state.landlord ? w === state.me : w !== state.landlord;
      if (won) wins++;
    }
    return { win: done ? wins / done : 0.5, n: done };
  }

  function cardKey(m) { return m ? m.cards.slice().sort((a, b) => a - b).join(',') : 'pass'; }

  function freeAdvice(state) {
    const follows = !!(state.last && state.last.seat !== state.me);
    const lm = follows ? state.last.move : null;
    const moves = generateMoves(state.hand, lm);
    const notes = ['free 档：随手打，只顾这一手'];
    if (!moves.length) {
      return { pass: true, move: null, plan: planCount(state.hand), reason: '要不起。', options: [], notes, tier: 'free' };
    }
    let m;
    if (Math.random() < 0.55) m = moves[Math.floor(Math.random() * moves.length)];
    else {
      let worst = moves[0], wr = -1;
      for (const x of moves) {
        const rp = planCount(minus(state.hand, x.cards));
        if (rp > wr) { wr = rp; worst = x; }
      }
      m = worst;
    }
    return {
      pass: false, move: m, plan: planCount(minus(state.hand, m.cards)),
      reason: '（free 档）随手出：' + describe(m) + '。', options: [], notes, tier: 'free'
    };
  }

  function refine(base, state, tier) {
    const cfg = TIER_CFG[tier] || TIER_CFG.go;
    const follows = !!(state.last && state.last.seat !== state.me);
    const deadline = cfg.ms ? Date.now() + cfg.ms : 0;
    const pool = [];
    const seen = {};
    (base.options || []).forEach(o => {
      const k = cardKey(o.move);
      if (!seen[k]) { seen[k] = 1; pool.push(o.move); }
    });
    if (base.move && !seen[cardKey(base.move)]) { seen[cardKey(base.move)] = 1; pool.unshift(base.move); }
    if (!pool.length) {
      const list = pruneCandidates(generateMoves(state.hand, follows ? state.last.move : null));
      for (const m of list) { const k = cardKey(m); if (!seen[k]) { seen[k] = 1; pool.push(m); } }
    }
    const cands = pool.slice(0, cfg.budget >= 200 ? 3 : 4);
    if (follows) cands.push(null);

    // 轮流给每个候选发推演次数，直到预算或时间用完
    const stats = cands.map(m => ({ move: m, wins: 0, done: 0 }));
    let used = 0;
    while (used < cfg.budget) {
      if (deadline && Date.now() > deadline) break;
      for (const st of stats) {
        if (used >= cfg.budget) break;
        const r = estimate(state, st.move, 1, 0);
        st.wins += r.win; st.done++; used++;
        if (deadline && Date.now() > deadline) break;
      }
    }

    const rate = st => st.done ? st.wins / st.done : 0.5;
    stats.sort((a, b) => rate(b) - rate(a));
    const top = stats[0];
    const baseKey = base.pass ? 'pass' : cardKey(base.move);
    const baseStat = stats.find(x => cardKey(x.move) === baseKey);

    // 推演结论和启发式差得不多时，尊重启发式的牌形判断
    let chosen = top;
    if (baseStat && rate(top) - rate(baseStat) < 0.03) chosen = baseStat;

    const winPct = Math.round(rate(chosen) * 100);
    const simNote = '推演 ' + used + ' 次，估计胜率 ' + winPct + '%';

    if (!chosen.move) {
      return {
        pass: true, move: null, plan: base.plan,
        reason: '（' + tier + ' 档）这手先过：' + simNote + '，压了反而更亏。',
        options: (base.options || []).slice(0, 4), notes: base.notes.concat([simNote]),
        tier: tier, win: winPct, sims: used
      };
    }
    return {
      pass: false, move: chosen.move, plan: planCount(minus(state.hand, chosen.move.cards)),
      reason: '（' + tier + ' 档）出「' + describe(chosen.move) + '」：' + simNote + '。',
      options: (base.options || []).slice(0, 4), notes: base.notes.concat([simNote]),
      tier: tier, win: winPct, sims: used
    };
  }

  /* ---------------- sota 档：DouZero WP（外部注入的推理钩子） ----------------
   * 引擎本身不碰 ONNX/网络：插件把 src/sota.js 的 rank() 注进来，
   * 权重没下载好、推理抛错、农民位（实测不如启发式）都回退启发式，并写明原因。
   */

  let sotaRankFn = null;
  // 农民位是否也交给 DouZero。默认 false：ai/SOTA.md 实测 300 副，农民位 DouZero 0.800
  // 低于本引擎启发式 0.898（对 plus 档 0.443 对 0.560），换上下家也没变好，
  // 原因是它的农民模型学的是「队友也强」的配合。想复现实验时再打开。
  let sotaFarmer = false;

  function setSotaRank(fn) {
    sotaRankFn = typeof fn === 'function' ? fn : null;
  }

  function setSotaFarmer(on) { sotaFarmer = !!on; }

  function sotaAvailable() { return !!sotaRankFn; }

  function sotaAdvice(state) {
    const base = heuristicAdvice(state);
    const ctx = state && state.sotaCtx;
    if (!sotaRankFn || !ctx) {
      base.tier = 'sota';
      base.fallback = true;
      base.reason = '（sota 档）DouZero 权重还没加载，这一手按启发式走：' + (base.reason || '');
      return base;
    }
    if (ctx.position !== 'landlord' && !sotaFarmer) {
      base.tier = 'sota';
      base.fallback = true;
      base.reason = '（sota 档）农民位按实测回退启发式（DouZero 农民 0.800 < 本引擎 0.898）。' + (base.reason || '');
      return base;
    }
    const lm = state.last && state.last.move ? state.last.move : null;
    const moves = generateMoves(state.hand, lm);
    const canPass = !!lm;
    if (!moves.length) {
      base.tier = 'sota';
      base.reason = '（sota 档）要不起。' + (base.reason || '');
      return base;
    }
    const counts = moves.map(m => { const c = zero(); for (const r of m.cards) c[r - 3]++; return c; });
    // 跟牌时把「过」也交给模型：DouZero 的动作空间里过牌就是全零那行
    if (canPass) counts.push(zero());
    let index;
    try {
      const r = sotaRankFn(ctx, counts);
      index = r && typeof r.index === 'number' ? r.index : -1;
    } catch (err) {
      base.tier = 'sota';
      base.fallback = true;
      base.reason = '（sota 档）推理失败，回退启发式：' + ((err && err.message) || err);
      return base;
    }
    if (index < 0 || index >= counts.length) {
      base.tier = 'sota';
      base.fallback = true;
      base.reason = '（sota 档）没给出合法动作，回退启发式。';
      return base;
    }
    if (index === moves.length) {
      return {
        pass: true, move: null, plan: base.plan,
        reason: '（sota 档）DouZero WP 认为这手该过。',
        options: (base.options || []).slice(0, 4), notes: base.notes || [],
        tier: 'sota'
      };
    }
    const chosen = moves[index];
    return {
      pass: false, move: chosen,
      plan: planCount(minus(state.hand, chosen.cards)),
      reason: '（sota 档）DouZero WP 选「' + describe(chosen) + '」。',
      options: (base.options || []).slice(0, 4), notes: base.notes || [],
      tier: 'sota'
    };
  }

  function advise(state, opts) {
    const tier = tierOf(opts && opts.tier);
    if (tier === 'sota') return sotaAdvice(state);
    if (tier === 'free') return freeAdvice(state);
    const base = heuristicAdvice(state);
    if (tier === 'go') { base.tier = 'go'; return base; }
    return refine(base, state, tier);
  }

  function canBeatProxyForFollow(hand, played, lm) {
    // 我压完之后，对面还有没有更大的
    const u = unseen(hand, played);
    return canBeatProxy(u, lm);
  }

  function tagFor(m, hand, urgency, follows) {
    if (m.type === 'bomb' || m.type === 'rocket') return urgency ? '该炸了' : '保炸弹，别乱用';
    if (follows) return '最省';
    return '先走最长的';
  }

  /* ---------------- 演示对局：AI 打三家 ---------------- */

  function deal() {
    const deck = shuffled(fullDeck());
    const hands = [deck.slice(0, 17), deck.slice(17, 34), deck.slice(34, 51)].map(countsOf);
    return { hands, bottom: deck.slice(51, 54) };
  }

  function pickLandlord(hands) {
    let bestSeat = 0, bestScore = -1e9;
    for (let s = 0; s < 3; s++) {
      const h = hands[s];
      const big = h[12] * 2 + h[13] * 4 + h[14] * 5;
      const score = big * 2 - planCount(h) * 3 + total(h) * 0.1;
      if (score > bestScore) { bestScore = score; bestSeat = s; }
    }
    return bestSeat;
  }

  return {
    N, idx, rk, rankName, NAME, TYPE_CN,
    zero, total, countsOf, minus, addCards, cardsOf, fullDeck, shuffled,
    classify, beats, generateMoves, planCount, unseen, canBeatProxy,
    describe, cardsText, breaksBomb, advise, parseCards, TIERS, tierOf, estimate,
    deal, pickLandlord,
    setSotaRank, setSotaFarmer, sotaAvailable,
    // 内部工具（测试与 SOTA 适配用，不参与 UI）
    sampleHands, greedyPick, greedyPlans
  };
});
