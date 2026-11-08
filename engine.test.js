/* 引擎自测 */
const E = require('./engine.js');

let fail = 0;
function ok(cond, msg) {
  if (!cond) { fail++; console.log('FAIL:', msg); }
}
function eq(a, b, msg) { ok(a === b, msg + ' (got ' + a + ', want ' + b + ')'); }

/* ---------- 1. 牌型识别 ---------- */
const C = E.classify;
eq(C([3]).type, 'single');
eq(C([3, 3]).type, 'pair');
eq(C([3, 3, 3]).type, 'trio');
eq(C([3, 3, 3, 4]).type, 'trio1');
eq(C([3, 3, 3, 4, 4]).type, 'trio2');
eq(C([3, 4, 5, 6, 7]).type, 'straight');
eq(C([3, 3, 4, 4, 5, 5]).type, 'pairseq');
eq(C([3, 3, 3, 4, 4, 4]).type, 'plane');
eq(C([3, 3, 3, 4, 4, 4, 5, 6]).type, 'plane1');
eq(C([3, 3, 3, 4, 4, 4, 5, 5, 6, 6]).type, 'plane2');
eq(C([3, 3, 3, 3]).type, 'bomb');
eq(C([16, 17]).type, 'rocket');
eq(C([3, 3, 3, 3, 4, 5]).type, 'four2');
eq(C([3, 3, 3, 3, 4, 4, 5, 5]).type, 'four2pair');
ok(C([3, 4]) === null, '散牌不是牌型');
ok(C([15, 15, 15, 15]).type === 'bomb', '2 的炸弹');
ok(C([14, 15, 16]) === null, '2 不能进顺子');
ok(C([13, 14, 15, 3, 4]) === null, '带 2 的顺子非法');

/* ---------- 2. 比较 ---------- */
const big = (cards) => C(cards);
ok(E.beats(big([4]), big([3])), '4 压 3');
ok(!E.beats(big([3]), big([4])), '3 压不了 4');
ok(E.beats(big([3, 3, 3, 3]), big([15])), '炸弹压单张');
ok(E.beats(big([16, 17]), big([3, 3, 3, 3])), '王炸压炸弹');
ok(!E.beats(big([3, 3, 3, 4]), big([4])), '三带一不能压单张');
ok(E.beats(big([4, 4, 4, 5]), big([3, 3, 3, 6])), '三带一比大小');
ok(!E.beats(big([4, 5, 6, 7, 8]), big([3, 4, 5, 6, 7, 8])), '顺子长度不同不能压');

/* ---------- 3. 出牌生成 ---------- */
const hand = E.countsOf([3, 3, 3, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 5, 5]);
const moves = E.generateMoves(hand, null);
ok(moves.length > 30, '能生成足够多的牌型，实际 ' + moves.length);
ok(moves.every(m => E.classify(m.cards) !== null), '生成的每一手都能被还原成牌型');
ok(moves.every(m => m.cards.every(r => E.countsOf(m.cards)[r - 3] <= hand[r - 3])), '不会用到手里没有的牌');
const f = E.classify([3, 4, 5, 6, 7]);
const fm = E.generateMoves(hand, f);
ok(fm.every(m => E.beats(m, f)), '跟牌列表里的每一手都能压过桌面');
ok(fm.some(m => m.type === 'bomb'), '有炸弹时能跟上炸弹');

/* ---------- 4. 手数估算 ---------- */
eq(E.planCount(E.countsOf([3, 4, 5, 6, 7])), 1, '一手顺子');
eq(E.planCount(E.countsOf([3, 4, 5, 6, 7, 9, 9, 15, 15])), 3, '顺子+对9+对2 = 3 手');
eq(E.planCount(E.countsOf([16, 17])), 1, '王炸一手');
eq(E.planCount(E.countsOf([3, 3, 3, 3])), 1, '炸弹一手');
eq(E.planCount(E.countsOf([3, 3, 3, 4, 4, 4])), 1, '飞机一手');

/* ---------- 5. 建议接口 ---------- */
const st = {
  hand, me: 0, landlord: 0, seatCounts: [20, 17, 17],
  played: E.zero(), last: null
};
const adv = E.advise(st);
ok(adv.move && adv.move.cards.length > 0, '领出时有建议');
ok(Array.isArray(adv.options) && adv.options.length > 0, '有备选方案');
ok(typeof adv.reason === 'string' && adv.reason.length > 0, '有理由文案');

