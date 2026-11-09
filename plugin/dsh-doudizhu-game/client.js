/*! dsh-doudizhu-game · 生成的 client.js —— 不要手改，改 src/*.js 后执行 node build.mjs */
window.__ModuleLoader__.load({
  id: 'dsh-doudizhu-game',
  factory(require) {
    // 宿主加载器只传 require；module/exports 由模块自己提供（同 dsh-douyin-research）
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const {
      useState, useEffect, useRef, useMemo, useCallback, useReducer, useLayoutEffect,
    } = React
    const h = React.createElement

    /* ================= 1. 牌型引擎（纯逻辑） ================= */
    const __engine = { exports: {} }
    ;(function (module, exports) {
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

  /* 难度阶梯按「实测胜率」排，不按「推演次数」排。
   *
   * 旧阶梯 8 档，实测（对 DouZero WP、地主位、200 副）
   *   free 0.05 / go 0.56 / plus 0.50 / pro100 0.56 / pro200 0.585 / pro500 0.575
   * 三个毛病：free 低到不像在打牌；plus 反而比 go 差；pro100=go、pro500=pro200。
   *
   * 新阶梯 5 档，同一口径复测
   *   free 0.135 / go 0.56 / plus 0.56 / pro 0.60 / sota 0.674
   * 再往上加预算（700 次推演）实测 0.58 且慢 2.4 倍，所以不设 max 档。
   */
  const TIERS = ['free', 'go', 'plus', 'pro', 'sota'];

  // budget = 最多推演多少次，ms = 每手最多花多久
  // sota 不做蒙特卡洛：它是 DouZero WP 神经网络的一次前向，预算只作上限提示
  const TIER_CFG = {
    free: { budget: 0,   ms: 0 },
    go:   { budget: 0,   ms: 0 },
    plus: { budget: 60,  ms: 200 },
    pro:  { budget: 250, ms: 600 },
    sota: { budget: 0,   ms: 4000 }
  };

  // 旧档位名保留成别名，读老存档（localStorage ddz-tiers）不会掉回默认
  const TIER_ALIAS = {
    pro100: 'pro', pro200: 'pro', pro500: 'pro', pro9999: 'pro', max: 'pro'
  };

  function tierOf(t) {
    if (typeof t === 'number') return TIERS[Math.max(0, Math.min(TIERS.length - 1, t | 0))];
    if (typeof t === 'string') {
      const s = t.toLowerCase();
      if (TIER_CFG[s]) return s;
      if (TIER_ALIAS[s]) return TIER_ALIAS[s];
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
    const notes = ['free 档：只看这一手，挑最小的打'];
    if (!moves.length) {
      return { pass: true, move: null, plan: planCount(state.hand), reason: '要不起。', options: [], notes, tier: 'free' };
    }
    // 新手会做错事，但不该蠢到拆炸弹出小牌：先排除炸弹/王炸（除非手里只剩炸弹能出）
    const plain = moves.filter(m => m.type !== 'bomb' && m.type !== 'rocket');
    const pool = plain.length ? plain : moves;
    // 只保留张数最少的那些（新手不爱打长牌型），再按点数从小到大
    const minLen = Math.min.apply(null, pool.map(m => m.cards.length));
    const small = pool.filter(m => m.cards.length === minLen);
    small.sort((a, b) => a.rank - b.rank || a.cards.length - b.cards.length);
    // 80% 打最小的一手，20% 在同档里随手换一个，免得每局一模一样
    const idx = Math.random() < 0.8 ? 0 : Math.floor(Math.random() * small.length);
    const m = small[idx];
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

    // 推演结论和启发式差得不多时，尊重启发式的牌形判断。
    // 门槛按样本量走：样本少时二项分布抖动大，必须领先很多才敢推翻启发式，
    // 否则 12 次推演就能把一手好牌换成噪声（旧版 plus 档 0.50 低于 go 0.56 就是这个原因）。
    let chosen = top;
    const pTop = rate(top);
    const se = Math.sqrt(Math.max(0.0004, pTop * (1 - pTop) / Math.max(1, top.done)));
    const margin = Math.max(0.03, Math.min(0.12, se));
    if (baseStat && pTop - rate(baseStat) < margin) chosen = baseStat;

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
    describe, cardsText, breaksBomb, advise, parseCards, TIERS, TIER_CFG, TIER_ALIAS, tierOf, estimate,
    deal, pickLandlord,
    setSotaRank, setSotaFarmer, sotaAvailable,
    // 内部工具（测试与 SOTA 适配用，不参与 UI）
    sampleHands, greedyPick, greedyPlans
  };
});

    })(__engine, __engine.exports)
    const DDZ = __engine.exports

    /* ================= 2. 对局规则核心 ================= */
    const __game = { exports: {} }
    ;(function (module, exports) {
/*!
 * 斗地主 · 对局规则核心（纯逻辑，不碰 DOM）
 *
 * 规则要点（按用户确认的口径）：
 *  - 叫地主两种玩法：叫分（0/1/2/3）或抢地主（叫/不叫、抢/不抢），随机一人先叫
 *  - 定地主后三人同时选加倍：1（不加倍）/2（加倍）/4（超级加倍）
 *  - 明牌：亮了就 ×2，并让对手手牌可见
 *  - 底分 1；炸弹 ×2；王炸 ×2；春天 ×2；反春 ×2
 *  - 顺子 ≥5 张；连对 ≥3 对；2 和王不进顺子/连对
 *  - 三带一可以带单王；四带两单/四带两对；飞机带单/带对
 *
 * 座位：0 = 我，1 = 下家（我右边），2 = 上家（我左边）；出牌顺序 0 → 1 → 2 → 0
 */
function GameCore(DDZ) {
  'use strict'

  const N = 15
  const { total, minus, countsOf, cardsOf } = DDZ

  function zero() { return new Array(N).fill(0) }
  function clone(c) { return c.slice() }
  function nextSeat(s) { return (s + 1) % 3 }
  function prevSeat(s) { return (s + 2) % 3 }

  function makeDeck() {
    const deck = []
    for (let r = 3; r <= 15; r++) for (let k = 0; k < 4; k++) deck.push(r)
    deck.push(16, 17)
    return deck
  }

  function shuffledDeck(rng) {
    const a = makeDeck()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor((rng || Math.random)() * (i + 1))
      const t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
  }

  /* ------------------------------------------------------------------ *
   * 新的一局
   * ------------------------------------------------------------------ */

  function createGame(opts) {
    opts = opts || {}
    const mode = opts.mode === 'rob' ? 'rob' : 'score'
    const rng = opts.rng || Math.random
    const tiers = (opts.tiers || ['go', 'go', 'go']).map(t => DDZ.tierOf(t))
    const deck = shuffledDeck(rng)
    const hands = [countsOf(deck.slice(0, 17)), countsOf(deck.slice(17, 34)), countsOf(deck.slice(34, 51))]
    const bottom = countsOf(deck.slice(51))
    const first = Math.floor(rng() * 3)

    const st = {
      mode,
      tiers,
      hands,
      bottom,
      landlord: -1,
      phase: 'bid',            // bid → double → play → over | redeal
      bidOrder: [first, nextSeat(first), prevSeat(first)],
      bidIdx: 0,
      bidHigh: 0,
      bidHighSeat: -1,
      bidLog: [],
      doubleChosen: [false, false, false],
      doubling: [1, 1, 1],
      open: [false, false, false],
      bombs: 0,
      turn: first,
      last: null,              // { seat, move }
      lastLeader: -1,
      passes: 0,
      played: zero(),
      playCounts: [0, 0, 0],
      recent: {},              // seat -> { type:'play', cards } | { type:'pass' }，只存本轮，供牌桌两侧显示
      replay: [],
      winners: null,           // 'landlord' | 'farmers'
      result: null,
      startedAt: Date.now(),
      endedAt: 0,
      base: 1
    }
    st.replay.push({ type: 'deal', hands: hands.map(h => h.slice()), bottom: bottom.slice(), first, mode })
    return st
  }

  /* ------------------------------------------------------------------ *
   * 叫地主
   * ------------------------------------------------------------------ */

  function bidSeat(st) { return st.bidOrder[st.bidIdx] }

  function bidOptions(st) {
    if (st.phase !== 'bid') return []
    if (st.mode === 'score') {
      const opts = [0]
      for (let v = 1; v <= 3; v++) if (v > st.bidHigh) opts.push(v)
      return opts
    }
    return st.bidHighSeat < 0 ? ['call', 0] : ['rob', 0]
  }

  /* ------------------------------------------------------------------ *
   * 手牌强度：结构化评分（叫分 / 加倍共用同一把尺子）
   *
   * 拆成三块，每块都能单独解释、单独验证：
   *   control 控制牌：大王 / 小王 / 2 / A / K 的张数 × 具名权重
   *   power   爆发力：炸弹（四张同点）、王炸
   *   shape   手数：约几手能出完，越少越好（基准 10 手）
   * score = min(10, 三块之和)，对外仍是一个 0..10 的数。
   * 权重全部是 0.05 的整数倍，末了按 2 位小数取整，阈值边界不会被浮点误差抹掉。
   * ------------------------------------------------------------------ */

  const STRENGTH_WEIGHTS = Object.freeze({
    cap: 10,
    control: Object.freeze({ bigJoker: 4.5, smallJoker: 2.4, two: 1.5, ace: 0.8, king: 0.3 }),
    power: Object.freeze({ bomb: 4.2, rocket: 3.5 }),
    shape: Object.freeze({ baseline: 10, perPlan: 0.55 })
  })

  // 叫分 / 抢地主 / 加倍的判定线，全部提为具名常量，不再在分支里散落魔数
  const BID_THRESHOLDS = Object.freeze({ three: 7.4, two: 5.6, one: 4.0, call: 4.6, rob: 5.8 })
  const DOUBLE_THRESHOLDS = Object.freeze({ superDouble: 7.2, double: 5.0 })

  const round2 = x => Math.round(x * 100) / 100

  function strengthBreakdown(st, seat) {
    const raw = st.hands && st.hands[seat]
    const h = (raw && raw.length === N) ? raw : zero()
    const w = STRENGTH_WEIGHTS.control
    const control = {
      bigJoker: h[14] * w.bigJoker,
      smallJoker: h[13] * w.smallJoker,
      two: h[12] * w.two,
      ace: h[11] * w.ace,
      king: h[10] * w.king
    }
    control.total = round2(control.bigJoker + control.smallJoker + control.two + control.ace + control.king)

    let bombs = 0
    for (let i = 0; i < N; i++) if (h[i] === 4) bombs++
    const hasRocket = h[13] > 0 && h[14] > 0
    const power = {
      bombs,
      rocket: hasRocket,
      bombScore: round2(bombs * STRENGTH_WEIGHTS.power.bomb),
      rocketScore: hasRocket ? STRENGTH_WEIGHTS.power.rocket : 0
    }
    power.total = round2(power.bombScore + power.rocketScore)

    const plans = DDZ.planCount(h)
    const saved = Math.max(0, STRENGTH_WEIGHTS.shape.baseline - plans)
    const shape = {
      plans,
      saved,
      perPlan: STRENGTH_WEIGHTS.shape.perPlan,
      total: round2(saved * STRENGTH_WEIGHTS.shape.perPlan)
    }

    const total = round2(control.total + power.total + shape.total)
    return { control, power, shape, raw: total, score: Math.min(STRENGTH_WEIGHTS.cap, total) }
  }

  // 对外行为不变：一个 0..10 的数
  function strength(st, seat) { return strengthBreakdown(st, seat).score }

  // 可解释：把分数拆给人看
  function explainStrength(st, seat) {
    const d = strengthBreakdown(st, seat)
    return `控制牌 ${d.control.total} + 炸弹/王炸 ${d.power.total} + 手数(${d.shape.plans}手/省${d.shape.saved}手) ${d.shape.total} = ${d.score}`
  }

  function aiBid(st, seat) {
    const s = strength(st, seat)
    if (st.mode === 'score') {
      let v = 0
      if (s >= BID_THRESHOLDS.three) v = 3
      else if (s >= BID_THRESHOLDS.two) v = 2
      else if (s >= BID_THRESHOLDS.one) v = 1
      // 已经有人叫得比这高了就叫不了，只能过
      return v > st.bidHigh ? v : 0
    }
    if (st.bidHighSeat < 0) return s >= BID_THRESHOLDS.call ? 'call' : 0
    return s >= BID_THRESHOLDS.rob ? 'rob' : 0
  }

  function applyBid(st, seat, value) {
    if (st.phase !== 'bid' || seat !== bidSeat(st)) throw new Error('还没轮到这家叫')
    const opts = bidOptions(st)
    if (opts.indexOf(value) < 0) throw new Error('这个叫法不合法')
    if (st.mode === 'score') {
      if (value > 0) { st.bidHigh = value; st.bidHighSeat = seat }
      st.bidLog.push({ seat, value })
    } else {
      if (value === 'call' || value === 'rob') st.bidHighSeat = seat
      st.bidLog.push({ seat, value: value === 0 ? 0 : value })
    }
    st.replay.push({ type: 'bid', seat, value })
    st.bidIdx++
    if (st.bidIdx >= 3) {
      if (st.bidHighSeat < 0) {
        st.phase = 'redeal'
        return st
      }
      st.landlord = st.bidHighSeat
      st.hands[st.landlord] = DDZ.addCards(st.hands[st.landlord], cardsOf(st.bottom))
      st.phase = 'double'
    } else {
      st.turn = bidSeat(st)
    }
    return st
  }

  /* ------------------------------------------------------------------ *
   * 加倍
   * ------------------------------------------------------------------ */

  function aiDouble(st, seat) {
    const s = strength(st, seat)
    if (s >= DOUBLE_THRESHOLDS.superDouble) return 4
    if (s >= DOUBLE_THRESHOLDS.double) return 2
    return 1
  }

  function applyDouble(st, seat, value) {
    if (st.phase !== 'double') throw new Error('现在不是加倍阶段')
    if ([1, 2, 4].indexOf(value) < 0) throw new Error('加倍只能选 1/2/4')
    st.doubling[seat] = value
    st.doubleChosen[seat] = true
    st.replay.push({ type: 'double', seat, value })
    if (st.doubleChosen.every(Boolean)) {
      st.phase = 'play'
      st.turn = st.landlord
      st.last = null
      st.passes = 0
    }
    return st
  }

  function applyOpen(st, seat) {
    if (st.phase !== 'play' && st.phase !== 'double') return st
    if (st.open[seat]) return st
    st.open[seat] = true
    st.replay.push({ type: 'open', seat })
    return st
  }

  /* ------------------------------------------------------------------ *
   * 出牌
   * ------------------------------------------------------------------ */

  function legalMoves(st, seat) {
    if (st.phase !== 'play' || st.turn !== seat) return { moves: [], canPass: false }
    const follows = !!(st.last && st.last.seat !== seat)
    const followMove = follows ? st.last.move : null
    let moves = DDZ.generateMoves(st.hands[seat], followMove)
    const seen = Object.create(null)
    moves = moves.filter(m => {
      const k = m.cards.join(',')
      if (seen[k]) return false
      seen[k] = 1
      return true
    })
    // 跟牌时必须真的压过（generateMoves 已保证，这里再兜一次底）
    if (followMove) moves = moves.filter(m => DDZ.beats(m, followMove))
    return { moves, canPass: follows }
  }

  function applyPlay(st, seat, cards) {
    if (st.phase !== 'play' || st.turn !== seat) throw new Error('还没轮到这家出牌')
    const hand = st.hands[seat]
    const c = countsOf(cards)
    for (let i = 0; i < N; i++) if (c[i] > hand[i]) throw new Error('手里没这么多张')
    const move = DDZ.classify(cards)
    if (!move) throw new Error('这手牌不成牌型')
    if (st.last && st.last.seat !== seat && !DDZ.beats(move, st.last.move)) throw new Error('压不过桌上这手牌')

    st.hands[seat] = minus(hand, cards)
    st.played = DDZ.addCards(st.played, cards)
    // 新的一轮：清掉上一轮各家的动作标记
    if (!st.last || st.last.seat === seat) st.recent = {}
    st.last = { seat, move }
    st.recent[seat] = { type: 'play', cards: cards.slice() }
    st.lastLeader = seat
    st.passes = 0
    st.playCounts[seat]++
    if (move.type === 'bomb' || move.type === 'rocket') st.bombs++
    st.replay.push({ type: 'play', seat, cards: cards.slice(), moveType: move.type, rank: move.rank })

    if (total(st.hands[seat]) === 0) {
      st.phase = 'over'
      st.winners = seat === st.landlord ? 'landlord' : 'farmers'
      st.endedAt = Date.now()
      st.result = computeResult(st)
    } else {
      st.turn = nextSeat(seat)
    }
    return st
  }

  function applyPass(st, seat) {
    if (st.phase !== 'play' || st.turn !== seat) throw new Error('还没轮到这家过牌')
    if (!st.last || st.last.seat === seat) throw new Error('你是领出的人，不能过')
    st.passes++
    st.recent[seat] = { type: 'pass' }
    st.replay.push({ type: 'pass', seat })
    if (st.passes >= 2) {
      st.turn = st.lastLeader
      st.last = null
      st.passes = 0
      st.recent = {}
    } else {
      st.turn = nextSeat(seat)
    }
    return st
  }

  /* ------------------------------------------------------------------ *
   * 结算
   * ------------------------------------------------------------------ */

  function computeResult(st) {
    const landlordWon = st.winners === 'landlord'
    const farmersPlayed = [0, 1, 2].filter(s => s !== st.landlord).reduce((a, s) => a + st.playCounts[s], 0)
    const isSpring = landlordWon && farmersPlayed === 0
    const isAnti = !landlordWon && st.playCounts[st.landlord] <= 1

    // 叫分玩法：叫到的分就是底分倍数；抢地主玩法固定按 1 倍底分
    const bidMult = st.mode === 'score' && st.bidHigh > 0 ? st.bidHigh : 1
    let mult = st.base * bidMult
    for (let s = 0; s < 3; s++) mult *= st.doubling[s]
    for (let s = 0; s < 3; s++) if (st.open[s]) mult *= 2
    for (let i = 0; i < st.bombs; i++) mult *= 2
    if (isSpring) mult *= 2
    if (isAnti) mult *= 2

    const delta = [0, 0, 0]
    if (landlordWon) {
      delta[st.landlord] = 2 * mult
      for (let s = 0; s < 3; s++) if (s !== st.landlord) delta[s] = -mult
    } else {
      delta[st.landlord] = -2 * mult
      for (let s = 0; s < 3; s++) if (s !== st.landlord) delta[s] = mult
    }
    return {
      landlordWon,
      spring: isSpring,
      antiSpring: isAnti,
      multiplier: mult,
      base: st.base,
      bid: bidMult,
      delta,
      bombs: st.bombs,
      seconds: Math.max(1, Math.round(((st.endedAt || Date.now()) - st.startedAt) / 1000)),
      doublings: st.doubling.slice(),
      open: st.open.slice()
    }
  }

  /* ------------------------------------------------------------------ *
   * AI：出牌 / 提示
   * ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ *
   * 引擎信息通道
   *
   * 新增两个字段（都是「加字段」，不改旧字段语义）：
   *   open       [bool,bool,bool] 三家是否明牌（亮了牌的那家手牌公开）
   *   knownHands [counts|null ×3] 已知手牌：自己恒可见，明牌的对手也可见，
   *              其余为 null（未知，交给引擎去采样分配）
   *
   * 向后兼容：
   *   - 老调用 adviseState(st, seat) 完全可用；st.open 不存在时按全暗牌处理。
   *   - 第三个可选参数 info 可注入 { open, knownHands }（给 L2 / 记牌器用），
   *     不传就只从 st 推导，不会改写任何对局状态。
   *   - 传给 DDZ.advise 的 state 带上这两个字段；引擎若不认识它们，行为与之前一致。
   * ------------------------------------------------------------------ */

  function countsOrNull(c) {
    return (c && c.length === N) ? c.slice() : null
  }

  function adviseState(st, seat, info) {
    const lastOk = st.last && st.last.seat !== seat ? { seat: st.last.seat, move: st.last.move } : null
    const stOpen = (st.open && st.open.length === 3) ? st.open : [false, false, false]
    const played = (st.played && st.played.length === N) ? st.played : zero()
    // open：允许上层逐座覆盖；没给就用对局里的明牌标记
    const open = [0, 1, 2].map(s => {
      const v = info && info.open && info.open[s] !== undefined ? info.open[s] : stOpen[s]
      return !!v
    })
    // knownHands：自己必知，明牌的座位也公开；其余 null
    const knownHands = [null, null, null]
    for (let s = 0; s < 3; s++) {
      if (s === seat || open[s]) knownHands[s] = countsOrNull(st.hands[s])
    }
    // 上层可逐座覆盖（传 null = 强制置为未知），数组里没给的座位保持推导值
    if (info && info.knownHands) {
      for (let s = 0; s < 3; s++) {
        const v = info.knownHands[s]
        if (v !== undefined) knownHands[s] = countsOrNull(v)
      }
    }
    const out = {
      hand: st.hands[seat],
      me: seat,
      landlord: st.landlord,
      seatCounts: [total(st.hands[0]), total(st.hands[1]), total(st.hands[2])],
      played,
      last: lastOk,
      bottom: st.bottom,
      open,
      knownHands
    }
    // 只有 sota 档才付这份转换的代价，其它档行为完全不变
    if (st.tiers && DDZ.tierOf(st.tiers[seat]) === 'sota') out.sotaCtx = sotaCtx(st, seat)
    return out
  }

  /* ------------------------------------------------------------------ *
   * sota 档的观测：把对局还原成 DouZero 要的 ctx
   *
   * 与 tools/bridge.mjs 的转换逐项一致（那边已用 500/300 副实测过）：
   *   history     每一次出牌/过牌按顺序一帧（过牌是全零），z 取最近 15 帧
   *   perSeat     每家出过的牌（不含手牌）
   *   lastBySeat  每家最近一次出的牌
   *   otherCounts 我看不到的牌 = 全副 - 我的手牌 - 场上所有出牌
   * 农民位也照样给出 ctx（引擎按实测结论在农民位回退启发式，强制实验时才用）。
   * ------------------------------------------------------------------ */

  function fullCounts() {
    const c = zero()
    for (let i = 0; i < 13; i++) c[i] = 4
    c[13] = 1
    c[14] = 1
    return c
  }

  function sotaCtx(st, seat) {
    const landlord = st.landlord
    const upSeat = (landlord + 2) % 3
    const downSeat = (landlord + 1) % 3
    const perSeat = [zero(), zero(), zero()]
    const lastBySeat = [null, null, null]
    const seq = []
    let bombs = 0
    for (const e of (st.replay || [])) {
      if (e.type === 'play') {
        const c = DDZ.countsOf(e.cards)
        seq.push(c)
        for (let i = 0; i < N; i++) perSeat[e.seat][i] += c[i]
        lastBySeat[e.seat] = c
        if (e.moveType === 'bomb' || e.moveType === 'rocket') bombs++
      } else if (e.type === 'pass') {
        seq.push(zero())
      }
    }
    const hand = st.hands[seat]
    const played = (st.played && st.played.length === N) ? st.played : zero()
    const full = fullCounts()
    const other = zero()
    for (let i = 0; i < N; i++) other[i] = Math.max(0, full[i] - hand[i] - played[i])

    // 最近一手别人出的牌；轮到我领出时是全零
    const lastCounts = (st.last && st.last.seat !== seat && st.last.move)
      ? DDZ.countsOf(st.last.move.cards) : zero()

    const seatCounts = [total(st.hands[0]), total(st.hands[1]), total(st.hands[2])]
    const empty = zero()
    const base = {
      myCounts: hand.slice(), otherCounts: other,
      lastCounts, bombNum: Math.min(bombs, 14),
      history: seq.map(c => ({ counts: c }))
    }
    if (seat === landlord) {
      return Object.assign(base, {
        position: 'landlord',
        playedCounts: { landlord_up: perSeat[upSeat], landlord_down: perSeat[downSeat] },
        numLeft: { landlord_up: seatCounts[upSeat], landlord_down: seatCounts[downSeat] }
      })
    }
    const teammate = seat === upSeat ? downSeat : upSeat
    return Object.assign(base, {
      position: seat === upSeat ? 'landlord_up' : 'landlord_down',
      playedCounts: { landlord: perSeat[landlord], teammate: perSeat[teammate] },
      lastLandlordCounts: lastBySeat[landlord] || empty,
      lastTeammateCounts: lastBySeat[teammate] || empty,
      numLeft: { landlord: seatCounts[landlord], teammate: seatCounts[teammate] }
    })
  }

  /* ------------------------------------------------------------------ *
   * 兜底出牌：三条硬约束
   *   ① 不得拆炸弹：把四张同点拆成 1~3 张的候选一律剔除；
   *      跟牌时若只剩这类候选，宁可过牌也不拆（炸弹整出不算拆）。
   *   ② 不得把牌权白送：领出时按「外面同牌型能压住这手的张数」打分，
   *      优先谁都压不住的一手（如最大单张/炸弹），别默认甩一张最小单牌
   *      让下家顺手接管；不把「可能存在炸弹」当成所有牌都失控。
   *   ③ 领出永不返回 null：canPass=false 且合法候选非空时必须给出一手牌。
   * ------------------------------------------------------------------ */

  // 数「外面能压住这手的牌」有几个（只算同牌型/同长度、更大点数；炸弹另算）。
  // 这是给领出排序用的粗粒度代价，越小越能保住牌权。
  function leadBeatCost(counts, m) {
    if (m.type === 'rocket') return 0
    let need
    if (m.type === 'pair' || m.type === 'pairseq') need = 2
    else if (m.type === 'trio' || m.type === 'trio1' || m.type === 'trio2' ||
      m.type === 'plane' || m.type === 'plane1' || m.type === 'plane2') need = 3
    else if (m.type === 'bomb' || m.type === 'four2' || m.type === 'four2pair') need = 4
    else need = 1                                  // single / straight
    const len = m.len || 1
    const isSeq = m.type === 'straight' || m.type === 'pairseq' ||
      m.type === 'plane' || m.type === 'plane1' || m.type === 'plane2'
    let n = 0
    if (isSeq) {
      // 顺子/连对/飞机：2 和王不进，起点上限 14
      for (let s = m.rank + 1; s + len - 1 <= 14; s++) {
        let ok = true
        for (let r = s; r < s + len; r++) if (counts[r - 3] < need) { ok = false; break }
        if (ok) n++
      }
    } else {
      for (let i = m.rank - 2; i < N; i++) if (counts[i] >= need) n++
    }
    // 王炸能压一切非炸弹牌（不作为「全都失控」处理，只加 1 点代价）
    if (m.type !== 'bomb' && m.type !== 'rocket' && counts[13] > 0 && counts[14] > 0) n++
    return n
  }

  function fallbackMove(st, seat) {
    const { moves, canPass } = legalMoves(st, seat)
    if (!moves.length) return { move: null }
    const hand = st.hands[seat]
    const played = (st.played && st.played.length === N) ? st.played : zero()
    const rest = DDZ.unseen(hand, played)
    const restPlan = m => DDZ.planCount(DDZ.minus(hand, m.cards))

    // ① 剔掉拆炸弹的候选
    let pool = moves.filter(m => !DDZ.breaksBomb(hand, m))
    if (!pool.length) {
      // 跟牌：能压的牌都要拆炸弹 → 宁可过，也不拆
      if (canPass) return { move: null }
      // 领出绝不返回 null；优先整出炸弹（不拆），最后才退回全量候选
      const whole = moves.filter(m => m.type === 'bomb' || m.type === 'rocket')
      pool = whole.length ? whole : moves
    }

    // ② 领出：一手走完最优先；否则按「被压代价」从小到大，保住牌权
    const sorted = pool.slice().sort((a, b) => {
      if (!canPass) {
        const winA = DDZ.total(DDZ.minus(hand, a.cards)) === 0 ? -1000 : 0
        const winB = DDZ.total(DDZ.minus(hand, b.cards)) === 0 ? -1000 : 0
        const costA = winA || leadBeatCost(rest, a) + (a.type === 'bomb' || a.type === 'rocket' ? 100 : 0)
        const costB = winB || leadBeatCost(rest, b) + (b.type === 'bomb' || b.type === 'rocket' ? 100 : 0)
        if (costA !== costB) return costA - costB
        const pa = restPlan(a), pb = restPlan(b)
        if (pa !== pb) return pa - pb
        // 同等代价优先多出牌、再优先小点数
        return (b.cards.length - a.cards.length) || (a.rank - b.rank)
      }
      // 跟牌：出代价最小的（张数少、点数小）
      return (a.cards.length - b.cards.length) || (a.rank - b.rank)
    })
    return { move: sorted[0] }
  }

  // 建议合法性：牌面完全一致（各自排序后比对）才算落在合法候选里
  function moveKey(m) {
    return m && Array.isArray(m.cards) ? m.cards.slice().sort((a, b) => a - b).join(',') : ''
  }

  function aiMove(st, seat, info) {
    const t0 = Date.now()
    const { moves, canPass } = legalMoves(st, seat)
    if (!moves.length) return { move: null, reason: '', ms: 0 }
    let res = null
    try {
      res = DDZ.advise(adviseState(st, seat, info), { tier: st.tiers[seat] })
    } catch (e) {
      res = null
    }
    // 引擎判定「不划算、先过」时，AI 也要真的过；否则之前会退成出最小一手，等于从不放牌。
    // 但「领出要过」是非法建议（领出不能过），必须落到兜底领出一手，不能把牌权白送。
    if (res && res.pass && canPass) return { move: null, reason: res.reason || '', win: res.win, ms: Date.now() - t0 }

    const legalSet = new Set(moves.map(moveKey))
    const key = res && !res.pass ? moveKey(res.move) : ''
    // 非法建议（牌面不在合法候选里）不落地；合法但拆炸弹的建议同样不落地
    const valid = !!key && legalSet.has(key) && !DDZ.breaksBomb(st.hands[seat], res.move)
    if (valid) return { move: res.move, reason: res.reason || '', win: res.win, ms: Date.now() - t0 }

    // 非法建议不落地：领出必须走兜底出牌（永不返回 null）；跟牌可以过。
    const fb = fallbackMove(st, seat)
    const reason = (res && res.pass)
      ? '引擎建议过牌，但领出不能过，兜底领出一手'
      : (key ? '引擎建议不合法或会拆炸弹，已走兜底' : '')
    return { move: fb.move, reason, ms: Date.now() - t0 }
  }

  // 提示：所有能出的牌（按大小/张数排好）+ 不出（跟牌时）
  function hintList(st, seat) {
    const { moves, canPass } = legalMoves(st, seat)
    const sorted = moves.slice().sort((a, b) => (a.cards.length - b.cards.length) || (a.rank - b.rank))
    return { moves: sorted, canPass }
  }

  function seatCounts(st) { return [total(st.hands[0]), total(st.hands[1]), total(st.hands[2])] }

  function cloneState(st) {
    return JSON.parse(JSON.stringify(st))
  }

  return {
    createGame, cloneState, strength, strengthBreakdown, explainStrength,
    STRENGTH_WEIGHTS, BID_THRESHOLDS, DOUBLE_THRESHOLDS,
    bidSeat, bidOptions, applyBid, aiBid,
    aiDouble, applyDouble, applyOpen,
    legalMoves, applyPlay, applyPass,
    computeResult, adviseState, aiMove, fallbackMove, hintList, sotaCtx,
    seatCounts, nextSeat, prevSeat
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { GameCore }

    })(__game, __game.exports)
    const G = __game.exports.GameCore(DDZ)

    /* ================= 3. 文案 / 样式 ================= */
/* 界面文案：中文 / English */
const I18N = {
  zh: {
    appName: '斗地主',
    tagline: '三档难度随便挑，打到一半还能让军师支招',
    mode: '玩法',
    modeScore: '叫分',
    modeRob: '抢地主',
    myTier: '我',
    downTier: '下家',
    upTier: '上家',
    start: '开始新一局',
    again: '再来一局',
    reTier: '换挡再战',
    help: '玩法说明',
    back: '返回',
    bidTurn: '{who} 叫地主',
    yourBid: '轮到你叫',
    pass: '不叫',
    call: '叫地主',
    rob: '抢地主',
    noRob: '不抢',
    bidDone: '{who} 当地主',
    bidAllPass: '三家都不叫，重新发牌',
    landlordIs: '地主：{who}',
    doubleTurn: '加倍时间',
    doubleNone: '不加倍',
    doubleX2: '加倍',
    doubleX4: '超级加倍',
    doubled: '{who}：{label}',
    open: '明牌 ×2',
    openOn: '已明牌',
    playing: '出牌中',
    yourTurn: '轮到你',
    thinking: '{tier} 思考中…',
    passAction: '不出',
    playAction: '出牌',
    hint: '提示',
    advice: '问军师',
    adviceTitle: '军师建议',
    adviceWin: '估计胜率 {n}%',
    advisorEmpty: '先看看桌上再说',
    auto: '托管',
    autoOn: '托管中',
    surrender: '认输',
    surrenderAsk: '确定这局认输？',
    confirm: '确定',
    cancel: '取消',
    lands: '剩 {n} 张',
    counter: '记牌器',
    lastPlay: '桌上',
    noPlay: '还没有人出牌',
    you: '你',
    landlordTag: '地主',
    farmerTag: '农民',
    winLandlord: '地主赢了',
    winFarmer: '农民赢了',
    spring: '春天 ×2',
    antiSpring: '反春 ×2',
    bombs: '炸弹 {n} 个',
    multiplier: '倍数 ×{n}',
    timeUsed: '用时 {n} 秒',
    scoreLine: '本局得分 {n}',
    totalScore: '总分 {n}',
    replay: '看复盘',
    replayTitle: '复盘',
    stepPrev: '上一步',
    stepNext: '下一步',
    stepInfo: '第 {i} / {n} 步',
    close: '关闭',
    stats: '战绩',
    playedGames: '已打 {n} 局',
    winRate: '胜率 {n}%',
    sound: '音效',
    lang: 'English',
    selectToast: '选了 {n} 张',
    invalid: '这手牌出不了',
    beatFail: '压不过桌上的牌',
    noCards: '先选牌',
    newDeal: '重新发牌',
    tierNames: {
      free: 'free · 新手',
      go: 'go · 会算牌',
      plus: 'plus · 轻度推演',
      pro: 'pro · 中等推演',
      sota: 'sota · DouZero 冠军模型'
    },
    sotaTitle: 'DouZero 模型',
    sotaIdle: '还没加载，选 sota 档就要用（约 5.8MB）',
    sotaLoading: '正在下载 DouZero 权重… {p}%',
    sotaReady: '已就绪 · 地主位走 DouZero，农民位按实测回退启发式',
    sotaError: '加载失败：{msg}',
    sotaRetry: '重试',
    sotaDownload: '下载模型',
    sotaFallback: '权重没加载好，这一手按启发式走',
    modeDescScore: '叫 1/2/3 分，最高分当地主',
    modeDescRob: '先叫地主，后面的人可以抢',
    modeTitle: '玩法选择',
    tiersTitle: '三家难度',
    bottomCards: '底牌',
    multLabel: '当前倍数',
    baseBidChip: '底分 {base} · 叫分 {bid}',
    bombChip: '炸弹',
    clockChip: '本局 {t}',
    statsTotal: '总场次',
    statsWin: '赢场',
    statsLose: '输场',
    statsRate: '胜率',
    statsBest: '最快胜利 {t}',
    openShort: '明牌',
    turnBid: '叫分阶段 · 轮到 {who} 叫分',
    turnPlay: '出牌中 · {who}',
    nowPhase: '{phase}',
    resultSubWin: '漂亮，这局拿下',
    resultSubLose: '别急，下一把找回来',
    timeUsedLine: '本局用时 {t}',
    helpTitle: '帮助',
    helpList: [
      '按住手牌横向滑动可多选，选中的牌会抬起；再点「出牌」。',
      '快捷键：空格 提示 · 回车 出牌 · Esc 取消。',
      '「问军师」按你的难度档给建议，pro 档以上附估计胜率。',
      '明牌本局倍数 ×2；炸弹 / 王炸每次倍数 ×2。',
      '春天：地主出完而农民一张未出（或反之），倍数再 ×2。'
    ],
    adopt: '采纳并选中',
    stepShort: '第 {i} 步 · 共 {n} 步',
    surrenderTitle: '确定认输？',
    openAsk: '明牌后你的手牌将对两家公开，本局倍数 ×2。',
    baseLabel: '底分',
    bidLabel: '叫分',
    rulesTitle: '规则与难度',
    rulesBody: [
      '叫地主：随机一人先叫；叫分玩法里叫得最高的当地主，都不叫就重新发牌。',
      '加倍：定地主后三家同时选，不加倍 / 加倍 / 超级加倍（4 倍）。',
      '明牌：亮了全场 ×2，对手手牌对你可见。',
      '底分 1；炸弹、王炸各 ×2；春天、反春各 ×2。',
      '跟牌压不过就过；两家连过，回到最后出牌的人重新领出。',
      '难度档只影响电脑，开局前选；托管和军师建议随时能开。'
    ],
    tierHint: '五档：free 新手、go 会算牌、plus / pro 推演越来越细（pro 一手约 40 毫秒）。sota 走 DouZero 冠军模型，一手约 0.1 秒。'
  },
  en: {
    appName: 'Dou Dizhu',
    tagline: 'Pick a difficulty, or let the coach advise mid-game',
    mode: 'Mode',
    modeScore: 'Bid points',
    modeRob: 'Rob landlord',
    myTier: 'Me',
    downTier: 'Right',
    upTier: 'Left',
    start: 'New game',
    again: 'Play again',
    reTier: 'Change tiers',
    help: 'How to play',
    back: 'Back',
    bidTurn: '{who} to bid',
    yourBid: 'Your bid',
    pass: 'Pass',
    call: 'Call',
    rob: 'Rob',
    noRob: 'No rob',
    bidDone: '{who} is landlord',
    bidAllPass: 'All passed — redealing',
    landlordIs: 'Landlord: {who}',
    doubleTurn: 'Double up',
    doubleNone: 'No double',
    doubleX2: 'Double',
    doubleX4: 'Super double',
    doubled: '{who}: {label}',
    open: 'Open hand ×2',
    openOn: 'Hand open',
    playing: 'Playing',
    yourTurn: 'Your turn',
    thinking: '{tier} thinking…',
    passAction: 'Pass',
    playAction: 'Play',
    hint: 'Hint',
    advice: 'Coach',
    adviceTitle: 'Coach says',
    adviceWin: 'Win chance {n}%',
    advisorEmpty: 'Wait for the table',
    auto: 'Auto',
    autoOn: 'Auto on',
    surrender: 'Surrender',
    surrenderAsk: 'Surrender this game?',
    confirm: 'Yes',
    cancel: 'No',
    lands: '{n} left',
    counter: 'Card counter',
    lastPlay: 'On table',
    noPlay: 'Nothing played yet',
    you: 'You',
    landlordTag: 'Landlord',
    farmerTag: 'Farmer',
    winLandlord: 'Landlord wins',
    winFarmer: 'Farmers win',
    spring: 'Spring ×2',
    antiSpring: 'Anti-spring ×2',
    bombs: '{n} bomb(s)',
    multiplier: 'Multiplier ×{n}',
    timeUsed: '{n}s',
    scoreLine: 'Score {n}',
    totalScore: 'Total {n}',
    replay: 'Replay',
    replayTitle: 'Replay',
    stepPrev: 'Prev',
    stepNext: 'Next',
    stepInfo: 'Step {i} / {n}',
    close: 'Close',
    stats: 'Record',
    playedGames: '{n} games',
    winRate: '{n}% win',
    sound: 'Sound',
    lang: '中文',
    selectToast: '{n} selected',
    invalid: 'Invalid play',
    beatFail: 'Does not beat the table',
    noCards: 'Pick cards first',
    newDeal: 'Redeal',
    tierNames: {
      free: 'free · beginner',
      go: 'go · card sense',
      plus: 'plus · light search',
      pro: 'pro · deeper search',
      sota: 'sota · DouZero champion'
    },
    sotaTitle: 'DouZero model',
    sotaIdle: 'Not loaded yet — the sota tier needs it (~5.8MB)',
    sotaLoading: 'Downloading DouZero weights… {p}%',
    sotaReady: 'Ready · landlord plays DouZero, farmers fall back to heuristics',
    sotaError: 'Load failed: {msg}',
    sotaRetry: 'Retry',
    sotaDownload: 'Download',
    sotaFallback: 'Weights not loaded, this move used the heuristic',
    modeDescScore: 'Bid 1/2/3 points, highest becomes landlord',
    modeDescRob: 'Call landlord first, others may rob',
    modeTitle: 'Game mode',
    tiersTitle: 'Three seats, three levels',
    bottomCards: 'Kitty',
    multLabel: 'Multiplier',
    baseBidChip: 'Base {base} · Bid {bid}',
    bombChip: 'Bombs',
    clockChip: 'Time {t}',
    statsTotal: 'Games',
    statsWin: 'Wins',
    statsLose: 'Losses',
    statsRate: 'Win rate',
    statsBest: 'Fastest win {t}',
    openShort: 'Open',
    turnBid: 'Bidding · {who} to bid',
    turnPlay: 'Playing · {who}',
    nowPhase: '{phase}',
    resultSubWin: 'Clean win, nice one',
    resultSubLose: 'Shake it off, next one is yours',
    timeUsedLine: 'Game time {t}',
    helpTitle: 'Help',
    helpList: [
      'Press and drag across your hand to select several cards, then tap Play.',
      'Shortcuts: Space = hint, Enter = play, Esc = clear.',
      'Coach advises by your level; pro levels also show an estimated win rate.',
      'Open hand doubles this game; every bomb or rocket doubles it again.',
      'Spring: landlord finishes while farmers have played nothing (or vice versa) — another x2.'
    ],
    adopt: 'Adopt selection',
    stepShort: 'Step {i} of {n}',
    surrenderTitle: 'Surrender?',
    openAsk: 'Your hand becomes visible to both opponents; this game is doubled.',
    baseLabel: 'Base',
    bidLabel: 'Bid',
    rulesTitle: 'Rules & levels',
    rulesBody: [
      'Bidding: a random player bids first. Highest bid becomes landlord; all pass means redeal.',
      'Doubling: after the landlord is set, all three pick no double / double / super double (×4).',
      'Open hand: reveals your cards, doubles the stake, and exposes opponents to you.',
      'Base 1; each bomb and rocket ×2; spring and anti-spring ×2.',
      'You may pass when following; two passes end the trick and the last player leads.',
      'Difficulty only affects the bots, chosen before the deal. Auto-play and coach are always available.'
    ],
    tierHint: 'Five tiers: free (beginner), go (card sense), plus / pro (deeper search, pro about 40ms per move). sota uses the DouZero champion model, about 0.1s per move.'
  }
}

/* 斗地主插件样式：鲸鱼娘浅色柔和风（移植自 Kimi 原型） */
const CSS = String.raw`
/* ============================================================
   斗地主插件 · 浅色柔和可爱视觉（移植自 ui-kimi 原型）
   令牌与类名与交接文档一一对应；所有规则均限定在 .ddz-root 内，
   不引入全局重置，避免污染宿主 DSH UI。
   ============================================================ */

/* ---------- 设计令牌（浅色为默认） ---------- */
.ddz-root {
  --ddz-bg: #F5F8FC;
  --ddz-felt: radial-gradient(120% 90% at 50% 0%, #EAF4FC 0%, #F7FBFE 55%, #EEF6FB 100%);
  --ddz-panel: rgba(255, 255, 255, 0.82);
  --ddz-panel-solid: #FFFFFF;
  --ddz-line: rgba(30, 79, 156, 0.10);
  --ddz-line-strong: rgba(30, 79, 156, 0.18);
  --ddz-text: #1B2A44;
  --ddz-dim: #6B7C99;
  --ddz-accent: #4BA3E3;
  --ddz-accent-deep: #1E4F9C;
  --ddz-accent-weak: rgba(75, 163, 227, 0.14);
  --ddz-whale: #7EC8E8;
  --ddz-good: #3DBF8F;
  --ddz-bad: #F07178;
  --ddz-gold: #D4A84B;
  --ddz-card-bg: linear-gradient(165deg, #FFFFFF 0%, #F3F7FC 100%);
  --ddz-card-ink: #1B2A44;
  --ddz-red: #E25563;
  --ddz-radius-panel: 18px;
  --ddz-radius-btn: 12px;
  --ddz-radius-card: 14px;
  --ddz-shadow-soft: 0 8px 20px rgba(30, 79, 156, 0.08);
  --ddz-shadow-panel: 0 12px 32px rgba(30, 79, 156, 0.10);
  --ddz-font: "PingFang SC", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif;

  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--ddz-text);
  background: var(--ddz-bg);
  font-family: var(--ddz-font);
  font-size: 14px;
  user-select: none;
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  .ddz-root {
    --ddz-bg: #101826;
    --ddz-felt: radial-gradient(120% 90% at 50% 0%, #16233A 0%, #101826 60%, #131F33 100%);
    --ddz-panel: rgba(24, 36, 56, 0.86);
    --ddz-panel-solid: #1A2740;
    --ddz-line: rgba(126, 200, 232, 0.12);
    --ddz-line-strong: rgba(126, 200, 232, 0.22);
    --ddz-text: #E8F0FA;
    --ddz-dim: #8FA3C0;
    --ddz-accent: #5FB0EA;
    --ddz-accent-deep: #7EC8E8;
    --ddz-accent-weak: rgba(95, 176, 234, 0.16);
    --ddz-good: #4CD6A4;
    --ddz-bad: #FF8A90;
    --ddz-gold: #E5BE6B;
    --ddz-card-bg: linear-gradient(165deg, #24344F 0%, #1B2940 100%);
    --ddz-card-ink: #EAF2FB;
    --ddz-red: #F27E8A;
  }
}

/* 局部重置：只作用于插件根节点及其内部元素 */
.ddz-root,
.ddz-root * {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}
/* 原型 button 重置；:where() 归零特异性，保证 .ddz-btn / .ddz-chipbtn 等类样式仍能覆盖 */
.ddz-root :where(button) {
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
  color: inherit;
  font-size: inherit;
}
.ddz-root :focus-visible {
  outline: 2px solid var(--ddz-accent);
  outline-offset: 2px;
}

/* ---------- 屏幕切换 ---------- */
.ddz-root > .ddz-screen { position: absolute; inset: 0; display: flex; flex-direction: column; opacity: 0; pointer-events: none; transition: opacity .22s ease-out; }
.ddz-root > .ddz-screen.is-on { opacity: 1; pointer-events: auto; }

/* ---------- 通用按钮 ---------- */
.ddz-btn {
  min-height: 44px; padding: 0 20px; border-radius: var(--ddz-radius-btn);
  font-size: 14px; font-weight: 600; letter-spacing: .02em;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  transition: transform .15s ease-out, box-shadow .15s ease-out, background .15s ease-out, opacity .15s;
}
.ddz-btn:active { transform: scale(.97); }
.ddz-btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
.ddz-btn--primary {
  color: #fff;
  background: linear-gradient(150deg, var(--ddz-accent) 0%, var(--ddz-accent-deep) 100%);
  box-shadow: 0 6px 16px rgba(75, 163, 227, .35);
  min-width: 160px;
}
.ddz-btn--primary:hover:not(:disabled) { box-shadow: 0 8px 22px rgba(75, 163, 227, .45); transform: translateY(-1px); }
.ddz-btn--ghost {
  color: var(--ddz-accent-deep); background: var(--ddz-panel-solid);
  border: 1px solid var(--ddz-line-strong);
}
.ddz-btn--ghost:hover:not(:disabled) { background: var(--ddz-accent-weak); }
.ddz-btn--danger {
  color: var(--ddz-bad); background: var(--ddz-panel-solid);
  border: 1px solid rgba(240, 113, 120, .45);
}
.ddz-btn--danger:hover:not(:disabled) { background: rgba(240, 113, 120, .10); }

/* ============================================================
   开局设置页 .ddz-setup
   ============================================================ */
.ddz-setup {
  background: var(--ddz-felt);
  align-items: center; justify-content: center; padding: 24px; overflow-y: auto;
}
.ddz-setup-card {
  position: relative; width: 100%; max-width: 720px;
  background: var(--ddz-panel); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--ddz-line); border-radius: 22px;
  box-shadow: var(--ddz-shadow-panel);
  padding: 36px 40px 28px; overflow: hidden;
}
.ddz-setup-watermark {
  position: absolute; right: -40px; top: -20px; width: 300px; opacity: .14;
  pointer-events: none; transform: rotate(6deg);
}
.ddz-setup-head { position: relative; display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.ddz-setup-title { font-size: 28px; font-weight: 650; letter-spacing: .04em; display: flex; align-items: center; gap: 10px; }
.ddz-whale-mark { width: 34px; height: 34px; flex: none; }
.ddz-setup-sub { position: relative; color: var(--ddz-dim); font-size: 13px; margin-bottom: 26px; }
.ddz-setup h3 { font-size: 14px; font-weight: 600; color: var(--ddz-dim); margin: 20px 0 10px; letter-spacing: .05em; }

.ddz-modecard { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ddz-mode {
  position: relative; min-height: 72px; border-radius: var(--ddz-radius-panel);
  background: var(--ddz-panel-solid); border: 1.5px solid var(--ddz-line);
  display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 4px;
  padding: 14px 18px; text-align: left; transition: all .18s ease-out;
}
.ddz-mode b { font-size: 16px; font-weight: 650; }
.ddz-mode span { font-size: 12px; color: var(--ddz-dim); }
.ddz-mode:hover { border-color: var(--ddz-line-strong); transform: translateY(-1px); }
.ddz-mode.is-on { border-color: var(--ddz-accent); background: var(--ddz-accent-weak); box-shadow: 0 4px 14px rgba(75,163,227,.18); }

.ddz-tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.ddz-tier {
  background: var(--ddz-panel-solid); border: 1.5px solid var(--ddz-line);
  border-radius: var(--ddz-radius-panel); padding: 14px 14px 12px;
  display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all .18s ease-out;
}
.ddz-tier.is-on { border-color: var(--ddz-accent); box-shadow: 0 4px 14px rgba(75,163,227,.16); }
.ddz-tier .ddz-avatar { width: 40px; height: 40px; }
.ddz-tier-name { font-size: 13px; font-weight: 600; }
.ddz-tier select {
  width: 100%; height: 36px; border-radius: 10px; font-size: 13px;
  border: 1px solid var(--ddz-line-strong); background: var(--ddz-bg); color: var(--ddz-text);
  padding: 0 8px; font-family: inherit;
}

.ddz-setup-actions { position: relative; display: flex; gap: 12px; margin-top: 28px; }
.ddz-statsline {
  position: relative; margin-top: 20px; padding-top: 14px;
  border-top: 1px solid var(--ddz-line);
  font-size: 12px; color: var(--ddz-dim); display: flex; gap: 18px; flex-wrap: wrap;
}
.ddz-statsline b.win { color: var(--ddz-good); font-weight: 650; }
.ddz-statsline b.lose { color: var(--ddz-bad); font-weight: 650; }

/* ---------- 头像 ---------- */
.ddz-avatar {
  width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex: none;
  border: 2px solid #fff; box-shadow: 0 0 0 2px rgba(126, 200, 232, .45), 0 4px 10px rgba(30,79,156,.15);
  background: var(--ddz-panel-solid);
  display: block; overflow: hidden;
}
.ddz-avatar--lg { width: 48px; height: 48px; }
.ddz-crown {
  position: absolute; top: -12px; right: -8px; width: 24px; height: 24px;
  filter: drop-shadow(0 2px 4px rgba(212, 168, 75, .5));
}

/* ============================================================
   牌桌页
   ============================================================ */
.ddz-table { background: var(--ddz-felt); }

.ddz-topbar {
  height: 48px; flex: none; display: flex; align-items: center; gap: 12px;
  padding: 0 16px; background: var(--ddz-panel); backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--ddz-line); z-index: 30;
}
.ddz-title { display: flex; align-items: baseline; gap: 10px; margin-right: auto; }
.ddz-title b { font-size: 17px; font-weight: 650; letter-spacing: .05em; }
.ddz-title small { font-size: 12px; color: var(--ddz-dim); }
.ddz-chips { display: flex; gap: 8px; align-items: center; }
.ddz-chipbtn {
  height: 30px; padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 600;
  background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line-strong);
  color: var(--ddz-dim); display: inline-flex; align-items: center; gap: 5px;
  transition: all .15s ease-out; white-space: nowrap;
}
.ddz-chipbtn:hover { color: var(--ddz-accent-deep); border-color: var(--ddz-accent); }
.ddz-chipbtn.is-on { background: var(--ddz-accent-weak); color: var(--ddz-accent-deep); border-color: var(--ddz-accent); }
.ddz-chipbtn svg { width: 14px; height: 14px; }

/* 记牌器 */
.ddz-counterbar {
  flex: none; overflow: hidden; max-height: 0; transition: max-height .25s ease-out;
  border-bottom: 1px solid transparent;
}
.ddz-counterbar.is-open { max-height: 96px; border-bottom-color: var(--ddz-line); }
.ddz-counterbar-in { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px; }
.ddz-count {
  min-width: 44px; padding: 5px 8px; border-radius: 10px; text-align: center;
  background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line);
  font-size: 12px; line-height: 1.35; transition: all .15s;
}
.ddz-count b { display: block; font-size: 13px; }
.ddz-count .cnt { color: var(--ddz-dim); font-size: 11px; }
.ddz-count.is-hot { border-color: var(--ddz-gold); box-shadow: 0 0 0 1px var(--ddz-gold), 0 2px 8px rgba(212,168,75,.25); }
.ddz-count.is-zero { opacity: .35; }

/* 底牌 + 倍率信息条 */
.ddz-statusbar {
  flex: none; display: flex; align-items: center; justify-content: center; gap: 22px;
  padding: 10px 20px 0; flex-wrap: wrap;
}
.ddz-bottomcards { display: flex; align-items: center; gap: 8px; }
.ddz-root #bottom-cards { display: flex; gap: 6px; }
.ddz-bottomcards .lbl { font-size: 12px; color: var(--ddz-dim); margin-right: 2px; }
.ddz-bottomcards .ddz-card { width: 40px; height: 56px; border-radius: 10px; padding: 4px 5px; }
.ddz-bottomcards .ddz-card .rk { font-size: 14px; }
.ddz-bottomcards .ddz-card .st { font-size: 11px; }
.ddz-bottomcards .ddz-card--joker .rk { font-size: 9px; }
.ddz-mult {
  display: flex; align-items: baseline; gap: 6px;
  background: linear-gradient(135deg, rgba(229,190,107,.22), rgba(212,168,75,.10));
  border: 1px solid rgba(212,168,75,.45); border-radius: 12px; padding: 6px 14px;
}
.ddz-mult .x { font-size: 20px; font-weight: 800; color: var(--ddz-gold); letter-spacing: .02em; }
.ddz-mult .t { font-size: 11px; color: var(--ddz-dim); }
.ddz-statuschips { display: flex; gap: 6px; flex-wrap: wrap; }
.ddz-statuschip {
  font-size: 11px; color: var(--ddz-dim); background: var(--ddz-panel-solid);
  border: 1px solid var(--ddz-line); border-radius: 999px; padding: 4px 10px; white-space: nowrap;
}
.ddz-statuschip b { color: var(--ddz-text); }
.ddz-statuschip.bomb b { color: var(--ddz-bad); }

/* 座位行 */
.ddz-seatrow { flex: none; display: flex; align-items: flex-start; justify-content: space-between; padding: 14px 20px 0; }
.ddz-seat {
  position: relative; display: flex; align-items: center; gap: 10px;
  background: var(--ddz-panel); backdrop-filter: blur(10px);
  border: 1.5px solid var(--ddz-line); border-radius: 16px;
  padding: 8px 14px 8px 8px; box-shadow: var(--ddz-shadow-soft);
  transition: border-color .2s, box-shadow .2s; max-width: 220px;
}
.ddz-seat.is-turn { border-color: var(--ddz-accent); animation: ddz-breathe 2s ease-in-out infinite; }
@keyframes ddz-breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(75,163,227,.35), var(--ddz-shadow-soft); }
  50% { box-shadow: 0 0 0 6px rgba(75,163,227,0), var(--ddz-shadow-soft); }
}
.ddz-seat-av { position: relative; flex: none; }
.ddz-seat-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ddz-seat-name { font-size: 13px; font-weight: 650; display: flex; align-items: center; gap: 6px; }
.ddz-seat-sub { font-size: 11px; color: var(--ddz-dim); }
.ddz-tags { display: flex; gap: 4px; }
.ddz-landlord-tag {
  font-size: 10px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #E5BE6B, var(--ddz-gold));
  padding: 1px 7px; border-radius: 999px;
}
.ddz-open-tag { font-size: 10px; font-weight: 600; color: #fff; background: var(--ddz-whale); padding: 1px 7px; border-radius: 999px; }
.ddz-pass-tag {
  position: absolute; right: -14px; top: -12px; font-size: 12px; font-weight: 700;
  color: var(--ddz-dim); background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line-strong);
  padding: 3px 9px; border-radius: 999px; transform: rotate(-6deg);
  animation: ddz-pass-pop .18s ease-out;
}
@keyframes ddz-pass-pop { from { opacity: 0; transform: rotate(-6deg) scale(.8); } to { opacity: 1; transform: rotate(-6deg) scale(1); } }
.ddz-turnpill {
  align-self: center; background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line);
  border-radius: 999px; padding: 7px 18px; font-size: 13px; font-weight: 600; color: var(--ddz-dim);
  box-shadow: var(--ddz-shadow-soft); white-space: nowrap;
}
.ddz-turnpill b { color: var(--ddz-text); }

/* 中央 */
.ddz-mid { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 8px 16px; position: relative; }
.ddz-mid::before {
  content: ''; position: absolute; left: 50%; top: 50%; width: min(720px, 88%); height: 88%;
  transform: translate(-50%,-50%); border-radius: 50%;
  border: 1.5px solid rgba(75,163,227,.16);
  background: radial-gradient(closest-side, rgba(255,255,255,.5), rgba(255,255,255,0) 78%);
  box-shadow: inset 0 0 60px rgba(126,200,232,.10);
  pointer-events: none;
}
.ddz-mid-whale {
  position: absolute; left: 50%; top: 50%; width: 150px; height: 150px;
  transform: translate(-50%,-50%); opacity: .055; pointer-events: none;
}
.ddz-mid-grid {
  position: relative; display: grid; grid-template-columns: 1fr auto 1fr;
  align-items: center; gap: 24px; width: 100%; max-width: 900px;
}
.ddz-mid-center { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.ddz-sideplay { display: flex; flex-direction: column; align-items: center; gap: 8px; min-height: 96px; justify-content: center; }
.ddz-sideplay .who { font-size: 12px; color: var(--ddz-dim); }
.ddz-sideplay .ddz-played { min-height: 0; }
.ddz-sideplay .ddz-played .ddz-card { animation: none; }
.ddz-sidepass {
  font-size: 14px; font-weight: 700; color: var(--ddz-dim);
  background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line-strong);
  border-radius: 999px; padding: 6px 16px; transform: rotate(-5deg);
  box-shadow: var(--ddz-shadow-soft); animation: ddz-pass-pop .18s ease-out;
}
.ddz-lastlabel { font-size: 12px; color: var(--ddz-dim); letter-spacing: .04em; }
.ddz-played { display: flex; min-height: 84px; align-items: center; }
.ddz-played .ddz-card { margin-left: -18px; animation: ddz-fly-in .22s ease-out backwards; }
.ddz-played .ddz-card:first-child { margin-left: 0; }
.ddz-played .ddz-card:nth-child(1) { animation-delay: .00s; }
.ddz-played .ddz-card:nth-child(2) { animation-delay: .05s; }
.ddz-played .ddz-card:nth-child(3) { animation-delay: .10s; }
.ddz-played .ddz-card:nth-child(4) { animation-delay: .15s; }
.ddz-played .ddz-card:nth-child(5) { animation-delay: .20s; }
.ddz-played .ddz-card:nth-child(6) { animation-delay: .25s; }
@keyframes ddz-fly-in { from { opacity: 0; transform: translateY(26px) scale(.92); } to { opacity: 1; transform: translateY(0) scale(1); } }
.ddz-played.is-bomb .ddz-card { animation: ddz-bomb .32s ease-out; }
@keyframes ddz-bomb {
  0% { transform: scale(1); filter: brightness(1); }
  40% { transform: scale(1.06); filter: brightness(1.35) drop-shadow(0 0 10px rgba(212,168,75,.8)); }
  100% { transform: scale(1); filter: brightness(1); }
}
.ddz-think { display: flex; align-items: center; gap: 8px; color: var(--ddz-dim); font-size: 13px; }
.ddz-spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--ddz-accent-weak); border-top-color: var(--ddz-accent); animation: ddz-spin .8s linear infinite; }
@keyframes ddz-spin { to { transform: rotate(360deg); } }
.ddz-mid-empty { color: var(--ddz-dim); font-size: 13px; }

/* 手牌 */
.ddz-handwrap { flex: none; padding: 12px 0 4px; }
.ddz-hand { display: flex; justify-content: center; align-items: flex-end; min-height: 136px; padding: 0 12px; }
.ddz-hand .ddz-card { margin-left: -36px; transition: transform .15s ease-out, box-shadow .15s ease-out; }
.ddz-hand .ddz-card:first-child { margin-left: 0; }
.ddz-hand .ddz-card:hover { transform: translateY(-10px); }
.ddz-hand .ddz-card.is-sel { transform: translateY(-18px); box-shadow: 0 0 0 2px var(--ddz-accent), 0 14px 22px rgba(75,163,227,.30); }
.ddz-hand.is-disabled { opacity: .5; pointer-events: none; }

/* 扑克牌面 */
.ddz-card {
  width: 80px; height: 112px; border-radius: var(--ddz-radius-card);
  background: var(--ddz-card-bg); border: 1px solid var(--ddz-line);
  box-shadow: 0 6px 14px rgba(30,79,156,.15), inset 0 1px 0 rgba(255,255,255,.7);
  display: flex; flex-direction: column; justify-content: space-between; padding: 8px 10px;
  font-weight: 700; position: relative; flex: none;
}
@media (prefers-color-scheme: dark) { .ddz-card { box-shadow: 0 3px 8px rgba(0,0,0,.35); } }
.ddz-card .rk { font-size: 25px; line-height: 1.1; }
.ddz-card .st { font-size: 20px; line-height: 1; }
.ddz-card .rk.red, .ddz-card .st.red { color: var(--ddz-red); }
.ddz-card .rk.ink, .ddz-card .st.ink { color: var(--ddz-card-ink); }
.ddz-card--small { width: 56px; height: 80px; border-radius: 12px; padding: 6px 7px; }
.ddz-card--small .rk { font-size: 19px; }
.ddz-card--small .st { font-size: 14px; }
.ddz-card--joker .rk { font-size: 15px; letter-spacing: 0; }
.ddz-card--joker.ddz-card--small .rk { font-size: 11px; }

/* 牌背 */
.ddz-back {
  width: 34px; height: 48px; border-radius: 9px; flex: none;
  background: linear-gradient(150deg, #8FCEF0 0%, var(--ddz-accent) 60%, var(--ddz-accent-deep) 130%);
  border: 2px solid #fff; box-shadow: 0 3px 8px rgba(30,79,156,.18);
  position: relative; overflow: hidden;
}
.ddz-back::before {
  content: ''; position: absolute; inset: 3px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.55);
  background: repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 4px, transparent 4px 8px);
}
.ddz-back::after {
  content: ''; position: absolute; left: 50%; top: 50%; width: 14px; height: 10px;
  transform: translate(-50%,-50%); border-radius: 50% 50% 45% 45%;
  background: rgba(255,255,255,.85);
  clip-path: polygon(0 40%, 15% 0, 45% 20%, 60% 0, 75% 35%, 100% 20%, 85% 70%, 60% 100%, 25% 90%);
}
.ddz-cardstack { position: relative; width: 44px; height: 52px; flex: none; }
.ddz-cardstack .ddz-back { position: absolute; width: 30px; height: 42px; }
.ddz-cardstack .ddz-back:nth-child(1) { left: 0; top: 6px; transform: rotate(-8deg); opacity: .75; }
.ddz-cardstack .ddz-back:nth-child(2) { left: 7px; top: 3px; transform: rotate(-2deg); opacity: .9; }
.ddz-cardstack .ddz-back:nth-child(3) { left: 14px; top: 0; transform: rotate(5deg); }
.ddz-cardstack .n {
  position: absolute; right: -8px; bottom: -4px; z-index: 2;
  background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line-strong);
  color: var(--ddz-accent-deep); font-size: 11px; font-weight: 700;
  border-radius: 999px; padding: 1px 7px; box-shadow: var(--ddz-shadow-soft);
}

/* 底部信息 + 操作 */
.ddz-bottom { flex: none; padding: 4px 16px calc(12px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 10px; }
.ddz-myseat { display: flex; align-items: center; justify-content: center; gap: 10px; }
.ddz-myseat .ddz-seat { padding: 6px 16px 6px 6px; }
.ddz-ring { position: absolute; inset: -5px; width: calc(100% + 10px); height: calc(100% + 10px); pointer-events: none; }
.ddz-ring circle { fill: none; stroke: var(--ddz-accent); stroke-width: 3; stroke-linecap: round; transform: rotate(-90deg); transform-origin: center; transition: stroke-dashoffset 1s linear, stroke .2s; }
.ddz-ring circle.hot { stroke: var(--ddz-bad); }
.ddz-info { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--ddz-dim); padding: 0 8px; min-height: 18px; }
.ddz-info .sel-n { color: var(--ddz-accent-deep); font-weight: 600; }
.ddz-actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
.ddz-actions .ddz-btn { min-height: 40px; padding: 0 18px; font-size: 13px; min-width: 0; }

/* 建议卡 */
.ddz-advice {
  position: absolute; right: 18px; bottom: 130px; width: 250px;
  background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line);
  border-radius: 16px; box-shadow: var(--ddz-shadow-panel); padding: 14px 16px; z-index: 25;
  animation: ddz-advice-in .2s ease-out;
}
@keyframes ddz-advice-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.ddz-advice-head { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 650; margin-bottom: 8px; }
.ddz-advice-head svg { width: 18px; height: 18px; }
.ddz-advice-move { font-size: 14px; font-weight: 650; color: var(--ddz-accent-deep); margin-bottom: 4px; }
.ddz-advice-why { font-size: 12px; color: var(--ddz-dim); line-height: 1.5; margin-bottom: 8px; }
.ddz-advice-rate { font-size: 12px; color: var(--ddz-good); font-weight: 600; margin-bottom: 10px; }
.ddz-advice .ddz-btn { width: 100%; min-height: 36px; font-size: 13px; }

/* ============================================================
   弹层
   ============================================================ */
.ddz-overlay {
  position: absolute; inset: 0; background: rgba(27, 42, 68, .28);
  display: flex; align-items: center; justify-content: center; z-index: 50;
  opacity: 0; pointer-events: none; transition: opacity .2s ease-out; padding: 20px;
}
.ddz-overlay.is-on { opacity: 1; pointer-events: auto; }
.ddz-dialog {
  width: 100%; max-width: 460px; background: var(--ddz-panel-solid);
  border-radius: 20px; box-shadow: 0 24px 60px rgba(30,79,156,.25);
  padding: 26px 26px 22px; position: relative; overflow: hidden;
  transform: scale(.95); transition: transform .2s ease-out;
}
.ddz-overlay.is-on .ddz-dialog { transform: scale(1); }
.ddz-dialog-strip { position: absolute; inset: 0 0 auto 0; height: 5px; }
.ddz-dialog-strip.win { background: linear-gradient(90deg, rgba(61,191,143,.7), rgba(61,191,143,.15)); }
.ddz-dialog-strip.lose { background: linear-gradient(90deg, rgba(240,113,120,.6), rgba(240,113,120,.12)); }
.ddz-dialog-strip.info { background: linear-gradient(90deg, var(--ddz-accent), rgba(75,163,227,.15)); }
.ddz-dialog h2 { font-size: 20px; font-weight: 650; margin-bottom: 6px; }
.ddz-dialog h2.win { color: var(--ddz-good); }
.ddz-dialog h2.lose { color: var(--ddz-bad); }
.ddz-dialog p.sub { font-size: 13px; color: var(--ddz-dim); margin-bottom: 16px; line-height: 1.5; }
.ddz-bid-opts { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
.ddz-bid-opts .ddz-btn { flex: 1; min-width: 84px; }
.ddz-props { margin-bottom: 16px; }
.ddz-props-row { display: flex; justify-content: space-between; font-size: 13px; padding: 7px 2px; border-bottom: 1px solid var(--ddz-line); }
.ddz-props-row:last-child { border-bottom: none; }
.ddz-props-row .k { color: var(--ddz-dim); }
.ddz-props-row .v { font-weight: 600; }
.ddz-props-row .v.gold { color: var(--ddz-gold); }
.ddz-score-row { display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-bottom: 1px solid var(--ddz-line); }
.ddz-score-row:last-child { border-bottom: none; }
.ddz-score-row .nm { font-size: 13px; font-weight: 600; flex: 1; }
.ddz-score-row .sc { font-size: 15px; font-weight: 700; }
.ddz-score-row .sc.plus { color: var(--ddz-good); }
.ddz-score-row .sc.minus { color: var(--ddz-bad); }
.ddz-score-row .ddz-seat-av { position: relative; }
.ddz-dialog-actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
.ddz-dialog-actions .ddz-btn { flex: 1; min-width: 110px; }
.ddz-dialog .dim-note { font-size: 12px; color: var(--ddz-dim); text-align: center; margin-top: 12px; }

/* toast */
.ddz-toast {
  position: absolute; right: 18px; bottom: 24px; z-index: 80;
  background: var(--ddz-panel-solid); color: var(--ddz-text);
  border: 1px solid var(--ddz-line-strong); border-left: 3px solid var(--ddz-accent);
  border-radius: 12px; padding: 11px 16px; font-size: 13px; box-shadow: var(--ddz-shadow-panel);
  animation: ddz-toast-in .18s ease-out; max-width: 300px;
}
.ddz-toast.bad { border-left-color: var(--ddz-bad); }

/* 复盘步骤 */
.ddz-replay-step { background: var(--ddz-accent-weak); border-radius: 12px; padding: 12px 14px; font-size: 13px; margin-bottom: 12px; min-height: 64px; line-height: 1.6; }
.ddz-replay-step b { color: var(--ddz-accent-deep); }

/* 帮助弹层 */
.ddz-help-list { font-size: 13px; line-height: 1.8; color: var(--ddz-text); }
.ddz-help-list li { margin-left: 18px; margin-bottom: 4px; }
.ddz-help-list kbd { background: var(--ddz-accent-weak); border-radius: 6px; padding: 1px 7px; font-size: 12px; font-family: inherit; }

@media (max-width: 720px) {
  .ddz-topbar { height: auto; min-height: 48px; flex-wrap: wrap; padding: 6px 12px; row-gap: 4px; }
  .ddz-chips { overflow-x: auto; max-width: 100%; scrollbar-width: none; }
  .ddz-chips::-webkit-scrollbar { display: none; }
  .ddz-toast { top: 104px; bottom: auto; right: 12px; }
  .ddz-tiers { grid-template-columns: 1fr; }
  .ddz-tiers .ddz-tier { flex-direction: row; justify-content: flex-start; }
  .ddz-tiers .ddz-tier select { max-width: 180px; }
  .ddz-setup-card { padding: 26px 22px 22px; }
  .ddz-title small { display: none; }
  .ddz-seat { max-width: 46vw; }
  .ddz-seat-sub { display: none; }
  .ddz-advice { right: 12px; left: 12px; width: auto; bottom: 150px; }
  .ddz-card { width: 56px; height: 80px; padding: 5px 6px; border-radius: 11px; }
  .ddz-card .rk { font-size: 18px; }
  .ddz-card .st { font-size: 13px; }
  .ddz-card--joker .rk { font-size: 11px; }
  .ddz-card--small { width: 44px; height: 62px; padding: 4px 5px; }
  .ddz-card--small .rk { font-size: 15px; }
  .ddz-card--small .st { font-size: 11px; }
  .ddz-card--joker.ddz-card--small .rk { font-size: 9px; }
  .ddz-hand { min-height: 96px; }
  .ddz-hand .ddz-card { margin-left: -38px; }
  .ddz-hand .ddz-card.is-sel { transform: translateY(-12px); }
  .ddz-statusbar { gap: 10px; padding: 8px 12px 0; }
  .ddz-mult .x { font-size: 16px; }
  .ddz-mid-grid { grid-template-columns: 1fr auto 1fr; gap: 8px; }
  .ddz-sideplay .ddz-played .ddz-card { margin-left: -26px; }
  .ddz-mid::before { width: 96%; height: 92%; }
  .ddz-seatrow { flex-wrap: wrap; row-gap: 8px; padding: 10px 14px 0; }
  .ddz-turnpill { order: -1; width: 100%; text-align: center; padding: 5px 12px; font-size: 12px; }
  .ddz-seat { gap: 6px; max-width: 47vw; }
  .ddz-seat-name { font-size: 12px; }
  .ddz-cardstack { width: 36px; height: 46px; }
  .ddz-cardstack .ddz-back { width: 24px; height: 34px; }
  .ddz-chipbtn .lbl { display: none; }
  .ddz-chipbtn { padding: 0 9px; }
}
@media (prefers-reduced-motion: reduce) {
  .ddz-root .ddz-played .ddz-card, .ddz-root .ddz-seat.is-turn, .ddz-root .ddz-pass-tag { animation: none !important; }
  .ddz-root, .ddz-root * { transition-duration: .01ms !important; }
}
/* 「更多」菜单里的一行（宿主菜单区域内，样式保持克制） */
.ddz-more-row {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 6px 10px; border-radius: 8px;
  font-size: 13px; color: inherit; cursor: pointer;
  background: none; border: none; font-family: inherit;
}
.ddz-more-row:hover { background: rgba(127, 127, 127, .12); }
.ddz-btn.is-on { border-color: var(--ddz-accent); background: var(--ddz-accent-weak); color: var(--ddz-accent-deep); }
`

    /* ================= 4. sota 档（DouZero 纯 JS 前向） ================= */
    const __sota = { exports: {} }
    ;(function (module, exports) {
/*!
 * 斗地主军师 · SOTA 档（DouZero）
 *
 * 这里不引入 onnxruntime-web：DouZero 的结构只有「一个 LSTM + 六层全连接」，
 * 权重本来就是 float32，直接自己解析 ONNX 的 initializer、自己做前向，
 * 省掉 8–15MB 的 wasm 运行时，也不用 CDN。
 *
 * 编码规则逐行对齐 research/dist/DouZero-main/douzero/env/env.py 的 get_obs()，
 * 与 ai/douzero.mjs（Node 侧，已用 ai/golden-encoder.json 逐维对齐过）共用同一份实现。
 *
 * 权重不入包：运行时按 ai/models/MANIFEST.json 的地址下载 + sha256 校验，
 * 成功后放进 Cache Storage，第二次开面板不再下载。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SOTA = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================= 1. 权重清单 ================= */

  // 权重不入包：运行时按 ai/models/MANIFEST.json 的地址下载 + sha256 校验。
  // 国内直连 huggingface.co 常常连不上，所以按顺序试镜像；谁先成功用谁，
  // 字节仍然只认清单里的 sha256（镜像给错文件一律拒绝）。
  const MIRRORS = [
    'https://huggingface.co/palemoky/douzero-baselines/resolve/main/models_onnx/douzero_WP/',
    'https://hf-mirror.com/palemoky/douzero-baselines/resolve/main/models_onnx/douzero_WP/'
  ];
  const REMOTE = MIRRORS[0];

  // 只内置地主模型：实测 DouZero 的农民模型依赖同水平队友，弱队友下反而低于本引擎启发式，
  // 所以 sota 档在农民位回退 go 档（见 ai/SOTA.md 的 500/300 副实测）。
  const FILES = {
    landlord: {
      file: 'landlord.onnx',
      bytes: 5834135,
      sha256: '5ba2f1bb414483a3ecdf0d000159c1322b02e2d096e6d83be8a18765b56d6d32'
    }
  };

  const CACHE_NAME = 'ddz-sota-v1';

  /* ================= 2. 编码器（对齐 DouZero env.py） ================= */
  // 本引擎牌值 3..15(3..2) / 16(小王) / 17(大王) → DouZero 列号 0..12 / 52 / 53

  function cardCol(r) { return r <= 14 ? r - 3 : r === 15 ? 12 : -1; }

  // 54 维：4x13 牌面矩阵按列展平（flatten('F')）+ 2 维大小王
  function cards2array(counts) {
    const out = new Float32Array(54);
    for (let i = 0; i < 15; i++) {
      const n = counts[i] || 0;
      if (!n) continue;
      const rank = i + 3;
      if (rank <= 15) {
        const col = cardCol(rank);
        for (let k = 0; k < n && k < 4; k++) out[col * 4 + k] = 1;
      } else if (rank === 16) out[52] = 1;
      else if (rank === 17) out[53] = 1;
    }
    return out;
  }

  function countsOfCards(cards) {
    const c = new Array(15).fill(0);
    for (let i = 0; i < cards.length; i++) c[cards[i] - 3]++;
    return c;
  }

  function oneHot(value, max) {
    const v = new Float32Array(max);
    const i = value - 1;
    if (i >= 0 && i < max) v[i] = 1;
    return v;
  }

  // z：最近 15 手（不足前补零），每 3 手拼成 162 维 → [5, 162]
  function encodeZ(history) {
    const seq = history.slice(-15).map(h => cards2array(h.counts));
    while (seq.length < 15) seq.unshift(cards2array(new Array(15).fill(0)));
    const z = new Float32Array(5 * 162);
    for (let step = 0; step < 5; step++) {
      for (let k = 0; k < 3; k++) z.set(seq[step * 3 + k], step * 162 + k * 54);
    }
    return z;
  }

  function concat(parts) {
    let n = 0;
    for (let i = 0; i < parts.length; i++) n += parts[i].length;
    const out = new Float32Array(n);
    let o = 0;
    for (let i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }

  // x 里不含候选动作的那部分：地主 319 维 / 农民 430 维
  function encodeBase(ctx) {
    const { position, myCounts, otherCounts, playedCounts, lastCounts,
      lastLandlordCounts, lastTeammateCounts, numLeft, bombNum } = ctx;
    const parts = [];
    parts.push(cards2array(myCounts));
    parts.push(cards2array(otherCounts));
    if (position === 'landlord') {
      parts.push(cards2array(lastCounts));
      parts.push(cards2array(playedCounts.landlord_up));
      parts.push(cards2array(playedCounts.landlord_down));
      parts.push(oneHot(numLeft.landlord_up, 17));
      parts.push(oneHot(numLeft.landlord_down, 17));
    } else {
      parts.push(cards2array(playedCounts.landlord));
      parts.push(cards2array(playedCounts.teammate));
      parts.push(cards2array(lastCounts));
      parts.push(cards2array(lastLandlordCounts));
      parts.push(cards2array(lastTeammateCounts));
      parts.push(oneHot(numLeft.landlord, 20));
      parts.push(oneHot(numLeft.teammate, 17));
    }
    const bomb = new Float32Array(15);
    bomb[bombNum] = 1;
    parts.push(bomb);
    return concat(parts);
  }

  // 每个候选动作一行 x（地主 373 / 农民 484）
  function encodeX(ctx, legalCounts) {
    const base = encodeBase(ctx);
    const dim = base.length + 54;
    const rows = new Float32Array(legalCounts.length * dim);
    for (let i = 0; i < legalCounts.length; i++) {
      rows.set(base, i * dim);
      rows.set(cards2array(legalCounts[i]), i * dim + base.length);
    }
    return { rows, dim };
  }

  /* ================= 3. 极简 ONNX 读取（只要 initializer） ================= */

  function rdVarint(b, o) {
    let r = 0, m = 1, x;
    do { x = b[o++]; r += (x & 0x7f) * m; m *= 128; } while (x & 0x80);
    return [r, o];
  }

  function readFields(b) {
    const out = [];
    let o = 0;
    while (o < b.length) {
      let key; [key, o] = rdVarint(b, o);
      const f = key >>> 3, t = key & 7;
      if (t === 0) { let v; [v, o] = rdVarint(b, o); out.push({ f, t, v }); }
      else if (t === 1) { out.push({ f, t, v: b.subarray(o, o + 8) }); o += 8; }
      else if (t === 2) { let l; [l, o] = rdVarint(b, o); out.push({ f, t, v: b.subarray(o, o + l) }); o += l; }
      else if (t === 5) { out.push({ f, t, v: b.subarray(o, o + 4) }); o += 4; }
      else throw new Error('onnx: 不认识的 wire type ' + t);
    }
    return out;
  }

  function utf8(b) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(b);
    let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return s;
  }

  // TensorProto → { dims, data: Float32Array }
  function readTensor(tp) {
    const fs = readFields(tp);
    let name = '', dataType = 1;
    const dims = [];
    let raw = null;
    const floats = [];
    for (const f of fs) {
      if (f.f === 1 && f.t === 0) dims.push(f.v);
      else if (f.f === 1 && f.t === 2) { // packed dims（极少见）
        let o = 0;
        while (o < f.v.length) { let v; [v, o] = rdVarint(f.v, o); dims.push(v); }
      } else if (f.f === 2 && f.t === 0) dataType = f.v;
      else if (f.f === 4) { // float_data（可能 packed）
        const view = new DataView(f.v.buffer, f.v.byteOffset, f.v.byteLength);
        for (let o = 0; o + 4 <= f.v.byteLength; o += 4) floats.push(view.getFloat32(o, true));
      } else if (f.f === 8 && f.t === 2) name = utf8(f.v);
      else if (f.f === 9 && f.t === 2) raw = f.v;
    }
    if (dataType !== 1) throw new Error('onnx: 只支持 float32，收到 data_type=' + dataType);
    let data;
    if (raw) {
      data = new Float32Array(raw.length >> 2);
      const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      for (let i = 0; i < data.length; i++) data[i] = view.getFloat32(i * 4, true);
    } else {
      data = new Float32Array(floats);
    }
    return { name, dims, data };
  }

  // 返回 { 名字: {dims, data} }，只要 graph.initializer
  function parseOnnx(input) {
    const b = input instanceof Uint8Array ? input : new Uint8Array(input);
    const top = readFields(b);
    let graph = null;
    for (const f of top) if (f.f === 7 && f.t === 2) graph = f.v;
    if (!graph) throw new Error('onnx: 没有 graph');
    const tensors = {};
    for (const f of readFields(graph)) {
      if (f.f !== 5 || f.t !== 2) continue;
      const t = readTensor(f.v);
      tensors[t.name] = { dims: t.dims, data: t.data };
    }
    return tensors;
  }

  /* ================= 4. 前向：LSTM(162→128) + 六层全连接 ================= */

  const HIDDEN = 128;
  const SEQ = 5;

  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

  // ONNX LSTM 门序为 i o f c；卷积核布局 [1, 4*hidden, input] / [1, 4*hidden, hidden]
  function buildModel(tensors) {
    const get = (n) => {
      const t = tensors[n];
      if (!t) throw new Error('onnx: 缺少张量 ' + n);
      return t;
    };
    const W = get('onnx::LSTM_131'); // [1, 512, 162]
    const R = get('onnx::LSTM_132'); // [1, 512, 128]
    const B = get('onnx::LSTM_133'); // [1, 1024]
    const dense = [];
    for (let i = 1; i <= 6; i++) {
      const w = get('base.dense' + i + '.weight');
      const b = get('base.dense' + i + '.bias');
      dense.push({ w, b, out: w.dims[0], in: w.dims[1] });
    }
    return { W, R, B, dense, inputDim: dense[0].in - HIDDEN };
  }

  // z: Float32Array(5*162) → h: Float32Array(128)
  function lstmLast(model, z) {
    const { W, R, B } = model;
    const H = HIDDEN;
    const inDim = 162;
    const h = new Float32Array(H);
    const c = new Float32Array(H);
    const xh = new Float32Array(4 * H);
    for (let t = 0; t < SEQ; t++) {
      const xoff = t * inDim;
      for (let g = 0; g < 4 * H; g++) {
        let s = B.data[g] + B.data[4 * H + g]; // Wb + Rb
        const woff = g * inDim;
        for (let k = 0; k < inDim; k++) s += W.data[woff + k] * z[xoff + k];
        const roff = g * H;
        for (let k = 0; k < H; k++) {
          const hv = h[k];
          if (hv !== 0) s += R.data[roff + k] * hv;
        }
        xh[g] = s;
      }
      for (let j = 0; j < H; j++) {
        const i = sigmoid(xh[j]);           // input gate
        const o = sigmoid(xh[H + j]);       // output gate
        const f = sigmoid(xh[2 * H + j]);   // forget gate
        const g = Math.tanh(xh[3 * H + j]); // cell candidate
        const cv = f * c[j] + i * g;
        c[j] = cv;
        h[j] = o * Math.tanh(cv);
      }
    }
    return h;
  }

  // 一行 x + 共享的 LSTM 输出 → 分数
  function forwardRow(model, h, x, xoff, scratch) {
    const d = model.dense;
    let vec = scratch.a;
    for (let i = 0; i < HIDDEN; i++) vec[i] = h[i];
    vec.set(x.subarray(xoff, xoff + model.inputDim), HIDDEN);
    let len = HIDDEN + model.inputDim;
    for (let li = 0; li < d.length; li++) {
      const layer = d[li];
      const out = li % 2 === 0 ? scratch.b : scratch.a;
      const bias = layer.b.data;
      const w = layer.w.data;
      for (let j = 0; j < layer.out; j++) {
        let s = bias[j];
        const base = j * layer.in;
        for (let k = 0; k < len; k++) s += w[base + k] * vec[k];
        out[j] = (li === d.length - 1) ? s : (s > 0 ? s : 0);
      }
      vec = out;
      len = layer.out;
    }
    return vec[0];
  }

  // n 行 x（步长 dim）→ Float32Array(n) 分数
  function score(model, z, rows, n, dim) {
    const h = lstmLast(model, z);
    const out = new Float32Array(n);
    // 第一层输入是 128 + x 维（地主 501、农民 612），缓冲区按最大维开
    const wide = Math.max(512, HIDDEN + model.inputDim);
    const scratch = { a: new Float32Array(wide), b: new Float32Array(wide) };
    for (let i = 0; i < n; i++) out[i] = forwardRow(model, h, rows, i * dim, scratch);
    return out;
  }

  /* ================= 5. 权重加载（下载 / 校验 / 缓存） ================= */

  const state = {
    status: 'idle',   // idle | downloading | ready | error
    progress: 0,
    error: '',
    source: '',
    model: null
  };
  const listeners = [];
  // 快照对象只在这一份状态真的变了才换新引用：
  // 订阅者拿同一个引用时 setState 会被 React 判等跳过，不会因为「每次都是新对象」而白白重渲染
  let snap = { status: 'idle', progress: 0, error: '', source: '' };
  function syncSnap() {
    if (snap.status !== state.status || snap.progress !== state.progress ||
      snap.error !== state.error || snap.source !== state.source) {
      snap = { status: state.status, progress: state.progress, error: state.error, source: state.source };
    }
  }
  function emit() {
    syncSnap();
    for (const fn of listeners.slice()) { try { fn(snap); } catch (e) { /* ignore */ } }
  }
  function status() {
    syncSnap();
    return snap;
  }
  function onStatus(fn) {
    listeners.push(fn);
    try { fn(status()); } catch (e) { /* ignore */ }
    return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
  }

  function sha256Hex(buf) {
    const c = typeof crypto !== 'undefined' ? crypto : null;
    if (!c || !c.subtle) return Promise.resolve('');
    return c.subtle.digest('SHA-256', buf).then((d) => {
      const u = new Uint8Array(d);
      let s = '';
      for (let i = 0; i < u.length; i++) s += (u[i] < 16 ? '0' : '') + u[i].toString(16);
      return s;
    });
  }

  async function readCache(key) {
    if (typeof caches === 'undefined') return null;
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(key);
      if (!hit) return null;
      return new Uint8Array(await hit.arrayBuffer());
    } catch (e) { return null; }
  }

  async function writeCache(key, bytes) {
    if (typeof caches === 'undefined') return;
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(key, new Response(bytes, {
        headers: { 'content-type': 'application/octet-stream', 'content-length': String(bytes.length) }
      }));
    } catch (e) { /* 配额或隐私模式，忽略 */ }
  }

  async function download(url, expectBytes) {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('下载失败 HTTP ' + res.status);
    const total = Number(res.headers.get('content-length')) || expectBytes || 0;
    if (!res.body || typeof res.body.getReader !== 'function') {
      const buf = new Uint8Array(await res.arrayBuffer());
      state.progress = 1; emit();
      return buf;
    }
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      if (total) { state.progress = Math.min(0.99, got / total); emit(); }
    }
    const buf = new Uint8Array(got);
    let o = 0;
    for (const ch of chunks) { buf.set(ch, o); o += ch.length; }
    return buf;
  }

  // 加载地主模型；重复调用复用同一个 Promise
  let loading = null;
  function load(opts) {
    if (state.status === 'ready') return Promise.resolve(true);
    if (loading) return loading;
    const options = opts || {};
    const meta = FILES.landlord;
    const sources = options.sources || (options.url ? [options.url] : MIRRORS);
    const cacheKey = 'sota:' + meta.file;
    state.status = 'downloading'; state.progress = 0; state.error = ''; emit();
    loading = (async () => {
      let bytes = await readCache(cacheKey);
      if (bytes && bytes.length !== meta.bytes) bytes = null;
      if (!bytes) {
        const fails = [];
        for (const base of sources) {
          const url = base + meta.file;
          try {
            const got = await download(url, meta.bytes);
            if (meta.bytes && got.length !== meta.bytes) throw new Error('体积不符：' + got.length + ' ≠ ' + meta.bytes);
            const digest = await sha256Hex(got);
            if (digest && digest !== meta.sha256) throw new Error('sha256 不符，拒绝加载');
            bytes = got;
            state.source = base;
            break;
          } catch (err) {
            fails.push(new URL(url).host + '：' + ((err && err.message) || err));
          }
        }
        if (!bytes) throw new Error('所有源都失败（' + fails.join('；') + '）');
        await writeCache(cacheKey, bytes);
      }
      const tensors = parseOnnx(bytes);
      state.model = buildModel(tensors);
      state.status = 'ready'; state.progress = 1; emit();
      return true;
    })()
      .catch((err) => {
        state.status = 'error';
        state.error = (err && err.message) || String(err);
        emit();
        throw err;
      })
      .finally(() => { loading = null; });
    return loading;
  }

  // 直接从内存里的 ONNX 字节建模型（测试与本地文件用）
  function loadFromBytes(bytes) {
    state.model = buildModel(parseOnnx(bytes));
    state.status = 'ready'; state.progress = 1; emit();
    return state.model;
  }

  function ready() { return state.status === 'ready' && !!state.model; }
  function reset() {
    state.status = 'idle'; state.progress = 0; state.error = ''; state.model = null; emit();
  }

  // ctx + 候选动作 counts → { index, scores }
  function rank(ctx, legalCounts) {
    if (!ready()) throw new Error('sota 模型未加载');
    if (!legalCounts || !legalCounts.length) return { index: -1, scores: [] };
    const { rows, dim } = encodeX(ctx, legalCounts);
    const z = encodeZ(ctx.history || []);
    const scores = score(state.model, z, rows, legalCounts.length, dim);
    let best = 0;
    for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
    return { index: best, scores: Array.from(scores) };
  }

  return {
    REMOTE, MIRRORS, FILES, CACHE_NAME,
    cardCol, cards2array, countsOfCards, encodeZ, encodeBase, encodeX,
    parseOnnx, buildModel, lstmLast, score,
    load, loadFromBytes, ready, reset, rank, status, onStatus
  };
});

    })(__sota, __sota.exports)
    const SOTA = __sota.exports

    /* ================= 5. 界面 ================= */
