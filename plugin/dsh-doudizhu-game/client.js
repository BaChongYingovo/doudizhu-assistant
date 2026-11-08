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
    bottomCards: '底牌',
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
    bottomCards: 'Bottom',
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

/* 斗地主插件样式：大肥鱼浅色软萌（奶油蓝牌桌）。固定浅色，不跟系统深色翻转。 */
const CSS = String.raw`
.ddz-root {
  --ddz-bg: #F5F8FC;
  --ddz-panel: rgba(255, 255, 255, 0.82);
  --ddz-panel-solid: #FFFFFF;
  --ddz-line: rgba(30, 79, 156, 0.10);
  --ddz-line-strong: rgba(30, 79, 156, 0.18);
  --ddz-text: #1B2A44;
  --ddz-dim: #6B7C99;
  --ddz-accent: #4BA3E3;
  --ddz-accent-weak: rgba(75, 163, 227, 0.14);
  --ddz-good: #3DBF8F;
  --ddz-bad: #F07178;
  --ddz-gold: #D4A84B;
  --ddz-felt: radial-gradient(120% 90% at 50% 0%, #EAF4FC 0%, #F7FBFE 48%, #EEF6FB 100%);
  --ddz-card-bg: linear-gradient(180deg, #FFFFFF 0%, #F3F7FC 100%);
  --ddz-card-ink: #1B2A44;
  --ddz-red: #E25563;
  color-scheme: light;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--ddz-text);
  background-color: var(--ddz-bg);
  background-image:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.12 0 0 0 0 0.36 0 0 0 0 0.62 0 0 0 0.2 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"),
    repeating-linear-gradient(0deg, rgba(255,255,255,.28) 0 1px, transparent 1px 4px),
    repeating-linear-gradient(90deg, rgba(75,163,227,.06) 0 1px, transparent 1px 5px),
    var(--ddz-felt);
  background-size: 128px 128px, auto, auto, auto;
  font: 13px/1.45 "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.ddz-root * { box-sizing: border-box; }
.ddz-scroll { overflow: auto; min-height: 0; position: relative; z-index: 1; }
.ddz-decor { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.ddz-watermark {
  position: absolute; left: 50%; top: 46%;
  width: min(300px, 46%); height: min(300px, 46%);
  transform: translate(-50%, -46%);
  border-radius: 50%; object-fit: cover; opacity: .14;
}
.ddz-stamp {
  position: absolute; width: 58px; height: 58px; border-radius: 50%;
  object-fit: cover; opacity: .28;
  box-shadow: 0 0 0 4px rgba(255,255,255,.35);
}
.ddz-stamp.s1 { left: 12px; bottom: 18px; transform: rotate(-8deg); }
.ddz-stamp.s2 { right: 16px; top: 58px; width: 46px; height: 46px; transform: rotate(10deg); }
.ddz-bubble {
  position: absolute; border-radius: 50%;
  background: radial-gradient(circle at 32% 30%, #fff 0 18%, rgba(126,200,232,.72) 42%, rgba(75,163,227,.08) 68%, transparent 70%);
}
.ddz-bubble.d1 { width: 84px; height: 84px; left: -18px; top: 72px; }
.ddz-bubble.d2 { width: 42px; height: 42px; left: 46px; top: 54px; opacity: .85; }
.ddz-bubble.d3 { width: 96px; height: 96px; right: -24px; bottom: 36px; }
.ddz-bubble.d4 { width: 34px; height: 34px; right: 72px; bottom: 22px; opacity: .9; }
.ddz-whale {
  position: absolute; font-size: 22px; line-height: 1; opacity: .62;
  filter: drop-shadow(0 1px 0 #fff);
}
.ddz-whale.w1 { left: 78px; bottom: 26px; transform: rotate(-14deg); }
.ddz-whale.w2 { right: 22px; top: 112px; font-size: 18px; transform: rotate(12deg); }
.ddz-topbar, .ddz-counterbar, .ddz-table { position: relative; z-index: 1; }

/* ---------- 顶栏 ---------- */
.ddz-topbar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--ddz-line);
  background: linear-gradient(180deg, rgba(255,255,255,.78), rgba(255,255,255,.42));
  backdrop-filter: blur(10px);
}
.ddz-brand {
  width: 28px; height: 28px; border-radius: 50%; flex: 0 0 28px;
  object-fit: cover; background: #fff;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1.5px #7EC8E8, 0 3px 8px rgba(30, 79, 156, .16);
}
.ddz-title { font-size: 14px; font-weight: 700; letter-spacing: .3px; color: #1E4F9C; }
.ddz-title small { color: var(--ddz-dim); font-weight: 450; margin-left: 8px; }
.ddz-topbar .ddz-spacer { flex: 1; }
.ddz-chipbtn {
  height: 28px; padding: 0 11px; border-radius: 999px;
  border: 1px solid var(--ddz-line); background: rgba(255,255,255,.88);
  color: var(--ddz-text); font-size: 12px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  box-shadow: 0 1px 2px rgba(30, 79, 156, .05);
  transition: border-color .15s ease, background .15s ease, transform .06s ease;
}
.ddz-chipbtn:hover { border-color: var(--ddz-accent); }
.ddz-chipbtn:active { transform: translateY(1px); }
.ddz-chipbtn.is-on { background: var(--ddz-accent-weak); border-color: var(--ddz-accent); color: #1E4F9C; font-weight: 650; }

/* ---------- 按钮 / 分段 ---------- */
.ddz-btn {
  height: 40px; padding: 0 16px; border-radius: 12px; cursor: pointer;
  border: 1px solid var(--ddz-line-strong); background: rgba(255,255,255,.9);
  color: var(--ddz-text); font-size: 13px; font-weight: 600;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 1px 2px rgba(30, 79, 156, .05);
  transition: transform .06s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease;
}
.ddz-btn:hover { border-color: var(--ddz-accent); }
.ddz-btn:active { transform: translateY(1px); }
.ddz-btn.primary {
  height: 44px; font-size: 15px;
  background: linear-gradient(180deg, #8FD0F2 0%, #4BA3E3 46%, #1E4F9C 100%);
  border-color: #1E4F9C; color: #fff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 6px 14px rgba(30, 79, 156, .22);
}
.ddz-actions .ddz-btn.primary { height: 48px; min-width: 108px; font-size: 17px; letter-spacing: .6px; padding: 0 22px; }
.ddz-btn.primary:hover { background: linear-gradient(180deg, #a6dcf6 0%, #5eb0ea 46%, #255cae 100%); }
.ddz-btn.ghost { background: transparent; box-shadow: none; }
.ddz-btn.danger {
  color: var(--ddz-bad); background: transparent; box-shadow: none;
  border-color: rgba(240, 113, 120, .55);
}
.ddz-btn.danger:hover { background: rgba(240, 113, 120, .08); border-color: var(--ddz-bad); }
.ddz-btn[disabled] { opacity: .45; cursor: default; box-shadow: none; }
.ddz-seg { display: inline-flex; padding: 2px; gap: 2px; border-radius: 12px; border: 1px solid var(--ddz-line); background: rgba(75, 163, 227, .08); }
.ddz-seg button {
  height: 28px; padding: 0 12px; border-radius: 9px; border: 0; background: transparent;
  color: var(--ddz-dim); font-size: 12px; cursor: pointer;
}
.ddz-seg button.is-on { background: #fff; color: #1E4F9C; font-weight: 700; box-shadow: 0 1px 3px rgba(30, 79, 156, .08); }

/* ---------- 开局页 ---------- */
.ddz-setup { max-width: 720px; margin: 0 auto; padding: 28px 22px 40px; width: 100%; }
.ddz-hero { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
.ddz-hero-avatar {
  width: 72px; height: 72px; border-radius: 50%; flex: 0 0 72px;
  object-fit: cover; background: #fff;
  border: 3px solid #fff;
  box-shadow: 0 0 0 2px #7EC8E8, 0 10px 22px rgba(75, 163, 227, .28);
}
.ddz-setup h1 { margin: 0 0 4px; font-size: 26px; letter-spacing: .4px; color: #1E4F9C; }
.ddz-setup .sub { color: var(--ddz-dim); margin: 0; }
.ddz-field { margin-bottom: 20px; }
.ddz-field > label { display: block; color: var(--ddz-dim); font-size: 12px; margin-bottom: 8px; letter-spacing: .2px; }
.ddz-tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.ddz-tiercard {
  padding: 12px; border: 1px solid var(--ddz-line); border-radius: 16px;
  background: var(--ddz-panel); box-shadow: 0 8px 20px rgba(30, 79, 156, .05);
}
.ddz-tiercard b { display: block; font-size: 12px; font-weight: 700; margin-bottom: 8px; color: #1E4F9C; }
.ddz-tiercard select {
  width: 100%; height: 32px; border-radius: 10px; border: 1px solid var(--ddz-line-strong);
  background: var(--ddz-panel-solid); color: var(--ddz-text); font-size: 12px; padding: 0 8px;
}
.ddz-modecard { display: flex; gap: 8px; }
.ddz-modecard button {
  flex: 1; text-align: left; padding: 12px; border-radius: 16px; cursor: pointer;
  border: 1px solid var(--ddz-line); background: var(--ddz-panel); color: var(--ddz-text);
  box-shadow: 0 8px 20px rgba(30, 79, 156, .04);
  transition: border-color .15s ease, background .15s ease, transform .06s ease;
}
.ddz-modecard button:hover { border-color: rgba(75, 163, 227, .45); }
.ddz-modecard button.is-on { border-color: var(--ddz-accent); background: var(--ddz-accent-weak); }
.ddz-modecard b { display: block; font-size: 13px; margin-bottom: 3px; color: #1E4F9C; }
.ddz-modecard span { color: var(--ddz-dim); font-size: 11.5px; }
.ddz-setup-actions { display: flex; align-items: center; gap: 12px; margin-top: 26px; }
.ddz-kbi { color: var(--ddz-dim); font-size: 11.5px; }
.ddz-statsline { color: var(--ddz-dim); font-size: 12px; margin-top: 18px; }

/* ---------- 牌桌 ---------- */
.ddz-table { position: relative; flex: 1; min-height: 0; display: grid; grid-template-rows: auto 1fr auto; }
.ddz-seatrow { display: flex; justify-content: space-between; align-items: stretch; gap: 8px; padding: 8px 12px 4px; }
.ddz-mid-pill { flex: 1; display: flex; justify-content: center; align-items: center; min-width: 0; }
.ddz-seat {
  min-width: 188px; padding: 10px 14px 10px 10px; border-radius: 18px;
  border: 1px solid var(--ddz-line); background: var(--ddz-panel); backdrop-filter: blur(8px);
  display: flex; align-items: center; gap: 10px;
  box-shadow: 0 8px 18px rgba(30, 79, 156, .05);
  transition: border-color .2s, box-shadow .2s;
}
.ddz-seat.seat-0 { border-color: rgba(75, 163, 227, .38); }
.ddz-seat.seat-1 { border-color: rgba(126, 200, 232, .95); }
.ddz-seat.seat-2 { border-color: rgba(30, 79, 156, .22); }
.ddz-seat.is-me { border-color: rgba(75, 163, 227, .55); }
.ddz-seat.is-landlord { border-color: rgba(212, 168, 75, .72); }
.ddz-seat.is-turn {
  border-color: var(--ddz-accent);
  box-shadow: 0 0 0 2px rgba(75, 163, 227, .22), 0 8px 20px rgba(75, 163, 227, .16);
  animation: ddz-breathe 1.8s ease-in-out infinite;
}
@keyframes ddz-breathe {
  0%, 100% { box-shadow: 0 0 0 2px rgba(75, 163, 227, .20), 0 8px 18px rgba(75, 163, 227, .12); }
  50% { box-shadow: 0 0 0 4px rgba(126, 200, 232, .45), 0 10px 24px rgba(75, 163, 227, .28); }
}
.ddz-avatar {
  width: 52px; height: 52px; border-radius: 50%; flex: 0 0 52px;
  background: #fff; position: relative;
  border: 2px solid #7EC8E8;
  box-shadow: 0 4px 10px rgba(30, 79, 156, .12);
}
.ddz-seat.seat-0 .ddz-avatar { width: 60px; height: 60px; flex-basis: 60px; border-color: #4BA3E3; }
.ddz-seat.seat-1 .ddz-avatar { border-color: #7EC8E8; }
.ddz-seat.seat-2 .ddz-avatar { border-color: #8AA4D4; }
.ddz-seat .ddz-avatar.landlord {
  border-color: var(--ddz-gold);
  box-shadow: 0 0 0 3px rgba(212, 168, 75, .28), 0 4px 10px rgba(212, 168, 75, .2);
}
.ddz-seat.is-turn .ddz-avatar { animation: ddz-avatar-breathe 1.8s ease-in-out infinite; }
@keyframes ddz-avatar-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.045); }
}
.ddz-avatar-img {
  width: 100%; height: 100%; border-radius: 50%;
  object-fit: cover; object-position: center center;
  display: block; pointer-events: none; background: #fff;
}
.ddz-avatar .crown {
  position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
  font-size: 18px; line-height: 1; color: var(--ddz-gold); z-index: 2; pointer-events: none;
  filter: drop-shadow(0 1px 0 #fff) drop-shadow(0 2px 2px rgba(166, 124, 45, .45));
}
.ddz-seat.is-me .ddz-avatar .crown { font-size: 22px; top: -16px; }
.ddz-seat .meta { min-width: 0; }
.ddz-seat .name { font-size: 14px; font-weight: 800; white-space: nowrap; color: #1B2A44; }
.ddz-seat .sub2 { font-size: 12px; color: var(--ddz-dim); white-space: nowrap; margin-top: 2px; }
.ddz-seat .sub2 em { font-style: normal; color: var(--ddz-accent); font-weight: 700; }
.landlord-tag {
  display: inline-flex; align-items: center; margin-left: 4px; padding: 0 6px; height: 16px;
  border-radius: 999px; background: linear-gradient(180deg, #F8E7B8, #F0D48A);
  color: #7A5A16; font-size: 10px; font-weight: 800; letter-spacing: .2px; vertical-align: 1px;
}
.ddz-ring { position: relative; width: 26px; height: 26px; flex: 0 0 26px; margin-left: auto; }
.ddz-ring span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 10.5px; color: var(--ddz-dim); font-weight: 700; }
.ddz-ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
.ddz-ring circle { fill: none; stroke-width: 2.4; }
.ddz-ring .bg { stroke: rgba(30, 79, 156, .12); }
.ddz-ring .fg { stroke: var(--ddz-accent); transition: stroke-dashoffset .5s linear; }

.ddz-mid {
  position: relative; display: flex; min-height: 0; margin: 4px 12px 0;
  border-radius: 22px;
  background:
    radial-gradient(circle at 50% 42%, rgba(255,255,255,.55), rgba(255,255,255,.18) 58%, rgba(126,200,232,.12));
  border: 1px solid rgba(126, 200, 232, .45);
  box-shadow: inset 0 0 0 5px rgba(255,255,255,.28), 0 8px 18px rgba(30, 79, 156, .04);
  overflow: hidden;
}
.ddz-mid .ddz-watermark { width: 240px; height: 240px; opacity: .16; }
.ddz-mid-inner {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  gap: 8px; width: 100%; height: 100%; min-height: 0; padding: 10px 12px 12px;
}
.ddz-infobar { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; width: 100%; }
.ddz-pill {
  display: inline-flex; align-items: center; height: 30px; padding: 0 12px;
  border-radius: 999px; background: rgba(255,255,255,.92);
  border: 1px solid rgba(75, 163, 227, .32);
  color: #1E4F9C; font-size: 12.5px; font-weight: 800;
  box-shadow: 0 3px 8px rgba(30, 79, 156, .06);
}
.ddz-pill.is-phase { background: linear-gradient(180deg, #5eb0ea, #1E4F9C); color: #fff; border-color: #1E4F9C; }
.ddz-pill.is-gold { background: linear-gradient(180deg, #fff8e4, #f3d48a); color: #7A5A16; border-color: rgba(212, 168, 75, .7); }
.ddz-pill.is-mult { background: linear-gradient(180deg, #e7f6ff, #fff); border-color: #4BA3E3; }
.ddz-kitty {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px 6px 12px; border-radius: 16px;
  background: rgba(255,255,255,.82); border: 1px solid rgba(212, 168, 75, .45);
  box-shadow: 0 4px 12px rgba(212, 168, 75, .08);
}
.ddz-kitty .ddz-lastlabel { color: #7A5A16; font-weight: 800; }
.ddz-kitty-cards { display: flex; align-items: flex-end; min-height: 52px; }
.ddz-lastlabel { color: var(--ddz-dim); font-size: 12px; letter-spacing: .4px; font-weight: 700; }
.ddz-played {
  display: flex; gap: 4px; flex: 1; width: min(100%, 760px); min-height: 96px;
  align-items: center; justify-content: center;
  padding: 8px 12px; border-radius: 18px;
  background: rgba(255,255,255,.62);
  border: 1px dashed rgba(75, 163, 227, .45);
  box-shadow: inset 0 0 18px rgba(126, 200, 232, .16);
}
.ddz-played.is-bomb { animation: ddz-bombflash .72s ease 1; }
@keyframes ddz-bombflash {
  0% { background: transparent; box-shadow: none; }
  30% { background: rgba(255, 236, 186, .78); box-shadow: 0 0 0 6px rgba(226, 85, 99, .22), 0 0 24px rgba(212, 168, 75, .62); }
  100% { background: transparent; box-shadow: none; }
}
.ddz-turnpill {
  padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 650;
  background: rgba(255,255,255,.82); border: 1px solid var(--ddz-line);
  box-shadow: 0 4px 12px rgba(30, 79, 156, .06);
  color: #1E4F9C;
}
.ddz-turnpill.is-you { color: var(--ddz-good); border-color: rgba(61, 191, 143, .4); }
.ddz-think {
  display: inline-flex; align-items: center; gap: 7px; color: var(--ddz-dim); font-size: 12px;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(255,255,255,.74); border: 1px solid var(--ddz-line);
}
.ddz-spin {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid rgba(126, 200, 232, .55); border-top-color: var(--ddz-accent);
  animation: ddz-spin .8s linear infinite;
}
@keyframes ddz-spin { to { transform: rotate(360deg); } }
.ddz-pass {
  padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 650;
  color: var(--ddz-dim); background: rgba(255,255,255,.86);
  border: 1px solid var(--ddz-line);
  animation: ddz-pass 1.15s ease forwards;
}
@keyframes ddz-pass {
  0% { opacity: 0; transform: translateY(8px); }
  16% { opacity: 1; transform: translateY(0); }
  68% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-4px); }
}

/* ---------- 底部：手牌区 ---------- */
.ddz-bottom { display: grid; grid-template-columns: minmax(196px, 228px) minmax(0, 1fr) minmax(210px, 268px); gap: 8px; padding: 8px 12px 10px; align-items: end; }
.ddz-meseat { display: flex; align-items: flex-end; min-width: 0; }
.ddz-meseat .ddz-seat { width: 100%; }
.ddz-counterbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  margin: 6px 12px 0; padding: 8px 10px;
  border: 1px solid var(--ddz-line); border-radius: 16px;
  background: rgba(255,255,255,.8);
  box-shadow: 0 6px 16px rgba(30, 79, 156, .05);
}
.ddz-counterbar .ct { font-size: 12px; color: #1E4F9C; font-weight: 800; margin-right: 2px; white-space: nowrap; }
.ddz-count {
  display: inline-flex; align-items: baseline; justify-content: center; gap: 4px;
  min-width: 46px; padding: 6px 8px; border-radius: 11px;
  background: #fff; border: 1px solid rgba(75, 163, 227, .2);
  font-size: 13px; font-weight: 800; line-height: 1.2; color: var(--ddz-text);
  box-shadow: inset 0 1px 0 #fff, 0 2px 4px rgba(30, 79, 156, .04);
}
.ddz-count b { font-size: 13px; color: #1E4F9C; font-weight: 800; }
.ddz-count.is-hot { background: rgba(240, 113, 120, .14); color: var(--ddz-bad); }
.ddz-count.is-hot b { color: var(--ddz-bad); }
.ddz-count.is-zero { opacity: .38; }

.ddz-handwrap { min-width: 0; }
.ddz-hand { display: flex; justify-content: center; align-items: flex-end; min-height: 96px; padding: 20px 4px 0; }
.ddz-card {
  position: relative; width: 48px; height: 70px; margin-left: -20px; flex: 0 0 48px;
  border-radius: 13px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.96) 0%, rgba(255,255,255,.35) 42%, rgba(180, 210, 235, .2) 100%),
    var(--ddz-card-bg);
  color: var(--ddz-card-ink);
  border: 1px solid rgba(30, 79, 156, .14);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.95),
    inset 0 -8px 12px rgba(126, 200, 232, .18),
    0 6px 10px rgba(30, 79, 156, .10),
    0 1px 2px rgba(30, 79, 156, .06);
  cursor: pointer; user-select: none; -webkit-user-select: none; touch-action: none;
  transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease;
  display: flex; flex-direction: column; justify-content: space-between; padding: 5px 6px;
}
.ddz-card:first-child { margin-left: 0; }
.ddz-card:hover { transform: translateY(-6px); }
.ddz-card.is-sel {
  transform: translateY(-16px);
  border-color: var(--ddz-accent);
  box-shadow:
    inset 0 1px 0 #fff,
    0 0 0 2px rgba(75, 163, 227, .9),
    0 14px 18px rgba(75, 163, 227, .28);
}
.ddz-card.is-sel:hover { transform: translateY(-18px); }
.ddz-card .r { font-size: 15px; font-weight: 800; line-height: 1; letter-spacing: -.4px; }
.ddz-card .s { font-size: 15px; line-height: 1; align-self: flex-end; }
.ddz-card.is-red { color: var(--ddz-red); }
.ddz-card.joker .r { font-size: 11px; writing-mode: vertical-rl; letter-spacing: 1px; }
.ddz-card.small { width: 36px; height: 52px; flex-basis: 36px; margin-left: -10px; padding: 3px 4px; border-radius: 11px; }
.ddz-card.small .r, .ddz-card.small .s { font-size: 12px; }
.ddz-card.static { cursor: default; }
.ddz-card.static:hover { transform: none; }
.ddz-played .ddz-card {
  animation: ddz-playin .34s cubic-bezier(.2, .75, .2, 1) both;
}
.ddz-played .ddz-card:nth-child(2) { animation-delay: 28ms; }
.ddz-played .ddz-card:nth-child(3) { animation-delay: 56ms; }
.ddz-played .ddz-card:nth-child(4) { animation-delay: 84ms; }
.ddz-played .ddz-card:nth-child(5) { animation-delay: 112ms; }
.ddz-played .ddz-card:nth-child(6) { animation-delay: 140ms; }
.ddz-played .ddz-card:nth-child(7) { animation-delay: 168ms; }
.ddz-played .ddz-card:nth-child(8) { animation-delay: 196ms; }
.ddz-played .ddz-card:nth-child(9) { animation-delay: 224ms; }
.ddz-played .ddz-card:nth-child(10) { animation-delay: 252ms; }
.ddz-played .ddz-card:nth-child(11) { animation-delay: 280ms; }
.ddz-played .ddz-card:nth-child(12) { animation-delay: 308ms; }
@keyframes ddz-playin {
  from { opacity: 0; transform: translateY(18px) scale(.88); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.ddz-card.back {
  background:
    radial-gradient(circle at 30% 28%, rgba(255,255,255,.55), transparent 42%),
    repeating-linear-gradient(135deg, #8FD0F2 0 6px, #4BA3E3 6px 12px);
  border-color: rgba(30, 79, 156, .18); color: transparent;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 6px 10px rgba(30, 79, 156, .12);
}
.ddz-handinfo { text-align: center; color: var(--ddz-dim); font-size: 11.5px; margin-top: 6px; min-height: 16px; }

.ddz-actions { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.ddz-actions-row { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
.ddz-actions-row .ddz-btn.primary { flex: 1.4; }
.ddz-advice {
  border: 1px solid rgba(126, 200, 232, .55); border-radius: 16px; padding: 9px 11px;
  background: linear-gradient(180deg, rgba(126, 200, 232, .22), rgba(255,255,255,.72));
  font-size: 12px; min-height: 64px;
  box-shadow: 0 8px 16px rgba(75, 163, 227, .06);
}
.ddz-advice .hd { display: flex; align-items: center; gap: 6px; color: #1E4F9C; font-size: 11px; font-weight: 800; margin-bottom: 4px; }
.ddz-advice .hd::before {
  content: ""; width: 8px; height: 8px; border-radius: 50%;
  background: #7EC8E8; box-shadow: 0 0 0 3px rgba(126, 200, 232, .28);
}
.ddz-advice .mv { font-weight: 700; }
.ddz-advice .rs { color: var(--ddz-dim); font-size: 11.5px; margin-top: 2px; line-height: 1.4; }
.ddz-advice .win { color: var(--ddz-good); font-size: 11px; margin-left: auto; font-weight: 700; }

/* ---------- 弹层 ---------- */
.ddz-overlay {
  position: absolute; inset: 0; z-index: 40; display: grid; place-items: center;
  background: rgba(27, 42, 68, .28); backdrop-filter: blur(6px); padding: 20px;
}
.ddz-modal {
  width: min(520px, 100%); max-height: 90%; overflow: auto;
  border: 1px solid rgba(126, 200, 232, .6);
  border-top: 3px solid #7EC8E8;
  border-radius: 22px;
  background: var(--ddz-panel-solid);
  box-shadow: 0 22px 56px rgba(30, 79, 156, .16);
  padding: 20px;
}
.ddz-modal h2 { margin: 0 0 4px; font-size: 18px; color: #1E4F9C; }
.ddz-modal .lead { color: var(--ddz-dim); font-size: 12px; margin-bottom: 16px; }
.ddz-result-big { font-size: 30px; font-weight: 800; margin: 6px 0 2px; letter-spacing: .3px; }
.ddz-result-big.win { color: var(--ddz-good); }
.ddz-result-big.lose { color: var(--ddz-bad); }
.ddz-kv { display: grid; grid-template-columns: 1fr auto; gap: 6px 16px; font-size: 12.5px; margin: 14px 0; }
.ddz-kv .k { color: var(--ddz-dim); }
.ddz-kv .v { text-align: right; font-variant-numeric: tabular-nums; font-weight: 650; }
.ddz-delta { display: flex; gap: 8px; margin: 12px 0 4px; }
.ddz-delta div {
  flex: 1; border: 1px solid var(--ddz-line); border-radius: 12px; padding: 7px 9px; font-size: 12px;
  display: flex; justify-content: space-between; background: rgba(245, 248, 252, .9);
}
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
.ddz-replay-line b { color: var(--ddz-text); font-weight: 650; }
.ddz-toast {
  position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%);
  padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 650; z-index: 60;
  background: rgba(255,255,255,.96); border: 1px solid var(--ddz-line-strong); color: var(--ddz-text);
  box-shadow: 0 10px 28px rgba(30, 79, 156, .16);
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
.ddz-more-row:hover { background: rgba(75, 163, 227, .14); }
.ddz-more-row svg { flex: 0 0 16px; }

@media (prefers-reduced-motion: reduce) {
  .ddz-root *,
  .ddz-root *::before,
  .ddz-root *::after {
    animation: none !important;
    transition: none !important;
  }
  .ddz-pass { opacity: 1; }
}

@media (max-width: 900px) {
  .ddz-bottom { grid-template-columns: 1fr; align-items: stretch; }
  .ddz-counter { order: 2; }
  .ddz-hand { min-height: 84px; padding-top: 16px; }
  .ddz-card { width: 40px; height: 58px; flex-basis: 40px; margin-left: -16px; border-radius: 12px; }
  .ddz-seatrow { padding: 8px 10px; }
  .ddz-seat { min-width: 0; padding: 8px 10px; }
  .ddz-seat .sub2 { display: none; }
  .ddz-avatar { width: 44px; height: 44px; flex-basis: 44px; }
  .ddz-seat.seat-0 .ddz-avatar { width: 50px; height: 50px; flex-basis: 50px; }
  .ddz-watermark { width: 180px; height: 180px; }
  .ddz-actions .ddz-btn.primary { width: 100%; }
  .ddz-setup { padding: 18px 14px 30px; }
  .ddz-tiers { grid-template-columns: 1fr; }
  .ddz-hero-avatar { width: 56px; height: 56px; flex-basis: 56px; }
}
`

    /* 大肥鱼头像：构建时从 assets/dafeiyu-avatar.jpg 内联，牌桌不额外请求文件 */
    const DAFEIYU_AVATAR = "data:image/jpeg;base64,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"
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