const st2 = Object.assign({}, st, { hand: E.countsOf([5, 5, 9, 9, 9, 9, 15]) });
const st2b = Object.assign({}, st2, { last: { seat: 2, move: E.classify([4]) } });
const adv2 = E.advise(st2b);
ok(adv2.move && adv2.move.cards.includes(5), '跟单张 4 时用 5 压，实际 ' + (adv2.move && adv2.move.cards));

// 队友出牌应建议过
const st3 = { hand: E.countsOf([5, 5, 9]), me: 0, landlord: 2, seatCounts: [3, 17, 20], played: E.zero(), last: { seat: 1, move: E.classify([6]) } };
ok(E.advise(st3).pass === true, '队友出牌建议过牌');

// 要不起应建议过
const st4 = { hand: E.countsOf([3]), me: 0, landlord: 1, seatCounts: [1, 20, 17], played: E.zero(), last: { seat: 1, move: E.classify([17]) } };
ok(E.advise(st4).pass === true, '压不了时建议过');

/* ---------- 5b. 识别手牌文字 ---------- */
eq(E.total(E.parseCards('334455789TJQKA2')), 15, 'parseCards 连写');
eq(E.parseCards('3 3 4 4')[0], 2, 'parseCards 空格分隔的对 3');
eq(E.total(E.parseCards('小王 大王')), 2, 'parseCards 王');
eq(E.parseCards('大王')[14], 1, 'parseCards 大王=rank17');
eq(E.parseCards('十')[7], 1, 'parseCards 中文十=rank10');
eq(E.total(E.parseCards('10 10 J J')), 4, 'parseCards 10 不能被吃成 1 和 0');
eq(E.total(E.parseCards('三四五六七')), 5, 'parseCards 中文连写');
eq(E.total(E.parseCards('3,3、4；5')), 4, 'parseCards 各种分隔符');
let threw = false;
try { E.parseCards('33333'); } catch (e) { threw = /超过/.test(e.message); }
ok(threw, '一张牌超过 4 张要报错');

/* ---------- 5c. 攻略策略 ---------- */
function mk(o) {
  return Object.assign({ hand: E.zero(), me: 0, landlord: 0, seatCounts: [17, 17, 17], played: E.zero(), last: null, bottom: E.zero() }, o);
}

// 队友出牌，但自己一手能走完 → 直接收，不许让
const fin = E.advise(mk({
  hand: E.countsOf([6]), me: 0, landlord: 2, seatCounts: [1, 9, 17],
  last: { seat: 1, move: E.classify([5]) }
}));
ok(fin.pass === false && fin.move && fin.move.cards.length === 1, '队友垫牌能一手走完时要直接收');
ok(/一手走完/.test(fin.reason), '一手走完的理由要说明，实际 ' + fin.reason);

// 队友只剩 1 张 → 过牌并提醒别抢
const mate1 = E.advise(mk({
  hand: E.countsOf([6, 9]), me: 0, landlord: 2, seatCounts: [2, 1, 17],
  last: { seat: 1, move: E.classify([5]) }
}));
ok(mate1.pass === true, '队友剩 1 张时别抢牌');
ok(mate1.notes.some(t => /队友只剩 1 张/.test(t)), '要提示队友剩 1 张');

// 只有炸弹能压小牌，且对方不急 → 过，别拆炸
const bombOnly = E.advise(mk({
  hand: E.countsOf([3, 3, 3, 3, 4]), me: 0, landlord: 1, seatCounts: [5, 20, 17],
  last: { seat: 1, move: E.classify([9]) }
}));
ok(bombOnly.pass === true, '只有炸弹能压小牌时应先过');
ok(/太亏/.test(bombOnly.reason), '炸弹乱用的理由要说明');

// 地主放小单，自己压不住 → 提示这是放牌，要记住小牌
const cannot = E.advise(mk({
  hand: E.countsOf([3, 4]), me: 0, landlord: 1, seatCounts: [2, 20, 17],
  last: { seat: 1, move: E.classify([8]) }
}));
ok(cannot.pass === true && cannot.notes.some(t => /放小单/.test(t)), '压不住地主小单时要提示他在放牌');