/* 斗地主 · 插件界面（React，无 JSX；视觉：鲸鱼娘浅色柔和风，结构照 Kimi 原型） */
const PANEL_ID = 'doudizhu'
const TIERS = DDZ.TIERS
const RANK_TEXT = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '小王', '大王']
const SUITS = ['♠', '♥', '♣', '♦']
const RED_SUITS = { '♥': 1, '♦': 1 }

/* ---------------- 小工具 ---------------- */

function cardsFromCounts(counts) {
  const out = []
  for (let i = 0; i < 15; i++) {
    const n = counts[i] || 0
    for (let k = 0; k < n; k++) {
      const rank = i + 3
      const suit = rank >= 16 ? '★' : SUITS[k % 4]
      out.push({
        rank,
        suit,
        id: rank + ':' + k,
        red: rank >= 16 ? rank === 17 : !!RED_SUITS[suit],
        label: RANK_TEXT[i],
      })
    }
  }
  out.sort((a, b) => b.rank - a.rank || (a.suit < b.suit ? -1 : 1))
  return out
}

function fmt(tpl, vars) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : m))
}

function tierLabel(tier, T) { return (T.tierNames && T.tierNames[tier]) || tier }

function whoName(seat, T) { return seat === 0 ? T.you : seat === 1 ? T.downTier : T.upTier }

