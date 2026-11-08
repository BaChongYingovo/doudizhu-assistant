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

    // 三带一 / 三带二
    if (n === 4 && g[0].k === 3 && g[1].k === 1) return mk('trio1', g[0].r, 1);
    if (n === 5 && g[0].k === 3 && g[1].k === 2) return mk('trio2', g[0].r, 1);

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
  function advise(state) {
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
    describe, cardsText, breaksBomb, advise, parseCards,
    deal, pickLandlord
  };
});