// 地主放上家：上家出小牌，别拿 2 去硬管
const letUp = E.advise(mk({
  hand: E.countsOf([15, 9, 9, 9, 9]), me: 0, landlord: 0, seatCounts: [5, 17, 17],
  last: { seat: 2, move: E.classify([5]) }
}));
ok(letUp.pass === true, '地主应放过上家的小牌，不拿 2 去管');

// 同上但对手快走完 → 必须出手
const mustAct = E.advise(mk({
  hand: E.countsOf([15, 9, 9, 9, 9]), me: 0, landlord: 0, seatCounts: [5, 1, 17],
  last: { seat: 2, move: E.classify([5]) }
}));
ok(mustAct.pass === false, '对手快走完时不能再放');

// 记牌提示：7 出光 → 外面没有顺子
const noSeven = E.advise(mk({
  hand: E.countsOf([3, 4, 5]), me: 0, landlord: 0, seatCounts: [3, 17, 17],
  played: E.countsOf([7, 7, 7, 7])
}));
ok(noSeven.notes.some(t => /7 出光了/.test(t)), '7 出光要有提示');

// 底牌提示：农民看得到地主底牌时，把底牌念出来
const withBottom = E.advise(mk({
  hand: E.countsOf([3, 4, 5]), me: 0, landlord: 1, seatCounts: [3, 20, 17],
  bottom: E.countsOf([6, 7, 8])
}));
ok(withBottom.notes.some(t => /地主底牌：6 7 8/.test(t)), '要念出地主底牌');

/* ---------- 6. 自对局：跑 1000 局不出错 ---------- */
function selfPlay() {
  const { hands, bottom } = E.deal();
  const landlord = E.pickLandlord(hands);
  hands[landlord] = E.addCards(hands[landlord], bottom); // 地主拿底牌
  const played = E.zero();
  const seatCounts = hands.map(h => E.total(h));
  let last = null, turn = landlord, passes = 0, guard = 0;
  while (guard++ < 400) {
    const adv = E.advise({ hand: hands[turn], me: turn, landlord, seatCounts, played, last });
    if (adv.pass) {
      if (!last) throw new Error('领出的人不能过');
      passes++;
      if (passes >= 2) { last = null; passes = 0; }
      turn = (turn + 1) % 3;
      continue;
    }
    const m = adv.move;
    if (!E.beats(m, last ? last.move : null)) throw new Error('建议了不合法的牌');
    if (E.classify(m.cards) === null) throw new Error('建议了不存在的牌型');
    // 手里得有这些牌
    const mine = E.countsOf(m.cards);
    for (let i = 0; i < 15; i++) if (mine[i] > hands[turn][i]) throw new Error('用了手里没有的牌');
    hands[turn] = E.minus(hands[turn], m.cards);
    playedAdd(played, m.cards);
    seatCounts[turn] -= m.cards.length;
    last = { seat: turn, move: m };
    passes = 0;
    if (seatCounts[turn] === 0) return { winner: turn, landlord, turns: guard };
    turn = (turn + 1) % 3;
  }
  return { winner: -1, turns: guard };
}
function playedAdd(played, cards) { for (const r of cards) played[r - 3]++; }

let wins = [0, 0, 0], maxTurns = 0, stuck = 0;
for (let i = 0; i < 1000; i++) {
  const r = selfPlay();
  if (r.winner < 0) { stuck++; continue; }
  wins[r.winner]++;
  maxTurns = Math.max(maxTurns, r.turns);
}
eq(stuck, 0, '自对局不应有卡死，卡死局数=' + stuck);
console.log('自对局 1000 局：座位胜场', wins, '最长回合', maxTurns);

/* ---------- 7. 性能 ---------- */
const t0 = Date.now();
let n = 0;
for (let i = 0; i < 100; i++) {
  const { hands } = E.deal();
  for (const h of hands) { E.planCount(h); n++; }
}
console.log('planCount 100 副手牌耗时', (Date.now() - t0) + 'ms', '(' + n + ' 次)');

const t1 = Date.now();
const hands2 = E.deal().hands;
const played2 = E.zero();
E.advise({ hand: hands2[0], me: 0, landlord: 0, seatCounts: [17, 17, 20], played: played2, last: null });
console.log('单次 advise 耗时', (Date.now() - t1) + 'ms');

console.log(fail === 0 ? '全部测试通过 ✅' : ('失败 ' + fail + ' 项 ❌'));
process.exit(fail === 0 ? 0 : 1);