function mmss(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

/* 当前倍数：底分 × 叫分 × 各家加倍 × 明牌 × 炸弹 */
function currentMult(st) {
  if (!st) return 1
  let m = st.base || 1
  if (st.mode === 'score' && st.bidHigh > 0) m *= st.bidHigh
  for (let s = 0; s < 3; s++) m *= st.doubling[s] || 1
  for (let s = 0; s < 3; s++) if (st.open[s]) m *= 2
  for (let i = 0; i < (st.bombs || 0); i++) m *= 2
  return m
}

/* ---------------- 图标 ---------------- */

function WhaleSvg(props) {
  const cls = (props && props.cls) || ''
  return h('svg', { className: cls || undefined, viewBox: '0 0 48 48', fill: 'none', 'aria-hidden': 'true' },
    h('path', {
      d: 'M6 28c0-9 8-16 18-16 9 0 16 5 17 12l3-4c1.6 4-1 8-4 9 0 5-4 9-10 9H14c-5 0-8-4-8-11z',
      fill: 'var(--ddz-accent)', opacity: '.9',
    }),
    h('circle', { cx: 16, cy: 22, r: 2.2, fill: '#fff' }),
    h('path', { d: 'M30 26c2 2 5 2 7 0', stroke: '#fff', strokeWidth: 1.8, strokeLinecap: 'round' }),
    h('path', { d: 'M38 30c3 0 5 2 5 5-3 0-5-2-5-5z', fill: 'var(--ddz-accent-deep)', opacity: '.55' }))
}

function Avatar(props) {
  const seat = (props && props.seat) || 0
  const lg = props && props.lg
  const tone = seat === 0 ? '#4BA3E3' : seat === 1 ? '#6FA8CF' : '#8CB9D6'
  return h('svg', { className: 'ddz-avatar' + (lg ? ' ddz-avatar--lg' : ''), viewBox: '0 0 48 48', 'aria-hidden': 'true' },
    h('circle', { cx: 24, cy: 24, r: 24, fill: 'var(--ddz-avatar-bg, #EAF3FB)' }),
    h('path', {
      d: 'M9 28c0-7 6.5-13 15-13 7 0 13 4.5 14.5 10.5l2.5-3c1.3 3.2-.8 6.5-3.2 7.3 0 4-3.3 7.2-8.2 7.2H16c-4 0-7-3.3-7-9z',
      fill: tone,
    }),
    h('circle', { cx: 18.5, cy: 25, r: 1.9, fill: '#fff' }),
    h('path', { d: 'M27.5 28c1.7 1.7 4.3 1.7 6 0', stroke: '#fff', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round' }),
    h('path', { d: 'M15 33c3 2 7 2 10 0', stroke: '#fff', strokeWidth: 1.4, fill: 'none', strokeLinecap: 'round', opacity: '.85' }))
}

function Crown() {
  return h('svg', { className: 'ddz-crown', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    h('path', { d: 'M3 17 5 8l4.5 4L12 5l2.5 7L19 8l2 9z', fill: '#E5BE6B', stroke: '#D4A84B', strokeWidth: 1 }),
    h('rect', { x: 4, y: 17, width: 16, height: 3, rx: 1.2, fill: '#E5BE6B' }))
}

/* ---------------- 牌 ---------------- */

function Card(props) {
  const { card, selected, small, onClick, onPointerDown, onPointerEnter } = props
  if (!card) return null
  const cls = ['ddz-card']
  if (small) cls.push('ddz-card--small')
  if (card.rank >= 16) cls.push('ddz-card--joker')
  if (selected) cls.push('is-sel')
  cls.push(card.red ? 'red' : 'ink')
  return h('div', {
    className: cls.join(' '),
    onPointerDown: onPointerDown,
    onPointerEnter: onPointerEnter,
    onClick: onClick,
    role: onPointerDown ? 'button' : undefined,
    tabIndex: onPointerDown ? 0 : undefined,
  },
    h('span', { className: 'rk', key: 'rk' }, card.rank === 17 ? '大王' : card.rank === 16 ? '小王' : card.label),
    h('span', { className: 'st', key: 'st' }, card.rank >= 16 ? '★' : card.suit))
}

/* ---------------- 手牌（按住滑动多选） ---------------- */

function Hand(props) {
  const { cards, selected, onSelect, disabled, T } = props
  const drag = useRef(null)
  useEffect(() => {
    function up() { drag.current = null }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [])
  const down = (card) => (e) => {
    if (disabled) return
    if (e && e.preventDefault) e.preventDefault()
    const add = !selected[card.id]
    drag.current = { add }
    onSelect(card.id, add)
  }
  const enter = (card) => () => {
    if (disabled || !drag.current) return
    onSelect(card.id, drag.current.add)
  }
  if (!cards.length) {
    return h('div', { className: 'ddz-hand' + (disabled ? ' is-disabled' : '') }, h('span', { className: 'ddz-mid-empty' }, T.noCards))
  }
  return h('div', { className: 'ddz-hand' + (disabled ? ' is-disabled' : '') },
    cards.map((c, i) => h(Card, {
      key: c.id,
      card: c,
      selected: !!selected[c.id],
      onPointerDown: down(c),
      onPointerEnter: enter(c),
    })))
}

/* ---------------- 座位 ---------------- */

function Seat(props) {
  const { st, seat, T, remain, me } = props
  const name = whoName(seat, T)
  const isLandlord = st.landlord === seat
  const counts = G.seatCounts(st)
  const left = counts[seat]
  const isTurn = (st.phase === 'play' && st.turn === seat) ||
    (st.phase === 'bid' && G.bidSeat(st) === seat) ||
    (st.phase === 'double' && !st.doubleChosen[seat])
  const hasTimer = me && typeof remain === 'number' && isFinite(remain)
  const pct = hasTimer ? Math.max(0, Math.min(1, remain / 30)) : 0
  const circ = 295.3
  const tier = st.tiers && st.tiers[seat]

  const sub = [
    fmt(T.lands, { n: left }),
    tier ? tierLabel(tier, T) : '',
  ].filter(Boolean).join(' · ')

  return h('div', { className: 'ddz-seat' + (isTurn ? ' is-turn' : '') },
    h('div', { className: 'ddz-seat-av' },
      hasTimer ? h('svg', { className: 'ddz-ring', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
        h('circle', {
          cx: 50, cy: 50, r: 47,
          strokeDasharray: circ,
          strokeDashoffset: circ * (1 - pct),
          className: remain < 8 ? 'hot' : undefined,
        })) : null,
      h(Avatar, { seat: seat, lg: me }),
      isLandlord ? h(Crown) : null),
    h('div', { className: 'ddz-seat-info' },
      h('div', { className: 'ddz-seat-name' }, name,
        h('span', { className: 'ddz-tags' },
          isLandlord ? h('span', { className: 'ddz-landlord-tag' }, T.landlordTag) : null,
          st.open[seat] ? h('span', { className: 'ddz-open-tag' }, T.openShort) : null)),
      h('div', { className: 'ddz-seat-sub' }, sub)),
    me ? null : h('div', { className: 'ddz-cardstack', 'aria-label': fmt(T.lands, { n: left }) },
      h('div', { className: 'ddz-back' }), h('div', { className: 'ddz-back' }), h('div', { className: 'ddz-back' }),
      h('span', { className: 'n' }, left)))
}

/* ---------------- 记牌器 ---------------- */

function counterBar(st, T, open) {
  const mine = st.hands[0]
  const out = []
  for (let i = 14; i >= 0; i--) {
    const rank = i + 3
    const totalCards = rank >= 16 ? 1 : 4
    const rest = totalCards - (mine[i] || 0) - (st.played[i] || 0)
    out.push(h('div', {
      key: rank,
      className: 'ddz-count' + (rest <= 0 ? ' is-zero' : '') + (rank >= 16 && rest > 0 ? ' is-hot' : ''),
      title: RANK_TEXT[i],
    }, h('b', null, RANK_TEXT[i]), h('span', { className: 'cnt' }, rest)))
  }
  return h('div', { className: 'ddz-counterbar' + (open ? ' is-open' : '') },
    h('div', { className: 'ddz-counterbar-in' }, out))
}

function CounterBar(props) {
  return counterBar(props.st, props.T, props.open)
}

/* ---------------- 结算 ---------------- */

function Result(props) {
  const { st, T, onAgain, onReTier, onReplay, onClose } = props
  const r = st.result
  const iWin = (st.winners === 'landlord') === (st.landlord === 0)
  const d = r.delta
  const props2 = []
  props2.push({ k: T.baseLabel, v: r.base })
  if (st.mode === 'score') props2.push({ k: T.bidLabel, v: r.bid > 0 ? r.bid : 1 })
  props2.push({ k: T.multiplier.replace('×{n}', '').replace('{n}', ''), v: '×' + r.multiplier })
  props2.push({ k: T.bombs.replace('{n}', '').trim(), v: '×' + r.bombs })
  if (r.spring) props2.push({ k: T.spring.replace(' ×2', ''), v: '×2' })
  if (r.antiSpring) props2.push({ k: T.antiSpring.replace(' ×2', ''), v: '×2' })
  return h('div', { className: 'ddz-overlay is-on' },
    h('div', { className: 'ddz-dialog', style: { maxWidth: 480 } },
      h('div', { className: 'ddz-dialog-strip ' + (iWin ? 'win' : 'lose') }),
      h('h2', { className: iWin ? 'win' : 'lose' }, st.winners === 'landlord' ? T.winLandlord : T.winFarmer),
      h('p', { className: 'sub' }, fmt(T.scoreLine, { n: (d[0] > 0 ? '+' : '') + d[0] }) + (iWin ? ' · ' + T.resultSubWin : ' · ' + T.resultSubLose)),
      h('div', { className: 'ddz-props' },
        props2.map((p, i) => h('div', { className: 'ddz-props-row', key: i },
          h('span', { className: 'k' }, p.k),
          h('span', { className: 'v' + (p.v === '×2' ? ' gold' : '') }, p.v)))),
      h('div', null, [0, 1, 2].map(s => h('div', { className: 'ddz-score-row', key: s },
        h('span', { className: 'nm' }, whoName(s, T)),
        h('span', { className: 'sc ' + (d[s] > 0 ? 'plus' : d[s] < 0 ? 'minus' : '') }, (d[s] > 0 ? '+' : '') + d[s])))),
      h('p', { className: 'dim-note' }, fmt(T.timeUsedLine, { t: mmss(r.seconds) })),
      h('div', { className: 'ddz-dialog-actions' },
        h('button', { className: 'ddz-btn ddz-btn--primary', onClick: onAgain }, T.again),
        h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: onReTier }, T.reTier),
        h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: onReplay }, T.replay),
        h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: onClose }, T.close))))
}