function liveMult(st) {
  if (st.result && typeof st.result.multiplier === 'number') return st.result.multiplier
  let mult = st.base || 1
  const doubling = st.doubling || [1, 1, 1]
  for (let s = 0; s < 3; s++) mult *= doubling[s] || 1
  const open = st.open || []
  for (let s = 0; s < 3; s++) if (open[s]) mult *= 2
  for (let i = 0; i < (st.bombs || 0); i++) mult *= 2
  return mult
}

function Decor() {
  return h('div', { className: 'ddz-decor', 'aria-hidden': 'true' },
    h('span', { className: 'ddz-bubble d1' }),
    h('span', { className: 'ddz-bubble d2' }),
    h('span', { className: 'ddz-bubble d3' }),
    h('span', { className: 'ddz-bubble d4' }),
    h('img', { className: 'ddz-stamp s1', src: DAFEIYU_AVATAR, alt: '', draggable: false }),
    h('img', { className: 'ddz-stamp s2', src: DAFEIYU_AVATAR, alt: '', draggable: false }),
    h('span', { className: 'ddz-whale w1' }, '🐳'),
    h('span', { className: 'ddz-whale w2' }, '🐋'))
}

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
  return h('div', { className: 'ddz-seat seat-' + seat + (isLandlord ? ' is-landlord' : '') + (isTurn ? ' is-turn' : '') + (seat === 0 ? ' is-me' : '') },
    h('div', { className: 'ddz-avatar' + (isLandlord ? ' landlord' : '') },
      h('img', { className: 'ddz-avatar-img', src: DAFEIYU_AVATAR, alt: '', draggable: false }),
      isLandlord ? h('span', { className: 'crown', 'aria-hidden': 'true' }, '♛') : null),
    h('div', { className: 'meta' },
      h('div', { className: 'name' }, name, isLandlord ? h('span', { className: 'tag landlord-tag' }, T.landlordTag) : null),
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
    h(Decor),
    topbar(),
    h('div', { className: 'ddz-scroll' },
      h('div', { className: 'ddz-setup' },
        h('div', { className: 'ddz-hero' },
          h('img', { className: 'ddz-hero-avatar', src: DAFEIYU_AVATAR, alt: '', draggable: false }),
          h('div', null,
            h('h1', null, T.appName),
            h('div', { className: 'sub' }, T.tagline))),
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
    const replay = st.replay || []
    const lastEv = replay.length ? replay[replay.length - 1] : null
    const passSeat = lastEv && lastEv.type === 'pass' ? lastEv.seat : -1
    const playedBomb = !!(st.last && st.last.move && (st.last.move.type === 'bomb' || st.last.move.type === 'rocket'))
    const playSerial = st.playCounts ? st.playCounts[0] + st.playCounts[1] + st.playCounts[2] : 0
    const playKey = st.last ? playSerial + '-' + st.last.seat : 'empty'
    const bidders = st.phase === 'bid' ? G.bidSeat(st) : -1
    const whoName = (seat) => seat === 0 ? T.you : seat === 1 ? T.downTier : T.upTier
    let phaseText = T.playing
    if (st.phase === 'bid') phaseText = fmt(T.bidTurn, { who: whoName(bidders) })
    else if (st.phase === 'double') phaseText = T.doubleTurn
    else if (st.phase === 'play') phaseText = myTurn ? (auto ? T.autoOn : T.yourTurn) : fmt(T.thinking, { tier: tierLabel((st.tiers && st.tiers[st.turn]) || 'go', T) })
    else if (st.phase === 'redeal') phaseText = T.bidAllPass
    else if (st.phase === 'over') phaseText = st.winners === 'landlord' ? T.winLandlord : T.winFarmer
    const kittyFace = st.landlord >= 0 && st.phase !== 'bid' && st.phase !== 'redeal'
    const kittyCards = kittyFace ? cardsFromCounts(st.bottom || []) : []
    const openN = (st.open || []).filter(Boolean).length
    return h('div', { className: 'ddz-root' },
      h(Decor),
      topbar(),
      counterOpen ? counterBar() : null,
      h('div', { className: 'ddz-table' },
        h('div', { className: 'ddz-seatrow' },
          h(Seat, { st, seat: 2, T, lang, remain, isTurn: st.phase === 'play' && st.turn === 2 || bidders === 2 }),
          h(Seat, { st, seat: 1, T, lang, remain, isTurn: st.phase === 'play' && st.turn === 1 || bidders === 1 })),
        h('div', { className: 'ddz-mid' },
          h('img', { className: 'ddz-watermark', src: DAFEIYU_AVATAR, alt: '', draggable: false }),
          h('div', { className: 'ddz-mid-inner' },
            h('div', { className: 'ddz-infobar' },
              h('span', { className: 'ddz-pill is-phase' }, phaseText),
              st.landlord >= 0 ? h('span', { className: 'ddz-pill is-gold' }, fmt(T.landlordIs, { who: whoName(st.landlord) })) : null,
              st.mode === 'score' && st.bidHigh > 0 ? h('span', { className: 'ddz-pill' }, st.bidHigh + '分') : null,
              st.mode === 'rob' && st.landlord >= 0 ? h('span', { className: 'ddz-pill' }, T.modeRob) : null,
              h('span', { className: 'ddz-pill is-mult' }, fmt(T.multiplier, { n: liveMult(st) })),
              h('span', { className: 'ddz-pill' }, fmt(T.bombs, { n: st.bombs || 0 })),
              openN ? h('span', { className: 'ddz-pill' }, T.openOn + (openN > 1 ? ' ×' + openN : '')) : null),
            h('div', { className: 'ddz-kitty' },
              h('span', { className: 'ddz-lastlabel' }, T.bottomCards),
              h('div', { className: 'ddz-kitty-cards' },
                kittyFace && kittyCards.length
                  ? kittyCards.map(c => h(Card, { key: 'k' + c.id, card: c, small: true, static: true }))
                  : [0, 1, 2].map(i => h(Card, { key: 'kb' + i, back: true, small: true, static: true })))),
            h('div', { className: 'ddz-lastlabel' }, st.last ? T.lastPlay : T.noPlay),
            h('div', {
              key: 'played-' + playKey,
              className: 'ddz-played' + (playedBomb ? ' is-bomb' : ''),
            }, lastCards ? lastCards.map(c => h(Card, { key: c.id, card: c, small: true, static: true })) : null),
            passSeat >= 0 ? h('div', {
              key: 'pass-' + replay.length,
              className: 'ddz-pass',
            }, (passSeat === 0 ? T.you : passSeat === 1 ? T.downTier : T.upTier) + ' · ' + T.passAction) : null,
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
            adviceCard()))),
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
      h('img', { className: 'ddz-brand', src: DAFEIYU_AVATAR, alt: '', draggable: false }),
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