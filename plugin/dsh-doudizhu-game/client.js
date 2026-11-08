/*! dsh-doudizhu-game · 生成的 client.js —— 不要手改，改 src/*.js 后执行 node build.mjs */
window.__ModuleLoader__.load({
  id: 'dsh-doudizhu-game',
  factory(require) {
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

    // 四带二
    const four = g.find(x => x.k === 4);
    if (four) {
      const rest = g.filter(x => x !== four);
      if (n === 6 && rest.length === 2 && rest[0].k === 1 && rest[1].k === 1) return mk('four2', four.r, 1);
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
          for (let i = 0; i < N; i++) if (restC[i] > 2) { okWing = false; break; }
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
    // 从剩余手牌里挑 count 个「不同点数」，优先低点数、优先已有对子/单张少的
    const cand = [];
    for (let i = 0; i < N; i++) {
      if (wantPairs) { if (c[i] >= 2) cand.push({ r: i + 3, n: c[i] }); }
      else if (c[i] > 0) cand.push({ r: i + 3, n: c[i] });
    }
    cand.sort((a, b) => a.n - b.n || a.r - b.r);
    const pick = cand.slice(0, Math.min(cand.length, Math.max(count, limit || count)));
    const out = [];
    const recursion = (start, acc) => {
      if (out.length >= (limit || 8)) return;
      if (acc.length === count) { out.push(acc.slice()); return; }
      for (let i = start; i < pick.length; i++) {
        acc.push(pick[i].r);
        recursion(i + 1, acc);
        acc.pop();
        if (out.length >= (limit || 8)) return;
      }
    };
    recursion(0, []);
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
      comboRanks(rest, false, 1, 3).forEach(w => add(trio.concat(w)));
      comboRanks(rest, true, 1, 3).forEach(w => add(trio.concat(w, w)));
    }

    // 四带二
    for (let i = 0; i < N; i++) {
      if (c[i] !== 4) continue;
      const r = i + 3, q = [r, r, r, r];
      const rest = c.slice(); rest[i] = 0;
      comboRanks(rest, false, 2, 4).forEach(w => add(q.concat(w)));
      comboRanks(rest, true, 2, 4).forEach(w => add(q.concat(w, w)));
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
        comboRanks(rest, false, len, 12).forEach(w => add(main.concat(w)));
        comboRanks(rest, true, len, 12).forEach(w => add(main.concat(...w.map(x => [x, x]))));
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
    else if (t > 16) v = greedyPlans(c);
    else {
      const r = exactPlans(c, { nodes: 0, budget: 30000 });
      v = (r == null) ? greedyPlans(c) : r;
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

  function greedyPlans(c) {
    let best = 999;
    for (let mode = 0; mode < 3; mode++) {
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

  /* ---------------- 难度档：free / go / plus / pro100 / pro200 / pro500 / pro9999 ---------------- */

  const TIERS = ['free', 'go', 'plus', 'pro100', 'pro200', 'pro500', 'pro9999'];

  // 每档的思考预算：budget = 最多推演多少次，ms = 每手最多花多久
  const TIER_CFG = {
    free:    { budget: 0,    ms: 0 },
    go:      { budget: 0,    ms: 0 },
    plus:    { budget: 12,   ms: 120 },
    pro100:  { budget: 100,  ms: 500 },
    pro200:  { budget: 200,  ms: 1000 },
    pro500:  { budget: 500,  ms: 2000 },
    pro9999: { budget: 9999, ms: 4000 }
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
  function sampleHands(hand, played, seatCounts, me) {
    const pool = [];
    const u = unseen(hand, played);
    for (let i = 0; i < N; i++) for (let k = 0; k < u[i]; k++) pool.push(i + 3);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const hands = [zero(), zero(), zero()];
    hands[me] = hand.slice();
    let p = 0;
    for (let s = 0; s < 3; s++) {
      if (s === me) continue;
      let want = seatCounts[s] || 0;
      const h = hands[s];
      while (want-- > 0 && p < pool.length) addCard(h, pool[p++]);
      while (total(h) < (seatCounts[s] || 0)) addCard(h, 3 + Math.floor(Math.random() * 15));
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
      const hands = sampleHands(state.hand, state.played, state.seatCounts, state.me);
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

  function advise(state, opts) {
    const tier = tierOf(opts && opts.tier);
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
    deal, pickLandlord
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

  // 手牌强度：叫地主/加倍都用它，返回 0..10
  function strength(st, seat) {
    const h = st.hands[seat]
    let s = 0
    s += h[14] * 4.5   // 大王
    s += h[13] * 2.4   // 小王
    s += h[12] * 1.5   // 2
    s += h[11] * 0.8   // A
    s += h[10] * 0.3   // K
    for (let i = 0; i < N; i++) if (h[i] === 4) s += 4.2
    if (h[13] > 0 && h[14] > 0) s += 3.5  // 王炸
    const pc = DDZ.planCount(h)
    s += Math.max(0, 10 - pc) * 0.55
    return Math.min(10, s)
  }

  function aiBid(st, seat) {
    const s = strength(st, seat)
    if (st.mode === 'score') {
      let v = 0
      if (s >= 7.4) v = 3
      else if (s >= 5.6) v = 2
      else if (s >= 4.0) v = 1
      // 已经有人叫得比这高了就叫不了，只能过
      return v > st.bidHigh ? v : 0
    }
    if (st.bidHighSeat < 0) return s >= 4.6 ? 'call' : 0
    return s >= 5.8 ? 'rob' : 0
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
    if (s >= 7.2) return 4
    if (s >= 5.0) return 2
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
    st.last = { seat, move }
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
    st.replay.push({ type: 'pass', seat })
    if (st.passes >= 2) {
      st.turn = st.lastLeader
      st.last = null
      st.passes = 0
    } else {
      st.turn = nextSeat(seat)
    }
    return st
  }

  /* ------------------------------------------------------------------ *
   * 结算
   * ------------------------------------------------------------------ */

  function computeResult(st) {
    const spring = st.winners === 'landlord' && st.playCounts[0] === 0 && st.playCounts[1] === 0 && st.playCounts[2] === 0
      ? false : false // 占位，真实判断在下面
    const landlordWon = st.winners === 'landlord'
    const farmersPlayed = [0, 1, 2].filter(s => s !== st.landlord).reduce((a, s) => a + st.playCounts[s], 0)
    const isSpring = landlordWon && farmersPlayed === 0
    const isAnti = !landlordWon && st.playCounts[st.landlord] <= 1

    let mult = st.base
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

  function adviseState(st, seat) {
    const lastOk = st.last && st.last.seat !== seat ? { seat: st.last.seat, move: st.last.move } : null
    return {
      hand: st.hands[seat],
      me: seat,
      landlord: st.landlord,
      seatCounts: [total(st.hands[0]), total(st.hands[1]), total(st.hands[2])],
      played: st.played,
      last: lastOk,
      bottom: st.bottom
    }
  }

  function fallbackMove(st, seat) {
    const { moves, canPass } = legalMoves(st, seat)
    if (!moves.length) return { move: null }
    // 领出：出最小的一手；跟牌：出能压过去里最小的
    const sorted = moves.slice().sort((a, b) => (a.cards.length - b.cards.length) || (a.rank - b.rank))
    return { move: sorted[0] }
  }

  function aiMove(st, seat) {
    const t0 = Date.now()
    const { moves, canPass } = legalMoves(st, seat)
    if (!moves.length) return { move: null, reason: '', ms: 0 }
    let res = null
    try {
      res = DDZ.advise(adviseState(st, seat), { tier: st.tiers[seat] })
    } catch (e) {
      res = null
    }
    const valid = res && !res.pass && res.move && moves.some(m => m.cards.join(',') === res.move.cards.join(','))
    if (valid) return { move: res.move, reason: res.reason || '', win: res.win, ms: Date.now() - t0 }
    const fb = fallbackMove(st, seat)
    return { move: fb.move, reason: res && res.pass ? '这手牌不划算，先过' : '', ms: Date.now() - t0 }
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
    createGame, cloneState, strength,
    bidSeat, bidOptions, applyBid, aiBid,
    aiDouble, applyDouble, applyOpen,
    legalMoves, applyPlay, applyPass,
    computeResult, adviseState, aiMove, fallbackMove, hintList,
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
      free: 'free · 随手打',
      go: 'go · 会算基本牌',
      plus: 'plus · 会记牌',
      pro100: 'pro100 · 算一百次',
      pro200: 'pro200 · 算两百次',
      pro500: 'pro500 · 算五百次',
      pro9999: 'pro9999 · 拉满'
    },
    modeDescScore: '叫 1/2/3 分，最高分当地主',
    modeDescRob: '先叫地主，后面的人可以抢',
    rulesTitle: '规则与难度',
    rulesBody: [
      '叫地主：随机一人先叫；叫分玩法里叫得最高的当地主，都不叫就重新发牌。',
      '加倍：定地主后三家同时选，不加倍 / 加倍 / 超级加倍（4 倍）。',
      '明牌：亮了全场 ×2，对手手牌对你可见。',
      '底分 1；炸弹、王炸各 ×2；春天、反春各 ×2。',
      '跟牌压不过就过；两家连过，回到最后出牌的人重新领出。',
      '难度档只影响电脑，开局前选；托管和军师建议随时能开。'
    ],
    tierHint: '档位越高算得越细、想得越久；pro9999 一手最多要 4 秒。'
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
      free: 'free · random',
      go: 'go · basic',
      plus: 'plus · counting',
      pro100: 'pro100 · 100 sims',
      pro200: 'pro200 · 200 sims',
      pro500: 'pro500 · 500 sims',
      pro9999: 'pro9999 · max'
    },
    modeDescScore: 'Bid 1/2/3 points, highest becomes landlord',
    modeDescRob: 'Call landlord first, others may rob',
    rulesTitle: 'Rules & levels',
    rulesBody: [
      'Bidding: a random player bids first. Highest bid becomes landlord; all pass means redeal.',
      'Doubling: after the landlord is set, all three pick no double / double / super double (×4).',
      'Open hand: reveals your cards, doubles the stake, and exposes opponents to you.',
      'Base 1; each bomb and rocket ×2; spring and anti-spring ×2.',
      'You may pass when following; two passes end the trick and the last player leads.',
      'Difficulty only affects the bots, chosen before the deal. Auto-play and coach are always available.'
    ],
    tierHint: 'Higher tiers think longer; pro9999 can take up to 4 seconds per move.'
  }
}

/* 斗地主插件样式：DSH 深色玻璃风，自动跟随系统深浅色 */
const CSS = String.raw`
.ddz-root {
  --ddz-bg: #0f1116;
  --ddz-panel: rgba(24, 27, 34, 0.72);
  --ddz-panel-solid: #191c23;
  --ddz-line: rgba(255, 255, 255, 0.09);
  --ddz-line-strong: rgba(255, 255, 255, 0.18);
  --ddz-text: #e8ecf3;
  --ddz-dim: #98a2b3;
  --ddz-accent: #6ea8fe;
  --ddz-accent-weak: rgba(110, 168, 254, 0.16);
  --ddz-good: #4ade80;
  --ddz-bad: #fb7185;
  --ddz-gold: #f5c451;
  --ddz-felt: radial-gradient(120% 90% at 50% -10%, #1d2430 0%, #13161c 55%, #0d0f14 100%);
  --ddz-card-bg: linear-gradient(180deg, #fbfcfe 0%, #e9edf4 100%);
  --ddz-card-ink: #15181e;
  --ddz-red: #d0283c;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--ddz-text);
  background: var(--ddz-felt);
  font: 13px/1.45 "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: light) {
  .ddz-root {
    --ddz-bg: #f4f5f8;
    --ddz-panel: rgba(255, 255, 255, 0.78);
    --ddz-panel-solid: #ffffff;
    --ddz-line: rgba(15, 20, 30, 0.1);
    --ddz-line-strong: rgba(15, 20, 30, 0.2);
    --ddz-text: #1a1f2a;
    --ddz-dim: #5d6779;
    --ddz-accent: #2f6fdd;
    --ddz-accent-weak: rgba(47, 111, 221, 0.12);
    --ddz-felt: radial-gradient(120% 90% at 50% -10%, #e7ebf3 0%, #eef0f5 55%, #f6f7fa 100%);
    --ddz-card-bg: linear-gradient(180deg, #ffffff 0%, #eef1f7 100%);
    --ddz-card-ink: #15181e;
    --ddz-red: #c31f34;
  }
}
.ddz-root * { box-sizing: border-box; }
.ddz-scroll { overflow: auto; min-height: 0; }

/* ---------- 顶栏 ---------- */
.ddz-topbar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--ddz-line);
  background: linear-gradient(180deg, rgba(255,255,255,0.03), transparent);
}
.ddz-title { font-size: 14px; font-weight: 650; letter-spacing: .3px; }
.ddz-title small { color: var(--ddz-dim); font-weight: 450; margin-left: 8px; }
.ddz-topbar .ddz-spacer { flex: 1; }
.ddz-chipbtn {
  height: 26px; padding: 0 10px; border-radius: 7px;
  border: 1px solid var(--ddz-line); background: var(--ddz-panel);
  color: var(--ddz-text); font-size: 12px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
}
.ddz-chipbtn:hover { border-color: var(--ddz-line-strong); }
.ddz-chipbtn.is-on { background: var(--ddz-accent-weak); border-color: var(--ddz-accent); color: var(--ddz-accent); }

/* ---------- 按钮 / 分段 ---------- */
.ddz-btn {
  height: 34px; padding: 0 16px; border-radius: 9px; cursor: pointer;
  border: 1px solid var(--ddz-line-strong); background: var(--ddz-panel);
  color: var(--ddz-text); font-size: 13px; font-weight: 550;
  transition: transform .06s ease, background .15s ease, border-color .15s ease;
}
.ddz-btn:hover { border-color: var(--ddz-accent); }
.ddz-btn:active { transform: translateY(1px); }
.ddz-btn.primary { background: linear-gradient(180deg, #3f7fe0, #2f63c4); border-color: #2f63c4; color: #fff; }
.ddz-btn.primary:hover { background: linear-gradient(180deg, #4b8bf0, #3670d6); }
.ddz-btn.ghost { background: transparent; }
.ddz-btn.danger { color: var(--ddz-bad); border-color: rgba(251,113,133,.4); }
.ddz-btn[disabled] { opacity: .45; cursor: default; }
.ddz-seg { display: inline-flex; padding: 2px; gap: 2px; border-radius: 9px; border: 1px solid var(--ddz-line); background: rgba(0,0,0,.18); }
.ddz-seg button {
  height: 28px; padding: 0 12px; border-radius: 7px; border: 0; background: transparent;
  color: var(--ddz-dim); font-size: 12px; cursor: pointer;
}
.ddz-seg button.is-on { background: var(--ddz-accent-weak); color: var(--ddz-accent); font-weight: 600; }

/* ---------- 开局页 ---------- */
.ddz-setup { max-width: 720px; margin: 0 auto; padding: 28px 22px 40px; width: 100%; }
.ddz-setup h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: .5px; }
.ddz-setup .sub { color: var(--ddz-dim); margin-bottom: 26px; }
.ddz-field { margin-bottom: 20px; }
.ddz-field > label { display: block; color: var(--ddz-dim); font-size: 12px; margin-bottom: 8px; }
.ddz-tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.ddz-tiercard { padding: 12px; border: 1px solid var(--ddz-line); border-radius: 11px; background: var(--ddz-panel); }
.ddz-tiercard b { display: block; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
.ddz-tiercard select {
  width: 100%; height: 30px; border-radius: 7px; border: 1px solid var(--ddz-line-strong);
  background: var(--ddz-panel-solid); color: var(--ddz-text); font-size: 12px; padding: 0 8px;
}
.ddz-modecard { display: flex; gap: 8px; }
.ddz-modecard button {
  flex: 1; text-align: left; padding: 11px 12px; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--ddz-line); background: var(--ddz-panel); color: var(--ddz-text);
}
.ddz-modecard button.is-on { border-color: var(--ddz-accent); background: var(--ddz-accent-weak); }
.ddz-modecard b { display: block; font-size: 13px; margin-bottom: 3px; }
.ddz-modecard span { color: var(--ddz-dim); font-size: 11.5px; }
.ddz-setup-actions { display: flex; align-items: center; gap: 12px; margin-top: 26px; }
.ddz-kbi { color: var(--ddz-dim); font-size: 11.5px; }
.ddz-statsline { color: var(--ddz-dim); font-size: 12px; margin-top: 18px; }

/* ---------- 牌桌 ---------- */
.ddz-table { position: relative; flex: 1; min-height: 0; display: grid; grid-template-rows: auto 1fr auto; }
.ddz-seatrow { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 12px 16px; }
.ddz-seat {
  min-width: 132px; padding: 9px 12px; border-radius: 12px;
  border: 1px solid var(--ddz-line); background: var(--ddz-panel); backdrop-filter: blur(8px);
  display: flex; align-items: center; gap: 10px; transition: border-color .2s, box-shadow .2s;
}
.ddz-seat.is-turn { border-color: var(--ddz-accent); box-shadow: 0 0 0 1px var(--ddz-accent), 0 6px 22px rgba(110,168,254,.18); }
.ddz-seat.is-me { border-color: var(--ddz-line-strong); }
.ddz-avatar {
  width: 34px; height: 34px; border-radius: 50%; flex: 0 0 34px;
  display: grid; place-items: center; font-size: 12px; font-weight: 700;
  background: linear-gradient(160deg, #39404f, #232833); color: #cfd7e6; position: relative;
}
.ddz-avatar.landlord { background: linear-gradient(160deg, #6b4c12, #3a2a08); color: var(--ddz-gold); }
.ddz-avatar .crown { position: absolute; top: -8px; font-size: 12px; }
.ddz-seat .meta { min-width: 0; }
.ddz-seat .name { font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.ddz-seat .sub2 { font-size: 11px; color: var(--ddz-dim); white-space: nowrap; }
.ddz-seat .sub2 em { font-style: normal; color: var(--ddz-accent); }
.ddz-ring { position: relative; width: 26px; height: 26px; flex: 0 0 26px; margin-left: auto; }
.ddz-ring span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 10.5px; color: var(--ddz-dim); }
.ddz-ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
.ddz-ring circle { fill: none; stroke-width: 2.4; }
.ddz-ring .bg { stroke: rgba(255,255,255,.1); }
.ddz-ring .fg { stroke: var(--ddz-accent); transition: stroke-dashoffset .5s linear; }

.ddz-mid { position: relative; display: grid; place-items: center; min-height: 0; }
.ddz-mid-inner { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.ddz-lastlabel { color: var(--ddz-dim); font-size: 11.5px; letter-spacing: .4px; }
.ddz-played { display: flex; gap: 4px; min-height: 64px; align-items: center; }
.ddz-turnpill {
  padding: 5px 12px; border-radius: 999px; font-size: 12px;
  background: var(--ddz-panel); border: 1px solid var(--ddz-line);
}
.ddz-turnpill.is-you { color: var(--ddz-good); border-color: rgba(74,222,128,.35); }
.ddz-think { display: inline-flex; align-items: center; gap: 7px; color: var(--ddz-dim); font-size: 12px; }
.ddz-spin { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--ddz-line-strong); border-top-color: var(--ddz-accent); animation: ddz-spin .8s linear infinite; }
@keyframes ddz-spin { to { transform: rotate(360deg); } }

/* ---------- 底部：手牌区 ---------- */
.ddz-bottom { display: grid; grid-template-columns: 210px 1fr 250px; gap: 12px; padding: 10px 16px 14px; align-items: end; }
.ddz-counter { border: 1px solid var(--ddz-line); border-radius: 12px; background: var(--ddz-panel); padding: 8px 10px; }
.ddz-counter .ct { font-size: 11px; color: var(--ddz-dim); margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
.ddz-counter .ct button { margin-left: auto; border: 0; background: none; color: var(--ddz-dim); cursor: pointer; font-size: 11px; }
.ddz-counts { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.ddz-count {
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  padding: 3px 0; border-radius: 6px; background: rgba(255,255,255,.04);
  font-size: 11px; color: var(--ddz-text);
}
.ddz-count b { font-size: 10px; color: var(--ddz-dim); font-weight: 500; }
.ddz-count.is-hot { background: rgba(251,113,133,.16); color: var(--ddz-bad); }
.ddz-count.is-zero { opacity: .35; }

.ddz-handwrap { min-width: 0; }
.ddz-hand { display: flex; justify-content: center; align-items: flex-end; min-height: 78px; padding: 0 4px; }
.ddz-card {
  position: relative; width: 46px; height: 66px; margin-left: -14px; flex: 0 0 46px;
  border-radius: 7px; background: var(--ddz-card-bg); color: var(--ddz-card-ink);
  border: 1px solid rgba(0,0,0,.28); box-shadow: 0 3px 8px rgba(0,0,0,.35);
  cursor: pointer; user-select: none; -webkit-user-select: none; touch-action: none;
  transition: transform .12s ease, box-shadow .12s ease;
  display: flex; flex-direction: column; justify-content: space-between; padding: 4px 5px;
}
.ddz-card:first-child { margin-left: 0; }
.ddz-card:hover { transform: translateY(-4px); }
.ddz-card.is-sel { transform: translateY(-14px); box-shadow: 0 0 0 2px var(--ddz-accent), 0 8px 16px rgba(0,0,0,.45); }
.ddz-card .r { font-size: 15px; font-weight: 700; line-height: 1; letter-spacing: -.4px; }
.ddz-card .s { font-size: 15px; line-height: 1; align-self: flex-end; }
.ddz-card.is-red { color: var(--ddz-red); }
.ddz-card.joker .r { font-size: 11px; writing-mode: vertical-rl; letter-spacing: 1px; }
.ddz-card.small { width: 34px; height: 48px; flex-basis: 34px; margin-left: -12px; padding: 3px; }
.ddz-card.small .r, .ddz-card.small .s { font-size: 11px; }
.ddz-card.static { cursor: default; }
.ddz-card.static:hover { transform: none; }
.ddz-card.back {
  background: repeating-linear-gradient(135deg, #2a3550 0 6px, #223048 6px 12px);
  border-color: rgba(255,255,255,.12); color: transparent;
}
.ddz-handinfo { text-align: center; color: var(--ddz-dim); font-size: 11.5px; margin-top: 6px; min-height: 16px; }

.ddz-actions { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
.ddz-actions-row { display: flex; gap: 8px; justify-content: flex-end; }
.ddz-advice {
  border: 1px solid var(--ddz-line); border-radius: 12px; padding: 9px 11px;
  background: linear-gradient(180deg, rgba(110,168,254,.12), rgba(110,168,254,.03));
  font-size: 12px; min-height: 64px;
}
.ddz-advice .hd { display: flex; align-items: center; gap: 6px; color: var(--ddz-accent); font-size: 11px; margin-bottom: 4px; }
.ddz-advice .mv { font-weight: 600; }
.ddz-advice .rs { color: var(--ddz-dim); font-size: 11.5px; margin-top: 2px; line-height: 1.4; }
.ddz-advice .win { color: var(--ddz-good); font-size: 11px; margin-left: auto; }

/* ---------- 弹层 ---------- */
.ddz-overlay {
  position: absolute; inset: 0; z-index: 40; display: grid; place-items: center;
  background: rgba(6, 8, 12, .62); backdrop-filter: blur(3px); padding: 20px;
}
.ddz-modal {
  width: min(520px, 100%); max-height: 90%; overflow: auto;
  border: 1px solid var(--ddz-line-strong); border-radius: 16px;
  background: var(--ddz-panel-solid); box-shadow: 0 24px 70px rgba(0,0,0,.5);
  padding: 20px;
}
.ddz-modal h2 { margin: 0 0 4px; font-size: 18px; }
.ddz-modal .lead { color: var(--ddz-dim); font-size: 12px; margin-bottom: 16px; }
.ddz-result-big { font-size: 30px; font-weight: 700; margin: 6px 0 2px; }
.ddz-result-big.win { color: var(--ddz-good); }
.ddz-result-big.lose { color: var(--ddz-bad); }
.ddz-kv { display: grid; grid-template-columns: 1fr auto; gap: 6px 16px; font-size: 12.5px; margin: 14px 0; }
.ddz-kv .k { color: var(--ddz-dim); }
.ddz-kv .v { text-align: right; font-variant-numeric: tabular-nums; }
.ddz-delta { display: flex; gap: 8px; margin: 12px 0 4px; }
.ddz-delta div { flex: 1; border: 1px solid var(--ddz-line); border-radius: 9px; padding: 7px 9px; font-size: 12px; display: flex; justify-content: space-between; }
.ddz-delta b { font-variant-numeric: tabular-nums; }
.ddz-delta .up { color: var(--ddz-good); }
.ddz-delta .down { color: var(--ddz-bad); }
.ddz-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; flex-wrap: wrap; }
.ddz-help p { margin: 0 0 8px; color: var(--ddz-text); font-size: 12.5px; }
.ddz-help ul { margin: 0 0 10px; padding-left: 18px; color: var(--ddz-dim); font-size: 12px; }
.ddz-help li { margin-bottom: 5px; }
.ddz-tierlist { display: grid; gap: 5px; margin-top: 6px; }
.ddz-tierlist div { display: flex; justify-content: space-between; font-size: 12px; border-bottom: 1px dashed var(--ddz-line); padding-bottom: 4px; }
.ddz-tierlist span:last-child { color: var(--ddz-dim); }

/* 复盘 */
.ddz-replay-seat { display: flex; justify-content: space-between; font-size: 12px; padding: 6px 0; border-bottom: 1px dashed var(--ddz-line); }
.ddz-replay-line { font-size: 12px; color: var(--ddz-dim); padding: 3px 0; }
.ddz-replay-line b { color: var(--ddz-text); font-weight: 550; }
.ddz-toast {
  position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%);
  padding: 7px 14px; border-radius: 9px; font-size: 12px; z-index: 60;
  background: rgba(20,24,32,.92); border: 1px solid var(--ddz-line-strong); color: var(--ddz-text);
  animation: ddz-fade .18s ease;
}
@keyframes ddz-fade { from { opacity: 0; transform: translate(-50%, 6px); } }
.ddz-deal-anim { animation: ddz-deal .45s ease both; }
@keyframes ddz-deal { from { opacity: 0; transform: translateY(18px) scale(.92); } }

/* 飞牌 */
.ddz-fly { position: absolute; z-index: 30; pointer-events: none; transition: transform .26s ease, opacity .26s ease; }

/* More 菜单里那一行 */
.ddz-more-row {
  display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 7px 10px; border: 0; border-radius: 8px; background: transparent;
  color: inherit; font: inherit; font-size: 13px; cursor: pointer; text-align: left;
}
.ddz-more-row:hover { background: rgba(127, 160, 220, .14); }
.ddz-more-row svg { flex: 0 0 16px; }

@media (max-width: 900px) {
  .ddz-bottom { grid-template-columns: 1fr; align-items: stretch; }
  .ddz-counter { order: 2; }
  .ddz-hand { min-height: 70px; }
  .ddz-card { width: 40px; height: 58px; flex-basis: 40px; margin-left: -16px; }
  .ddz-seatrow { padding: 8px 10px; }
  .ddz-seat { min-width: 0; padding: 7px 9px; }
  .ddz-seat .sub2 { display: none; }
  .ddz-setup { padding: 18px 14px 30px; }
  .ddz-tiers { grid-template-columns: 1fr; }
}
`

    /* ================= 4. 界面 ================= */
/* 斗地主 · Web 页面（React，无 JSX） */
const PANEL_ID = 'doudizhu'
const TIERS = DDZ.TIERS
const RANK_TEXT = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '小王', '大王']
const SUITS = ['♠', '♥', '♣', '♦']
const RED_SUITS = { '♥': 1, '♦': 1 }
const SEAT_NAME_KEY = ['you', 'downTier', 'upTier']

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
  out.sort((a, b) => a.rank - b.rank || (a.suit < b.suit ? -1 : 1))
  return out
}

function cardsKey(cards) { return cards.slice().sort((a, b) => a - b).join(',') }

function fmt(tpl, vars) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : m))
}

function tierLabel(tier, T) { return (T.tierNames && T.tierNames[tier]) || tier }

/* ---------------- 牌 ---------------- */

function Card(props) {
  const { card, selected, small, static: isStatic, back, onClick, onPointerDown, onPointerEnter } = props
  const cls = ['ddz-card']
  if (card && card.red) cls.push('is-red')
  if (card && card.rank >= 16) cls.push('joker')
  if (selected) cls.push('is-sel')
  if (small) cls.push('small')
  if (isStatic) cls.push('static')
  if (back) cls.push('back')
  return h('div', {
    className: cls.join(' '),
    onPointerDown: onPointerDown,
    onPointerEnter: onPointerEnter,
    onClick: onClick,
    role: onPointerDown ? 'button' : undefined,
    tabIndex: onPointerDown ? 0 : undefined,
  }, card ? [
    h('span', { className: 'r', key: 'r' }, card.label),
    h('span', { className: 's', key: 's' }, card.suit === '★' ? '★' : card.suit),
  ] : null)
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
    e.preventDefault()
    const add = !selected[card.id]
    drag.current = { add }
    onSelect(card.id, add)
  }
  const enter = (card) => () => {
    if (disabled || !drag.current) return
    onSelect(card.id, drag.current.add)
  }
  if (!cards.length) {
    return h('div', { className: 'ddz-hand' }, h('span', { className: 'kbi' }, T.noCards))
  }
  return h('div', { className: 'ddz-hand' },
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
  const { st, seat, T, remain, lang, isTurn } = props
  const name = seat === 0 ? T.you : (seat === 1 ? T.downTier : T.upTier)
  const isLandlord = st.landlord === seat
  const left = G.seatCounts(st)[seat]
  const ringR = 11
  const circ = 2 * Math.PI * ringR
  const pct = Math.max(0, Math.min(1, remain / 30))
  const bid = st.bidLog.filter(b => b.seat === seat).slice(-1)[0]
  const bidText = bid ? (bid.value === 0 ? '—' : (typeof bid.value === 'number' ? bid.value + '分' : (bid.value === 'call' ? T.call : T.rob))) : ''
  const dbl = st.doubling[seat]
  return h('div', { className: 'ddz-seat' + (isLandlord ? ' is-landlord' : '') + (isTurn ? ' is-turn' : '') + (seat === 0 ? ' is-me' : '') },
    h('div', { className: 'ddz-avatar' + (isLandlord ? ' landlord' : '') },
      isLandlord ? h('span', { className: 'crown' }, '♛') : null,
      name.slice(0, 1)),
    h('div', { className: 'meta' },
      h('div', { className: 'name' }, name, isLandlord ? h('span', { className: 'tag landlord-tag' }, ' ' + T.landlordTag) : null),
      h('div', { className: 'sub2' },
        fmt(T.lands, { n: left }),
        bidText ? ' · ' + bidText : '',
        dbl > 1 ? h('em', null, ' · ×' + dbl) : null)),
    isTurn ? h('div', { className: 'ddz-ring' },
      h('svg', { viewBox: '0 0 26 26' },
        h('circle', { className: 'bg', cx: 13, cy: 13, r: ringR }),
        h('circle', {
          className: 'fg', cx: 13, cy: 13, r: ringR,
          strokeDasharray: circ, strokeDashoffset: circ * (1 - pct),
        })),
      h('span', null, Math.ceil(remain))) : null)
}

/* ---------------- 记牌器 ---------------- */

function Counter(props) {
  const { st, T, open, onToggle } = props
  const mine = myHandCounts(st)
  const rows = []
  for (let i = 0; i < 15; i++) {
    const rank = i + 3
    const totalCards = rank >= 16 ? 1 : 4
    const rest = totalCards - (mine[i] || 0) - (st.played[i] || 0)
    rows.push({ rank, label: RANK_TEXT[i], rest, hot: rank >= 16 && rest > 0 })
  }
  if (!open) return null
  return h('div', { className: 'ddz-counterbar' },
    rows.map(r => h('div', {
      key: r.rank,
      className: 'ddz-count' + (r.hot ? ' is-hot' : '') + (r.rest <= 0 ? ' is-zero' : ''),
      title: r.label,
    }, h('span', null, r.label), h('b', null, r.rest))))
}

/* ---------------- 结算 ---------------- */

function Result(props) {
  const { st, T, onAgain, onReTier, onReplay, onClose } = props
  const r = st.result
  const iWin = (st.winners === 'landlord') === (st.landlord === 0)
  const d = r.delta
  return h('div', { className: 'ddz-overlay' },
    h('div', { className: 'ddz-modal' },
      h('h2', null, st.winners === 'landlord' ? T.winLandlord : T.winFarmer),
      h('div', { className: 'ddz-result-big ' + (iWin ? 'win' : 'lose') }, fmt(T.scoreLine, { n: (d[0] > 0 ? '+' : '') + d[0] })),
      h('div', { className: 'ddz-delta' },
        [0, 1, 2].map(s => h('div', { key: s },
          h('span', null, s === 0 ? T.you : (s === 1 ? T.downTier : T.upTier)),
          h('b', { className: d[s] > 0 ? 'up' : 'down' }, (d[s] > 0 ? '+' : '') + d[s])))),
      h('div', { className: 'ddz-kv' },
        h('span', { className: 'k' }, T.multiplier.replace('{n}', '')),
        h('span', { className: 'v' }, '×' + r.multiplier),
        r.spring ? h('span', { className: 'k' }, T.spring) : null,
        r.spring ? h('span', { className: 'v' }, '×2') : null,
        r.antiSpring ? h('span', { className: 'k' }, T.antiSpring) : null,
        r.antiSpring ? h('span', { className: 'v' }, '×2') : null,
        h('span', { className: 'k' }, T.bombs.replace('{n}', r.bombs).replace(/ \d+ 个| \d+ bomb.*/, '')),
        h('span', { className: 'v' }, r.bombs),
        h('span', { className: 'k' }, T.timeUsed.replace('{n}', '')),
        h('span', { className: 'v' }, fmt(T.timeUsed, { n: r.seconds }))),
      h('div', { className: 'ddz-modal-actions' },
        h('button', { className: 'ddz-btn ghost', onClick: onClose }, T.close),
        h('button', { className: 'ddz-btn ghost', onClick: onReplay }, T.replay),
        h('button', { className: 'ddz-btn ghost', onClick: onReTier }, T.reTier),
        h('button', { className: 'ddz-btn primary', onClick: onAgain }, T.again))))
}

/* ---------------- 复盘 ---------------- */

function Replay(props) {
  const { st, T, onClose } = props
  const [idx, setIdx] = useState(0)
  const lines = []
  const ev = st.replay || []
  function who(seat) { return seat === 0 ? T.you : (seat === 1 ? T.downTier : T.upTier) }
  ev.forEach((e, i) => {
    if (e.type === 'deal') lines.push({ i, text: T.mode + ': ' + (e.mode === 'rob' ? T.modeRob : T.modeScore) })
    else if (e.type === 'bid') lines.push({ i, text: who(e.seat) + ' · ' + (e.value === 0 ? T.pass : (typeof e.value === 'number' ? e.value + '分' : (e.value === 'call' ? T.call : T.rob))) })
    else if (e.type === 'double') lines.push({ i, text: who(e.seat) + ' · ' + (e.value === 1 ? T.doubleNone : e.value === 2 ? T.doubleX2 : T.doubleX4) })
    else if (e.type === 'open') lines.push({ i, text: who(e.seat) + ' · ' + T.open })
    else if (e.type === 'play') lines.push({ i, text: who(e.seat) + ' · ' + DDZ.cardsText(e.cards) })
    else if (e.type === 'pass') lines.push({ i, text: who(e.seat) + ' · ' + T.passAction })
  })
  const step = Math.min(idx, lines.length - 1)
  return h('div', { className: 'ddz-overlay' },
    h('div', { className: 'ddz-modal' },
      h('h2', null, T.replayTitle),
      h('div', { className: 'lead' }, fmt(T.stepInfo, { i: step + 1, n: lines.length })),
      h('div', { style: { maxHeight: 320, overflow: 'auto', marginBottom: 12 } },
        lines.map((l, i) => h('div', {
          key: l.i,
          className: 'ddz-replay-line',
          style: i === step ? { color: 'var(--ddz-accent)', fontWeight: 600 } : null,
        }, l.text))),
      h('div', { className: 'ddz-modal-actions' },
        h('button', { className: 'ddz-btn', onClick: () => setIdx(Math.max(0, step - 1)), disabled: step <= 0 }, T.stepPrev),
        h('button', { className: 'ddz-btn', onClick: () => setIdx(Math.min(lines.length - 1, step + 1)), disabled: step >= lines.length - 1 }, T.stepNext),
        h('button', { className: 'ddz-btn primary', onClick: onClose }, T.close))))
}

/* ---------------- 帮助 ---------------- */

function Help(props) {
  const { T, onClose } = props
  return h('div', { className: 'ddz-overlay' },
    h('div', { className: 'ddz-modal ddz-help' },
      h('h2', null, T.rulesTitle),
      h('div', { className: 'lead' }, T.tierHint),
      h('ul', null, T.rulesBody.map((s, i) => h('li', { key: i }, s))),
      h('div', { className: 'ddz-tierlist' },
        TIERS.map(t => h('div', { key: t },
          h('span', null, T.tierNames[t] || t),
          h('span', null, t === 'free' ? '≤5ms' : t === 'go' ? '≤5ms' : t === 'plus' ? '≈25ms' : t === 'pro100' ? '≈150ms' : t === 'pro200' ? '≈300ms' : t === 'pro500' ? '≈800ms' : '≤4s')))),
      h('div', { className: 'ddz-modal-actions' },
        h('button', { className: 'ddz-btn primary', onClick: onClose }, T.close))))
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
      if (raw) { const v = JSON.parse(raw); if (Array.isArray(v) && v.length === 3) return v }
    } catch { /* ignore */ }
    return ['go', 'go', 'go']
  })
  const [auto, setAuto] = useState(false)
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('ddz-sound') !== '0' } catch { return true } })
  const [counterOpen, setCounterOpen] = useState(true)
  const [sel, setSel] = useState({})            // id -> true
  const [hintIdx, setHintIdx] = useState(0)
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(null)      // 'help' | 'result' | 'replay' | 'surrender'
  const [advice, setAdvice] = useState(null)
  const [thinking, setThinking] = useState('')
  const [remain, setRemain] = useState(30)
  const [stats, setStats] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem('ddz-stats') || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
  })
  const turnStart = useRef(Date.now())
  const toastTimer = useRef(null)
  const adviceKeyRef = useRef('')
  const adviceTimerRef = useRef(null)
  const st = stRef.current

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
    G.applyOpen(s, 0)
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
    const { moves, canPass } = G.hintList(s, 0)
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
    setSel(next)
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
    saveStats({ ...stats, [key]: { games: prev.games + 1, wins: prev.wins + (iWin ? 1 : 0) }, byTier })
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
    if (who === null) return
    const isAuto = who !== 0 || auto
    if (!isAuto) return
    const tier = (s.tiers && s.tiers[who]) || 'go'
    const delay = kind === 'bid' ? 700 : kind === 'double' ? 800 : (tier === 'free' ? 450 : tier === 'go' ? 550 : 700)
    const timer = setTimeout(() => {
      const g = stRef.current
      if (!g) return
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
          setThinking('')
          if (r.move) {
            const mv = DDZ.classify(r.move.cards)
            if (mv && (mv.type === 'bomb' || mv.type === 'rocket')) beep('bomb'); else beep('play')
            G.applyPlay(g, seat, r.move.cards)
          } else {
            G.applyPass(g, seat)
          }
          if (g.phase === 'over') {
            const iWin = (g.winners === 'landlord') === (g.landlord === 0)
            beep(iWin ? 'win' : 'lose')
            if (iWin || !iWin) maybeFinish(g)
          }
        }
      } catch (e) {
        console.warn('[doudizhu] AI 行动失败', e)
      }
      turnStart.current = Date.now()
      setRemain(30)
      setAdvice(null)
      touch()
    }, delay)
    return () => clearTimeout(timer)
  })

  /* 重新发牌：等用户点一下 */
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

  /* 轮到我时自动给建议（用我的档位；托管中不算，避免和 AI 推进互相打架） */
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
  const setupView = () => h('div', { className: 'ddz-root' },
    topbar(),
    h('div', { className: 'ddz-scroll' },
      h('div', { className: 'ddz-setup' },
        h('h1', null, T.appName),
        h('div', { className: 'sub' }, T.tagline),
        h('div', { className: 'ddz-field' },
          h('label', null, T.mode),
          h('div', { className: 'ddz-modecard' },
            h('button', { className: mode === 'score' ? 'is-on' : '', onClick: () => setMode('score') },
              h('b', null, T.modeScore), h('span', null, T.modeDescScore)),
            h('button', { className: mode === 'rob' ? 'is-on' : '', onClick: () => setMode('rob') },
              h('b', null, T.modeRob), h('span', null, T.modeDescRob)))),
        h('div', { className: 'ddz-field' },
          h('label', null, T.myTier + ' / ' + T.downTier + ' / ' + T.upTier),
          h('div', { className: 'ddz-tiers' },
            [0, 1, 2].map(seat => h('div', { className: 'ddz-tiercard', key: seat },
              h('b', null, seat === 0 ? T.myTier : seat === 1 ? T.downTier : T.upTier),
              h('select', {
                value: tiers[seat],
                onChange: e => {
                  const next = tiers.slice()
                  next[seat] = e.target.value
                  setTiers(next)
                },
              }, TIERS.map(t => h('option', { key: t, value: t }, T.tierNames[t] || t))))))),
        h('div', { className: 'ddz-setup-actions' },
          h('button', { className: 'ddz-btn primary', onClick: () => startGame() }, T.start),
          h('button', { className: 'ddz-btn ghost', onClick: () => setModal('help') }, T.help)),
        h('div', { className: 'ddz-statsline' },
          fmt(T.playedGames, { n: (stats.total && stats.total.games) || 0 }) + ' · ' +
          fmt(T.winRate, { n: stats.total && stats.total.games ? Math.round(stats.total.wins / stats.total.games * 100) : 0 }))),
      ),
    toastEl(),
    modal === 'help' ? h(Help, { T, onClose: () => setModal(null) }) : null)

  const table = () => {
    if (!st) return null
    const counts = G.seatCounts(st)
    const handCards = cardsFromCounts(st.hands[0])
    const myTurn = st.phase === 'play' && st.turn === 0
    const lastCards = st.last ? cardsFromCounts(DDZ.countsOf(st.last.move.cards)) : null
    const bidders = st.phase === 'bid' ? G.bidSeat(st) : -1
    const openAll = st.open[0] || st.open[1] || st.open[2]
    return h('div', { className: 'ddz-root' },
      topbar(),
      counterOpen ? counterBar() : null,
      h('div', { className: 'ddz-table' },
        h('div', { className: 'ddz-seatrow' },
          h(Seat, { st, seat: 2, T, lang, remain, isTurn: st.phase === 'play' && st.turn === 2 || bidders === 2 }),
          h('div', { className: 'ddz-mid-pill' },
            st.phase === 'bid' ? h('div', { className: 'ddz-turnpill' }, fmt(T.bidTurn, { who: bidders === 0 ? T.you : bidders === 1 ? T.downTier : T.upTier }))
              : st.phase === 'double' ? h('div', { className: 'ddz-turnpill' }, T.doubleTurn)
                : st.landlord >= 0 ? h('div', { className: 'ddz-turnpill' }, fmt(T.landlordIs, { who: st.landlord === 0 ? T.you : st.landlord === 1 ? T.downTier : T.upTier }))
                  : null),
          h(Seat, { st, seat: 1, T, lang, remain, isTurn: st.phase === 'play' && st.turn === 1 || bidders === 1 })),
        h('div', { className: 'ddz-mid' },
          h('div', { className: 'ddz-mid-inner' },
            h('div', { className: 'ddz-lastlabel' }, st.last ? T.lastPlay : T.noPlay),
            h('div', { className: 'ddz-played' },
              lastCards ? lastCards.map(c => h(Card, { key: c.id, card: c, small: true, static: true })) : null),
            thinking ? h('div', { className: 'ddz-think' }, h('span', { className: 'ddz-spin' }), thinking) : null)),
        st.phase === 'bid' ? bidPanel() : null,
        st.phase === 'double' ? doublePanel() : null,
        h('div', { className: 'ddz-bottom' },
          h('div', { className: 'ddz-meseat' }, h(Seat, { st, seat: 0, T, lang, remain, isTurn: (st.phase === 'play' && st.turn === 0) || bidders === 0 })),
          h('div', { className: 'ddz-handwrap' },
            h(Hand, { cards: handCards, selected: sel, onSelect: (id, on) => setSel(prev => { const n = { ...prev }; if (on) n[id] = true; else delete n[id]; return n }), disabled: !myTurn || auto, T }),
            h('div', { className: 'ddz-handinfo' },
              myTurn ? (auto ? T.autoOn : T.yourTurn) : (st.phase === 'play' ? fmt(T.thinking, { tier: tierLabel(tiers[st.turn] || 'go', T) }) : ''),
              ' · ' + fmt(T.selectToast, { n: Object.keys(sel).length }))),
          h('div', { className: 'ddz-actions' },
            h('div', { className: 'ddz-actions-row' },
              h('button', { className: 'ddz-btn ghost', onClick: () => { setSel({}); } }, T.cancel),
              h('button', { className: 'ddz-btn ghost', onClick: userPass, disabled: !myTurn || auto || !(st.last && st.last.seat !== 0) }, T.passAction),
              h('button', { className: 'ddz-btn primary', onClick: userPlay, disabled: !myTurn || auto }, T.playAction)),
            h('div', { className: 'ddz-actions-row' },
              h('button', { className: 'ddz-btn', onClick: userHint, disabled: !myTurn || auto }, T.hint),
              h('button', { className: 'ddz-btn', onClick: askAdvice, disabled: !myTurn || auto }, T.advice),
              h('button', { className: 'ddz-btn', onClick: () => { setAuto(v => !v); toastMsg(!auto ? T.autoOn : T.auto) }, }, auto ? T.autoOn : T.auto),
              h('button', { className: 'ddz-btn danger', onClick: () => setModal('surrender'), disabled: st.phase !== 'play' }, T.surrender)),
            adviceCard()),
          h('div', null))),
      toastEl(),
      modal === 'result' && st.result ? h(Result, {
        st, T,
        onAgain: () => startGame(),
        onReTier: () => { setView('setup'); setModal(null); stRef.current = null },
        onReplay: () => setModal('replay'),
        onClose: () => setModal(null),
      }) : null,
      modal === 'replay' ? h(Replay, { st, T, onClose: () => setModal(null) }) : null,
      modal === 'surrender' ? h('div', { className: 'ddz-overlay' },
        h('div', { className: 'ddz-modal' },
          h('h2', null, T.surrender),
          h('div', { className: 'lead' }, T.surrenderAsk),
          h('div', { className: 'ddz-modal-actions' },
            h('button', { className: 'ddz-btn ghost', onClick: () => setModal(null) }, T.cancel),
            h('button', { className: 'ddz-btn danger', onClick: () => { setModal(null); userSurrender() } }, T.confirm)))) : null,
      modal === 'help' ? h(Help, { T, onClose: () => setModal(null) }) : null)
  }

  function topbar() {
    return h('div', { className: 'ddz-topbar' },
      h('div', { className: 'ddz-title' }, T.appName,
        h('small', null, st ? (st.phase === 'over' ? '' : (st.mode === 'rob' ? T.modeRob : T.modeScore) + ' · ' + tierLabel(tiers[0], T)) : T.tagline)),
      h('div', { className: 'ddz-spacer' }),
      view === 'table' ? h('button', { className: 'ddz-chipbtn', onClick: () => setCounterOpen(v => !v) }, '🂠 ' + T.counter) : null,
      view === 'table' ? h('button', { className: 'ddz-chipbtn' + (auto ? ' is-on' : ''), onClick: () => setAuto(v => !v) }, T.auto) : null,
      h('button', { className: 'ddz-chipbtn' + (sound ? ' is-on' : ''), onClick: () => { setSound(v => { try { localStorage.setItem('ddz-sound', v ? '0' : '1') } catch { /* ignore */ } ; return !v }) } }, '♪'),
      h('button', { className: 'ddz-chipbtn', onClick: () => { const next = lang === 'zh' ? 'en' : 'zh'; setLang(next); try { localStorage.setItem('ddz-lang', next) } catch { /* ignore */ } } }, T.lang),
      h('button', { className: 'ddz-chipbtn', onClick: () => setModal('help') }, '?'),
      view === 'table' ? h('button', { className: 'ddz-chipbtn', onClick: () => { setView('setup'); stRef.current = null } }, T.back) : null)
  }

  function counterBar() {
    return h('div', { className: 'ddz-counterbar' },
      h('span', { className: 'ct' }, T.counter),
      st ? (function () {
        const mine = st.hands[0]
        const out = []
        for (let i = 0; i < 15; i++) {
          const rank = i + 3
          const totalCards = rank >= 16 ? 1 : 4
          const rest = totalCards - (mine[i] || 0) - (st.played[i] || 0)
          out.push(h('div', {
            key: rank,
            className: 'ddz-count' + (rest <= 0 ? ' is-zero' : '') + (rank >= 16 && rest > 0 ? ' is-hot' : ''),
          }, h('span', null, RANK_TEXT[i]), h('b', null, rest)))
        }
        return out
      })() : null)
  }

  function bidText(v) {
    if (v === 0) return T.pass
    if (st.mode === 'rob') return v === 'call' ? T.call : v === 'rob' ? T.rob : String(v)
    return v + '分'
  }

  function bidPanel() {
    const seat = st.phase === 'bid' ? G.bidSeat(st) : -1
    const opts = seat === 0 ? G.bidOptions(st) : []
    const actions = seat === 0
      ? h('div', { className: 'ddz-modal-actions' },
        opts.map(v => h('button',
          {
            key: String(v),
            className: 'ddz-btn ' + (v === 0 ? 'ghost' : 'primary'),
            onClick: () => userBid(v),
          },
          bidText(v),
        )),
      )
      : h('div', { className: 'ddz-think' }, h('span', { className: 'ddz-spin' }), '…')
    return h('div', { className: 'ddz-overlay' },
      h('div', { className: 'ddz-modal' },
        h('h2', null, fmt(T.bidTurn, { who: seat === 0 ? T.you : seat === 1 ? T.downTier : T.upTier })),
        h('div', { className: 'lead' }, st.mode === 'rob' ? T.modeDescRob : T.modeDescScore),
        actions,
      ),
    )
  }

  function doublePanel() {
    const done = st.doubleChosen
    return h('div', { className: 'ddz-overlay' },
      h('div', { className: 'ddz-modal' },
        h('h2', null, T.doubleTurn),
        h('div', { className: 'lead' }, fmt(T.landlordIs, { who: st.landlord === 0 ? T.you : st.landlord === 1 ? T.downTier : T.upTier })),
        h('div', { className: 'ddz-delta' },
          [0, 1, 2].map(s => h('div', { key: s },
            h('span', null, s === 0 ? T.you : (s === 1 ? T.downTier : T.upTier)),
            h('b', null, done[s] ? (st.doubling[s] === 1 ? T.doubleNone : st.doubling[s] === 2 ? T.doubleX2 : T.doubleX4) : '…')))),
        done[0] ? null : h('div', { className: 'ddz-modal-actions' },
          h('button', { className: 'ddz-btn ghost', onClick: () => userDouble(1) }, T.doubleNone),
          h('button', { className: 'ddz-btn', onClick: () => userDouble(2) }, T.doubleX2),
          h('button', { className: 'ddz-btn primary', onClick: () => userDouble(4) }, T.doubleX4)),
        h('div', { className: 'ddz-modal-actions' },
          st.open[0] ? null : h('button', { className: 'ddz-btn ghost', onClick: userOpen }, T.open))))
  }

  function adviceCard() {
    return h('div', { className: 'ddz-advice' },
      h('div', { className: 'hd' }, T.adviceTitle,
        advice && typeof advice.win === 'number' ? h('span', { className: 'win' }, fmt(T.adviceWin, { n: Math.round(advice.win) })) : null),
      advice
        ? [h('div', { className: 'mv', key: 'm' }, advice.move ? DDZ.cardsText(advice.move.cards) : T.passAction),
          advice.reason ? h('div', { className: 'rs', key: 'r' }, advice.reason) : null]
        : h('div', { className: 'rs' }, T.advisorEmpty))
  }

  function toastEl() {
    return toast ? h('div', { className: 'ddz-toast' }, toast) : null
  }

  return view === 'table' ? table() : setupView()
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