/* ---------------- 复盘 ---------------- */

function Replay(props) {
  const { st, T, onClose } = props
  const [idx, setIdx] = useState(0)
  const lines = []
  const ev = st.replay || []
  ev.forEach((e, i) => {
    if (e.type === 'deal') lines.push({ i, text: (e.mode === 'rob' ? T.modeRob : T.modeScore) })
    else if (e.type === 'bid') lines.push({ i, text: whoName(e.seat, T) + ' · ' + (e.value === 0 ? T.pass : (typeof e.value === 'number' ? e.value + '分' : (e.value === 'call' ? T.call : T.rob))) })
    else if (e.type === 'double') lines.push({ i, text: whoName(e.seat, T) + ' · ' + (e.value === 1 ? T.doubleNone : e.value === 2 ? T.doubleX2 : T.doubleX4) })
    else if (e.type === 'open') lines.push({ i, text: whoName(e.seat, T) + ' · ' + T.openShort })
    else if (e.type === 'play') lines.push({ i, text: whoName(e.seat, T) + ' · ' + DDZ.cardsText(e.cards) })
    else if (e.type === 'pass') lines.push({ i, text: whoName(e.seat, T) + ' · ' + T.passAction })
  })
  const step = Math.min(idx, Math.max(0, lines.length - 1))
  const line = lines[step]
  return h('div', { className: 'ddz-overlay is-on' },
    h('div', { className: 'ddz-dialog', style: { maxWidth: 440 } },
      h('div', { className: 'ddz-dialog-strip info' }),
      h('h2', null, T.replayTitle),
      h('div', { className: 'ddz-replay-step' },
        h('b', null, fmt(T.stepShort, { i: step + 1, n: lines.length })),
        h('br', null),
        line ? line.text : ''),
      h('div', { className: 'ddz-dialog-actions' },
        h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => setIdx(Math.max(0, step - 1)), disabled: step <= 0 }, T.stepPrev),
        h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => setIdx(Math.min(lines.length - 1, step + 1)), disabled: step >= lines.length - 1 }, T.stepNext),
        h('button', { className: 'ddz-btn ddz-btn--primary', onClick: onClose }, T.close))))
}

/* ---------------- 帮助 ---------------- */

function Help(props) {
  const { T, onClose } = props
  return h('div', { className: 'ddz-overlay is-on' },
    h('div', { className: 'ddz-dialog', style: { maxWidth: 460 } },
      h('div', { className: 'ddz-dialog-strip info' }),
      h('h2', null, T.helpTitle),
      h('ul', { className: 'ddz-help-list', style: { marginTop: 8 } },
        T.helpList.map((s, i) => h('li', { key: i }, s))),
      h('div', { className: 'ddz-dialog-actions' },
        h('button', { className: 'ddz-btn ddz-btn--primary', onClick: onClose }, T.close))))
}

/* ---------------- 主页面 ---------------- */

function PanelView() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('ddz-lang') === 'en' ? 'en' : 'zh' } catch { return 'zh' }
  })
  const T = I18N[lang]
  const [, bump] = useState(0)
  const touch = useCallback(() => bump(v => v + 1), [])
  const stRef = useRef(null)
  const [view, setView] = useState('setup')   // setup | table
  const [mode, setMode] = useState('score')
  const [tiers, setTiers] = useState(() => {
    try {
      const raw = localStorage.getItem('ddz-tiers')
      // 老存档里可能还是 pro100/pro200/pro500/pro9999，用 tierOf 迁到新档位名
      if (raw) { const v = JSON.parse(raw); if (Array.isArray(v) && v.length === 3) return v.map(t => DDZ.tierOf(t)) }
    } catch { /* ignore */ }
    return ['go', 'go', 'go']
  })
  const [auto, setAuto] = useState(false)
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('ddz-sound') !== '0' } catch { return true } })
  const [counterOpen, setCounterOpen] = useState(true)
  const [sel, setSel] = useState({})            // id -> true
  const [hintIdx, setHintIdx] = useState(0)
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(null)      // 'help' | 'result' | 'replay' | 'surrender' | 'open'
  const [advice, setAdvice] = useState(null)
  const [thinking, setThinking] = useState('')
  const [remain, setRemain] = useState(30)
  const [nowTick, setNowTick] = useState(Date.now())
  const [stats, setStats] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem('ddz-stats') || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
  })
  const turnStart = useRef(Date.now())
  const toastTimer = useRef(null)
  const adviceKeyRef = useRef('')
  const adviceTimerRef = useRef(null)
  const st = stRef.current

  /* -------- sota 档：DouZero 权重 -------- */
  const [sota, setSota] = useState(() => (typeof SOTA !== 'undefined' ? SOTA.status() : { status: 'idle', progress: 0, error: '' }))

  useEffect(() => {
    if (typeof SOTA === 'undefined') return undefined
    const off = SOTA.onStatus((s) => {
      setSota(s)
      if (s.status === 'ready') DDZ.setSotaRank(SOTA.rank)
    })
    if (SOTA.ready()) DDZ.setSotaRank(SOTA.rank)
    return off
  }, [])

  // 选了 sota 档才去下权重；下载中/已就绪不重复触发
  useEffect(() => {
    if (typeof SOTA === 'undefined') return
    if (tiers.indexOf('sota') < 0) return
    if (SOTA.ready()) { DDZ.setSotaRank(SOTA.rank); return }
    if (sota.status === 'downloading' || sota.status === 'ready') return
    SOTA.load().catch(() => { /* 状态已经通过 onStatus 落到界面 */ })
  }, [tiers, sota.status])

  function toastMsg(msg) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1600)
  }

  function beep(kind) {
    if (!sound) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      if (!beep.ctx) beep.ctx = new AC()
      const ctx = beep.ctx
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      const f = kind === 'bomb' ? 180 : kind === 'win' ? 660 : kind === 'lose' ? 220 : 420
      o.frequency.value = f
      o.type = kind === 'bomb' ? 'sawtooth' : 'sine'
      g.gain.setValueAtTime(0.0001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
      o.start(); o.stop(ctx.currentTime + 0.2)
    } catch { /* 没有音频环境就算了 */ }
  }

  function saveStats(next) {
    setStats(next)
    try { localStorage.setItem('ddz-stats', JSON.stringify(next)) } catch { /* ignore */ }
  }

  /* -------- 开局 -------- */
  function startGame(nextMode, nextTiers) {
    const m = nextMode || mode
    const t = nextTiers || tiers
    stRef.current = G.createGame({ mode: m, tiers: t })
    setSel({})
    setHintIdx(0)
    setAdvice(null)
    setThinking('')
    setModal(null)
    setView('table')
    turnStart.current = Date.now()
    setRemain(30)
    setNowTick(Date.now())
    touch()
    try { localStorage.setItem('ddz-tiers', JSON.stringify(t)) } catch { /* ignore */ }
  }

  /* -------- 行动 -------- */
  function afterAction() {
    turnStart.current = Date.now()
    setRemain(30)
    setSel({})
    setHintIdx(0)
    setAdvice(null)
    touch()
  }

  function userBid(v) {
    const s = stRef.current
    if (!s) return
    try { G.applyBid(s, G.bidSeat(s), v) } catch (e) { toastMsg(e.message); return }
    afterAction()
  }

  function userDouble(v) {
    const s = stRef.current
    if (!s) return
    try { G.applyDouble(s, 0, v) } catch (e) { toastMsg(e.message); return }
    beep(v > 1 ? 'bomb' : 'play')
    afterAction()
  }

  function userOpen() {
    const s = stRef.current
    if (!s) return
    if (!window.confirm) { G.applyOpen(s, 0); toastMsg(T.openOn); touch(); return }
    setModal('open')
  }

  function confirmOpen() {
    const s = stRef.current
    if (!s) return
    G.applyOpen(s, 0)
    setModal(null)
    toastMsg(T.openOn)
    touch()
  }

  function userPlay() {
    const s = stRef.current
    if (!s) return
    const cards = selectedRanks()
    if (!cards.length) { toastMsg(T.noCards); return }
    try {
      G.applyPlay(s, 0, cards)
    } catch (e) {
      toastMsg(e && /压不过/.test(e.message) ? T.beatFail : T.invalid)
      return
    }
    beep(DDZ.classify(cards).type === 'bomb' || DDZ.classify(cards).type === 'rocket' ? 'bomb' : 'play')
    afterAction()
    maybeFinish(s)
  }

  function userPass() {
    const s = stRef.current
    if (!s) return
    try { G.applyPass(s, 0) } catch (e) { toastMsg(e.message); return }
    beep('play')
    afterAction()
  }

  function selectedRanks() {
    const s = stRef.current
    if (!s) return []
    const cards = cardsFromCounts(s.hands[0])
    return cards.filter(c => sel[c.id]).map(c => c.rank)
  }

  function userHint() {
    const s = stRef.current
    if (!s || s.phase !== 'play' || s.turn !== 0) return
    const { moves } = G.hintList(s, 0)
    const pool = moves.slice()
    if (!pool.length) { toastMsg(T.noCards); return }
    const idx = hintIdx % pool.length
    const m = pool[idx]
    const next = {}
    const cards = cardsFromCounts(s.hands[0])
    const want = m.cards.slice()
    cards.forEach(c => {
      const k = want.indexOf(c.rank)
      if (k >= 0) { next[c.id] = true; want.splice(k, 1) }
    })
    setSel(next)
    setHintIdx(idx + 1)
  }

  function adoptAdvice() {
    const s = stRef.current
    if (!s || !advice || !advice.move) { toastMsg(T.noCards); return }
    const next = {}
    const cards = cardsFromCounts(s.hands[0])
    const want = advice.move.cards.slice()
    cards.forEach(c => {
      const k = want.indexOf(c.rank)
      if (k >= 0) { next[c.id] = true; want.splice(k, 1) }
    })
    setSel(next)
    toastMsg(fmt(T.selectToast, { n: Object.keys(next).length }))
  }

  function askAdvice() {
    const s = stRef.current
    if (!s || s.phase !== 'play' || s.turn !== 0) return
    setThinking(T.adviceTitle + '…')
    setTimeout(() => {
      const r = G.aiMove(s, 0)
      setAdvice(r)
      setThinking('')
      touch()
    }, 30)
  }

  /* 快捷键：空格提示 / 回车出牌 / Esc 取消（在输入框里打字时不拦） */
  useEffect(() => {
    if (view !== 'table') return
    function onKey(e) {
      const tag = (e.target && e.target.tagName) || ''
      if (/^(INPUT|TEXTAREA|SELECT)$/i.test(tag) || e.isComposing) return
      if (modal) return
      if (auto) return
      const s = stRef.current
      if (!s || s.phase !== 'play' || s.turn !== 0) return
      if (e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space') {
        e.preventDefault()
        userHint()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        userPlay()
      } else if (e.key === 'Escape') {
        setSel({})
        setAdvice(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function maybeFinish(s) {
    if (s.phase !== 'over' || !s.result) return
    const iWin = (s.winners === 'landlord') === (s.landlord === 0)
    beep(iWin ? 'win' : 'lose')
    const key = 'total'
    const prev = stats[key] || { games: 0, wins: 0 }
    const byTier = stats.byTier || {}
    const tkey = s.tiers[0] || 'go'
    byTier[tkey] = byTier[tkey] || { games: 0, wins: 0 }
    byTier[tkey].games++
    if (iWin) byTier[tkey].wins++
    const best = iWin ? Math.min(stats.best || 1e9, s.result.seconds) : stats.best
    saveStats({
      ...stats,
      [key]: { games: prev.games + 1, wins: prev.wins + (iWin ? 1 : 0) },
      best: best === 1e9 ? undefined : best,
      byTier,
    })
    setModal('result')
  }

  function userSurrender() {
    const s = stRef.current
    if (!s || s.phase !== 'play') return
    s.phase = 'over'
    s.winners = s.landlord === 0 ? 'farmers' : 'landlord'
    s.endedAt = Date.now()
    s.result = G.computeResult(s)
    setModal('result')
    beep('lose')
    touch()
  }

  /* -------- AI 推进 -------- */
  useEffect(() => {
    const s = stRef.current
    if (!s || view !== 'table') return
    if (s.phase === 'over' || s.phase === 'redeal') return
    let who = null
    let kind = null
    if (s.phase === 'bid') { who = G.bidSeat(s); kind = 'bid' }
    else if (s.phase === 'double') {
      who = [0, 1, 2].find(x => !s.doubleChosen[x])
      kind = 'double'
    } else if (s.phase === 'play') { who = s.turn; kind = 'play' }
    if (who === null || who === undefined) return
    const isAuto = who !== 0 || auto
    if (!isAuto) return
    const tier = (s.tiers && s.tiers[who]) || 'go'
    const delay = kind === 'bid' ? 700 : kind === 'double' ? 800 : (tier === 'free' ? 450 : tier === 'go' ? 550 : 700)
    const timer = setTimeout(() => {
      const g = stRef.current
      if (!g || g.phase === 'over') return
      try {
        if (kind === 'bid') {
          const seat = G.bidSeat(g)
          G.applyBid(g, seat, G.aiBid(g, seat))
        } else if (kind === 'double') {
          const seat = [0, 1, 2].find(x => !g.doubleChosen[x])
          G.applyDouble(g, seat, G.aiDouble(g, seat))
        } else {
          const seat = g.turn
          setThinking(fmt(T.thinking, { tier: tierLabel(tier, T) }))
          const r = G.aiMove(g, seat)
          // 托管时把我这一手的 AI 判断留在建议卡里，让用户看得到理由
          if (seat === 0) setAdvice({ move: r.move, reason: r.reason, win: r.win })
          setThinking('')
          if (r.move) {
            const mv = DDZ.classify(r.move.cards)
            if (mv && (mv.type === 'bomb' || mv.type === 'rocket')) beep('bomb'); else beep('play')
            G.applyPlay(g, seat, r.move.cards)
          } else {
            G.applyPass(g, seat)
          }
          if (g.phase === 'over') maybeFinish(g)
        }
      } catch (e) {
        console.warn('[doudizhu] AI 行动失败', e)
      }
      turnStart.current = Date.now()
      setRemain(30)
      if (!(kind === 'play' && who === 0 && auto)) setAdvice(null)
      touch()
    }, delay)
    return () => clearTimeout(timer)
  })

  /* 重新发牌：等一会儿自动开新局 */
  useEffect(() => {
    const s = stRef.current
    if (!s || s.phase !== 'redeal' || view !== 'table') return
    const t = setTimeout(() => { startGame() }, 900)
    return () => clearTimeout(t)
  })

  /* 倒计时：只管我自己 */
  useEffect(() => {
    if (view !== 'table') return
    const id = setInterval(() => {
      const s = stRef.current
      if (!s || s.phase !== 'play' || s.turn !== 0 || auto) return
      const left = 30 - Math.floor((Date.now() - turnStart.current) / 1000)
      setRemain(Math.max(0, left))
      if (left <= 0) {
        turnStart.current = Date.now()
        try {
          if (s.last && s.last.seat !== 0) G.applyPass(s, 0)
          else {
            const h = G.hintList(s, 0)
            if (h.moves.length) G.applyPlay(s, 0, h.moves[0].cards)
          }
        } catch { /* 超时兜底失败就停在这 */ }
        setRemain(30)
        setSel({})
        touch()
        maybeFinish(s)
      }
    }, 500)
    return () => clearInterval(id)
  }, [view, auto, touch])

  /* 本局计时：每秒推一下 */
  useEffect(() => {
    if (view !== 'table') return
    const id = setInterval(() => {
      const s = stRef.current
      if (!s || s.phase === 'over') return
      setNowTick(Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [view])

  /* 轮到我时自动给建议（托管中不算，避免和 AI 推进互相打架） */
  useEffect(() => {
    const s = stRef.current
    if (auto) return
    if (!s || view !== 'table' || s.phase !== 'play' || s.turn !== 0) return
    const lm = s.last && s.last.move
    const key = JSON.stringify([s.hands[0].join('|'), s.last ? s.last.seat : '', lm ? lm.cards.join(',') : ''])
    if (adviceKeyRef.current === key) return
    adviceKeyRef.current = key
    if (adviceTimerRef.current) clearTimeout(adviceTimerRef.current)
    adviceTimerRef.current = setTimeout(() => {
      try { setAdvice(G.aiMove(s, 0)) } catch { /* ignore */ }
    }, 120)
  })

  /* -------- 渲染 -------- */
  const setupScreen = () => {
    const total = (stats.total && stats.total.games) || 0
    const wins = (stats.total && stats.total.wins) || 0
    const losses = Math.max(0, total - wins)
    const rate = total ? Math.round(wins / total * 100) : 0
    const wantSota = tiers.indexOf('sota') >= 0
    const sotaRow = () => {
      const p = Math.round((sota.progress || 0) * 100)
      const text = sota.status === 'ready' ? T.sotaReady
        : sota.status === 'downloading' ? fmt(T.sotaLoading, { p: p })
          : sota.status === 'error' ? fmt(T.sotaError, { msg: sota.error || '?' })
            : T.sotaIdle
      return h('div', { className: 'ddz-statsline ddz-sota-row' },
        h('span', null, T.sotaTitle + ' · ', h('b', { className: sota.status === 'ready' ? 'win' : (sota.status === 'error' ? 'lose' : '') }, text)),
        sota.status === 'error'
          ? h('button', {
            className: 'ddz-btn ddz-btn--ghost',
            onClick: () => { SOTA.reset(); SOTA.load().catch(() => { /* 状态回界面 */ }) }
          }, T.sotaRetry)
          : null,
        sota.status === 'idle'
          ? h('button', {
            className: 'ddz-btn ddz-btn--ghost',
            onClick: () => { SOTA.load().catch(() => { /* 状态回界面 */ }) }
          }, T.sotaDownload)
          : null)
    }
    return h('section', { className: 'ddz-screen ddz-setup' + (view === 'setup' ? ' is-on' : '') },
      h('div', { className: 'ddz-setup-card' },
        h(WhaleSvg, { cls: 'ddz-setup-watermark' }),
        h('header', { className: 'ddz-setup-head' },
          h('h1', { className: 'ddz-setup-title' }, h(WhaleSvg, { cls: 'ddz-whale-mark' }), T.appName)),
        h('p', { className: 'ddz-setup-sub' }, T.tagline),
        h('h3', null, T.modeTitle),
        h('div', { className: 'ddz-modecard' },
          h('button', { className: 'ddz-mode' + (mode === 'score' ? ' is-on' : ''), onClick: () => setMode('score') },
            h('b', null, T.modeScore), h('span', null, T.modeDescScore)),
          h('button', { className: 'ddz-mode' + (mode === 'rob' ? ' is-on' : ''), onClick: () => setMode('rob') },
            h('b', null, T.modeRob), h('span', null, T.modeDescRob))),
        h('h3', null, T.tiersTitle),
        h('div', { className: 'ddz-tiers' },
          [0, 1, 2].map(seat => h('div', { className: 'ddz-tier' + (seat === 0 ? ' is-on' : ''), key: seat },
            h(Avatar, { seat: seat }),
            h('span', { className: 'ddz-tier-name' }, whoName(seat, T)),
            h('select', {
              'aria-label': whoName(seat, T),
              value: tiers[seat],
              onChange: e => {
                const next = tiers.slice()
                next[seat] = e.target.value
                setTiers(next)
              },
            }, TIERS.map(t => h('option', { key: t, value: t }, T.tierNames[t] || t)))))),
        wantSota ? sotaRow() : null,
        h('div', { className: 'ddz-setup-actions' },
          h('button', { className: 'ddz-btn ddz-btn--primary', onClick: () => startGame() }, T.start),
          h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => setModal('help') }, T.help)),
        h('div', { className: 'ddz-statsline' },
          h('span', null, fmt(T.statsTotal, { n: total }), ' ', h('b', null, total)),
          h('span', null, fmt(T.statsWin, { n: wins }), ' ', h('b', { className: 'win' }, wins)),
          h('span', null, fmt(T.statsLose, { n: losses }), ' ', h('b', { className: 'lose' }, losses)),
          h('span', null, fmt(T.statsRate, { n: rate }), ' ', h('b', { className: 'win' }, rate + '%')),
          h('span', null, fmt(T.statsBest, { t: stats.best ? mmss(stats.best) : '—' })))))
  }

  const tableScreen = () => {
    if (!st) return null
    const handCards = cardsFromCounts(st.hands[0])
    const myTurn = st.phase === 'play' && st.turn === 0
    const counts = G.seatCounts(st)
    const bidders = st.phase === 'bid' ? G.bidSeat(st) : -1
    const elapsed = ((st.endedAt || nowTick) - st.startedAt) / 1000

    return h('section', { className: 'ddz-screen ddz-table' + (view === 'table' ? ' is-on' : '') },
      topbar(),
      counterBar(st, T, counterOpen),
      h('div', { className: 'ddz-statusbar' },
        h('div', { className: 'ddz-bottomcards' },
          h('span', { className: 'lbl' }, T.bottomCards),
          h('span', null, cardsFromCounts(st.bottom).map(c => h(Card, { key: c.id, card: c, small: true })))),
        h('div', { className: 'ddz-mult' },
          h('span', { className: 'x' }, '×' + currentMult(st)),
          h('span', { className: 't' }, T.multLabel)),
        h('div', { className: 'ddz-statuschips' },
          h('span', { className: 'ddz-statuschip' }, fmt(T.baseBidChip, { base: st.base || 1, bid: st.mode === 'score' ? (st.bidHigh || 0) : 1 })),
          h('span', { className: 'ddz-statuschip bomb' }, h('b', null, '×' + (st.bombs || 0)), ' ' + T.bombChip),
          h('span', { className: 'ddz-statuschip' }, fmt(T.clockChip, { t: mmss(elapsed) })))),
      h('div', { className: 'ddz-seatrow' },
        h(Seat, { st, seat: 2, T }),
        h('div', { className: 'ddz-turnpill' }, turnPill(bidders)),
        h(Seat, { st, seat: 1, T })),
      midSection(),
      h('div', { className: 'ddz-bottom' },
        h('div', { className: 'ddz-myseat' },
          h(Seat, { st, seat: 0, T, remain: remain, me: true })),
        h('div', { className: 'ddz-handwrap' },
          h(Hand, {
            cards: handCards,
            selected: sel,
            onSelect: (id, on) => setSel(prev => { const n = { ...prev }; if (on) n[id] = true; else delete n[id]; return n }),
            disabled: !myTurn || auto,
            T,
          })),
        h('div', { className: 'ddz-info' },
          h('span', null, infoTurn()),
          h('span', { className: 'sel-n' }, fmt(T.selectToast, { n: Object.keys(sel).length }))),
        h('div', { className: 'ddz-actions' },
          h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => { setSel({}); setAdvice(null) } }, T.cancel),
          h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: userPass, disabled: !myTurn || auto || !(st.last && st.last.seat !== 0) }, T.passAction),
          h('button', { className: 'ddz-btn ddz-btn--primary', onClick: userPlay, disabled: !myTurn || auto }, T.playAction),
          h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: userHint, disabled: !myTurn || auto }, T.hint),
          h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: askAdvice, disabled: !myTurn || auto }, T.advice),
          h('button', { className: 'ddz-btn ddz-btn--ghost' + (auto ? ' is-on' : ''), onClick: () => { setAuto(v => !v); toastMsg(!auto ? T.autoOn : T.auto) } }, auto ? T.autoOn : T.auto),
          h('button', { className: 'ddz-btn ddz-btn--danger', onClick: () => setModal('surrender'), disabled: st.phase !== 'play' }, T.surrender))),
      adviceCard())
  }

  function topbar() {
    return h('div', { className: 'ddz-topbar' },
      h('div', { className: 'ddz-title' },
        h('b', null, T.appName),
        h('small', null, st ? (st.phase === 'over' ? '' : (st.mode === 'rob' ? T.modeRob : T.modeScore) + ' · ' + tierLabel(tiers[0], T)) : T.tagline)),
      h('div', { className: 'ddz-chips' },
        h('button', { className: 'ddz-chipbtn' + (counterOpen ? ' is-on' : ''), title: T.counter, onClick: () => setCounterOpen(v => !v) },
          h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': 'true' },
            h('rect', { x: 4, y: 3, width: 16, height: 18, rx: 2 }), h('path', { d: 'M8 8h8M8 12h8M8 16h5' })),
          h('span', { className: 'lbl' }, T.counter)),
        h('button', { className: 'ddz-chipbtn' + (auto ? ' is-on' : ''), onClick: () => setAuto(v => !v) }, h('span', { className: 'lbl' }, auto ? T.autoOn : T.auto)),
        st && (st.phase === 'play' || st.phase === 'double') && !st.open[0]
          ? h('button', { className: 'ddz-chipbtn', onClick: userOpen, title: T.openOn }, h('span', { className: 'lbl' }, T.openShort))
          : null,
        h('button', { className: 'ddz-chipbtn' + (sound ? ' is-on' : ''), onClick: () => { setSound(v => { try { localStorage.setItem('ddz-sound', v ? '0' : '1') } catch { /* ignore */ } ; return !v }) } },
          h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': 'true' },
            h('path', { d: 'M11 5 6 9H3v6h3l5 4z' }), h('path', { d: 'M15.5 8.5a5 5 0 0 1 0 7' })),
          h('span', { className: 'lbl' }, T.sound)),
        h('button', { className: 'ddz-chipbtn', onClick: () => { const next = lang === 'zh' ? 'en' : 'zh'; setLang(next); try { localStorage.setItem('ddz-lang', next) } catch { /* ignore */ } } }, h('span', { className: 'lbl' }, T.lang)),
        h('button', { className: 'ddz-chipbtn', onClick: () => setModal('help') }, '?'),
        h('button', { className: 'ddz-chipbtn', onClick: () => { setView('setup'); stRef.current = null; setModal(null) } }, h('span', { className: 'lbl' }, T.back))))
  }

  function turnPill(bidders) {
    if (st.phase === 'bid') return fmt(T.turnBid, { who: whoName(bidders, T) })
    if (st.phase === 'double') return T.doubleTurn
    if (st.phase === 'play') return fmt(T.turnPlay, { who: whoName(st.turn, T) })
    return T.landlordIs ? fmt(T.landlordIs, { who: whoName(st.landlord, T) }) : ''
  }

  function infoTurn() {
    if (!st) return ''
    if (st.phase === 'play' && st.turn === 0) return auto ? T.autoOn : T.yourTurn
    if (st.phase === 'play') return fmt(T.thinking, { tier: tierLabel(tiers[st.turn] || 'go', T) })
    if (st.phase === 'over') return ''
    return fmt(T.nowPhase, { phase: st.phase === 'bid' ? T.modeScore : T.doubleTurn })
  }

  function midSection() {
    const lastCards = st.last ? cardsFromCounts(DDZ.countsOf(st.last.move.cards)) : null
    const isBomb = st.last && st.last.move && (st.last.move.type === 'bomb' || st.last.move.type === 'rocket')
    const recent = st.recent || {}
    const side = (seat) => {
      const a = recent[seat]
      return h('div', { className: 'ddz-sideplay' },
        h('span', { className: 'who' }, whoName(seat, T)),
        a && a.type === 'pass' ? h('span', { className: 'ddz-sidepass' }, T.passAction) : null,
        a && a.type === 'play'
          ? h('div', { className: 'ddz-played' }, cardsFromCounts(DDZ.countsOf(a.cards)).map(c => h(Card, { key: c.id, card: c, small: true })))
          : null)
    }
    return h('div', { className: 'ddz-mid' },
      h(WhaleSvg, { cls: 'ddz-mid-whale' }),
      h('div', { className: 'ddz-mid-grid' },
        side(2),
        h('div', { className: 'ddz-mid-center' },
          h('div', { className: 'ddz-lastlabel' }, st.last ? T.lastPlay : T.noPlay),
          st.last ? h('div', { className: 'ddz-played' + (isBomb ? ' is-bomb' : '') },
            lastCards.map(c => h(Card, { key: c.id, card: c, small: true }))) : null,
          thinking ? h('div', { className: 'ddz-think' }, h('span', { className: 'ddz-spinner' }), h('span', null, thinking)) : null,
          !st.last && !thinking ? h('div', { className: 'ddz-mid-empty' }, T.noPlay) : null),
        side(1)),
      phaseOverlay())
  }

  function phaseOverlay() {
    if (st.phase === 'bid') {
      const seat = G.bidSeat(st)
      const opts = seat === 0 ? G.bidOptions(st) : []
      return h('div', { className: 'ddz-overlay is-on', style: { position: 'absolute', background: 'transparent' } },
        h('div', { className: 'ddz-dialog', style: { maxWidth: 400 } },
          h('div', { className: 'ddz-dialog-strip info' }),
          h('h2', null, fmt(T.turnBid, { who: whoName(seat, T) })),
          h('p', { className: 'sub' }, st.mode === 'rob' ? T.modeDescRob : T.modeDescScore),
          seat === 0
            ? h('div', { className: 'ddz-bid-opts' },
              opts.map(v => h('button', {
                key: String(v),
                className: 'ddz-btn ' + (v === 0 ? 'ddz-btn--ghost' : 'ddz-btn--primary'),
                onClick: () => userBid(v),
              }, bidText(v))))
            : h('div', { className: 'ddz-think' }, h('span', { className: 'ddz-spinner' }), '…')))
    }
    if (st.phase === 'double') {
      const done = st.doubleChosen
      return h('div', { className: 'ddz-overlay is-on', style: { position: 'absolute', background: 'transparent' } },
        h('div', { className: 'ddz-dialog', style: { maxWidth: 400 } },
          h('div', { className: 'ddz-dialog-strip info' }),
          h('h2', null, T.doubleTurn),
          h('p', { className: 'sub' }, fmt(T.landlordIs, { who: whoName(st.landlord, T) })),
          h('div', { className: 'ddz-props' },
            [0, 1, 2].map(s => h('div', { className: 'ddz-props-row', key: s },
              h('span', { className: 'k' }, whoName(s, T)),
              h('span', { className: 'v' }, done[s] ? (st.doubling[s] === 1 ? T.doubleNone : st.doubling[s] === 2 ? T.doubleX2 : T.doubleX4) : '…')))),
          done[0] ? null : h('div', { className: 'ddz-bid-opts' },
            h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => userDouble(1) }, T.doubleNone),
            h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => userDouble(2) }, T.doubleX2),
            h('button', { className: 'ddz-btn ddz-btn--primary', onClick: () => userDouble(4) }, T.doubleX4)),
          st.open[0] ? null : h('div', { className: 'ddz-bid-opts' },
            h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: userOpen }, T.openShort))))
    }
    return null
  }

  function bidText(v) {
    if (v === 0) return T.pass
    if (st.mode === 'rob') return v === 'call' ? T.call : v === 'rob' ? T.rob : String(v)
    return v + '分'
  }

  function adviceCard() {
    if (!advice) return null
    return h('div', { className: 'ddz-advice' },
      h('div', { className: 'ddz-advice-head' }, h(WhaleSvg, null), T.adviceTitle),
      h('div', { className: 'ddz-advice-move' }, advice.move ? DDZ.cardsText(advice.move.cards) : T.passAction),
      advice.reason ? h('div', { className: 'ddz-advice-why' }, advice.reason) : null,
      typeof advice.win === 'number' ? h('div', { className: 'ddz-advice-rate' }, fmt(T.adviceWin, { n: Math.round(advice.win) })) : null,
      h('button', { className: 'ddz-btn ddz-btn--primary', onClick: adoptAdvice }, T.adopt))
  }

  function toastEl() {
    return toast ? h('div', { className: 'ddz-toast' }, toast) : null
  }

  function modalEl() {
    if (modal === 'help') return h(Help, { T, onClose: () => setModal(null) })
    if (modal === 'result' && st && st.result) {
      return h(Result, {
        st, T,
        onAgain: () => startGame(),
        onReTier: () => { setView('setup'); setModal(null); stRef.current = null },
        onReplay: () => setModal('replay'),
        onClose: () => setModal(null),
      })
    }
    if (modal === 'replay' && st) return h(Replay, { st, T, onClose: () => setModal(null) })
    if (modal === 'surrender') {
      return h('div', { className: 'ddz-overlay is-on' },
        h('div', { className: 'ddz-dialog', style: { maxWidth: 380 } },
          h('div', { className: 'ddz-dialog-strip', style: { background: 'linear-gradient(90deg,var(--ddz-bad),transparent)' } }),
          h('h2', null, T.surrenderTitle),
          h('p', { className: 'sub' }, T.surrenderAsk),
          h('div', { className: 'ddz-dialog-actions' },
            h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => setModal(null) }, T.cancel),
            h('button', { className: 'ddz-btn ddz-btn--danger', onClick: () => { setModal(null); userSurrender() } }, T.confirm))))
    }
    if (modal === 'open') {
      return h('div', { className: 'ddz-overlay is-on' },
        h('div', { className: 'ddz-dialog', style: { maxWidth: 380 } },
          h('div', { className: 'ddz-dialog-strip info' }),
          h('h2', null, T.openShort + '？'),
          h('p', { className: 'sub' }, T.openAsk),
          h('div', { className: 'ddz-dialog-actions' },
            h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => setModal(null) }, T.cancel),
            h('button', { className: 'ddz-btn ddz-btn--primary', onClick: confirmOpen }, T.confirm))))
    }
    return null
  }

  return h('div', { className: 'ddz-root' },
    setupScreen(),
    tableScreen(),
    toastEl(),
    modalEl())
}

/* ---------------- 侧栏图标 / 更多菜单行 ---------------- */

function SidebarIcon(props) {
  const size = props && typeof props.size === 'number' ? props.size : 16
  return h('svg', {
    viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true', focusable: 'false',
  },
    h('rect', { x: 2.2, y: 3.6, width: 8, height: 10.2, rx: 1.6 }),
    h('path', { d: 'M5.4 1.4h7.2c.7 0 1.2.5 1.2 1.2v9.6' }),
    h('path', { d: 'M4.6 6.6h3.2M4.6 9.2h3.2M4.6 11.4h1.8' }))
}

function MoreMenuRow(props) {
  const onOpen = props && props.onOpen
  return h('button', {
    className: 'ddz-more-row',
    onClick: () => { if (typeof onOpen === 'function') onOpen(PANEL_ID) },
  }, h(SidebarIcon, { size: 16 }), h('span', null, '斗地主'))
}


    /* ================= 5. 插件入口 ================= */
    const STYLE_ID = "dsh-doudizhu-styles"

    function currentLang() {
      try { return localStorage.getItem("ddz-lang") === "en" ? "en" : "zh" } catch (e) { return "zh" }
    }

    function ensureStyles() {
      if (typeof document === "undefined") return function () {}
      const old = document.getElementById(STYLE_ID)
      if (old) {
        if (old.parentNode) old.parentNode.removeChild(old)
      }
      const el = document.createElement("style")
      el.id = STYLE_ID
      el.textContent = CSS
      ;(document.head || document.body || document.documentElement).appendChild(el)
      return function () {
        try { if (el.parentNode) el.parentNode.removeChild(el) } catch (e) { /* ignore */ }
      }
    }

    const inject = ["slots"]

    function apply(ctx) {
      const slots = ctx && typeof ctx.get === "function" ? ctx.get("slots") : ctx && ctx.slots
      if (slots === void 0 || slots === null || typeof slots.register !== "function") {
        console.warn("[doudizhu] 宿主没有 slots 服务，侧栏入口未注册")
        return
      }

      const disposeStyles = ensureStyles()
      const disposers = []

      disposers.push(
        slots.inject("main", () => slots.register({ name: "main", key: PANEL_ID }, PanelView)),
      )

      disposers.push(
        slots.inject("sidebar.panellist", () => slots.register(
          { name: "sidebar.panellist", id: PANEL_ID, order: 55, label: () => I18N[currentLang()].appName },
          SidebarIcon,
        )),
      )

      disposers.push(
        slots.inject("sidebar.panellist.actions", () => slots.register(
          { name: "sidebar.panellist.actions", id: PANEL_ID + "-more" },
          MoreMenuRow,
        )),
      )

      if (typeof ctx.effect === "function") {
        ctx.effect(
          () => () => {
            for (const dispose of disposers.splice(0)) {
              try { if (typeof dispose === "function") dispose() } catch (e) { /* 已卸载 */ }
            }
            try { disposeStyles() } catch (e) { /* ignore */ }
          },
          "dsh-doudizhu-game:client",
        )
      }
    }

    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})