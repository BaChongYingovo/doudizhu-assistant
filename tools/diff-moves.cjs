/* 差分测试：把本引擎 generateMoves / classify 与 rlcard 的权威动作空间对比。
 * rlcard 的 card_type.json (27471 条) 是「所有合法出牌」的真值表。
 * 用法: node tools/diff-moves.cjs [随机手牌数]
 */
const fs = require('fs');
const path = require('path');
const DDZ = require('./engine.cjs');

const ROOT = path.resolve(__dirname, '..');
const CT = path.join(ROOT, 'research', 'dist', 'rlcard-1.2.0', 'rlcard',
  'games', 'doudizhu', 'jsondata', 'card_type.json');
const data = JSON.parse(fs.readFileSync(CT, 'utf-8'));

const CH = {};
'3456789'.split('').forEach(ch => CH[ch] = parseInt(ch, 10));
CH.T = 10; CH.J = 11; CH.Q = 12; CH.K = 13; CH.A = 14; CH['2'] = 15;
CH.B = 16; CH.R = 17;

function vecOf(str) {
  const v = new Array(15).fill(0);
  for (const ch of str) v[CH[ch] - 3]++;
  return v;
}
function canonOfStr(str) {
  return str.split('').map(ch => CH[ch]).sort((a, b) => a - b).join(',');
}

const ACTIONS = Object.keys(data).map(k => ({
  key: canonOfStr(k), vec: vecOf(k), type: data[k][0][0], raw: k
}));

function fitsAction(v, hand) {
  for (let i = 0; i < 15; i++) if (v[i] > hand[i]) return false;
  return true;
}
function authoritative(hand) {
  const map = new Map();
  for (const a of ACTIONS) if (fitsAction(a.vec, hand)) map.set(a.key, a.type);
  return map;
}
function canonMove(m) { return m.cards.slice().sort((a, b) => a - b).join(','); }
function engineMoves(hand) {
  const set = new Set();
  for (const m of DDZ.generateMoves(hand, null)) set.add(canonMove(m));
  return set;
}

function handFromCards(cards) { return DDZ.countsOf(cards); }
function shuffled(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const N_HANDS = parseInt(process.argv[2] || '300', 10);
const missByType = {}, extraByType = {};
let missTotal = 0, extraTotal = 0, handsWithMiss = 0, handsWithExtra = 0;
const missExamples = [], extraExamples = [], classifyNull = [];
let classifyNullTotal = 0;
const seenMiss = new Set(), seenExtra = new Set();

function bumpmap(map, t) { map[t] = (map[t] || 0) + 1; }

function checkHand(hand, label) {
  const auth = authoritative(hand);
  const mine = engineMoves(hand);
  let miss = 0, extra = 0;
  for (const [k, t] of auth) {
    if (!mine.has(k)) {
      miss++; bumpmap(missByType, t);
      if (!seenMiss.has(k)) { seenMiss.add(k); if (missExamples.length < 20) missExamples.push({ label, type: t, key: k }); }
    }
  }
  for (const k of mine) {
    if (!auth.has(k)) {
      extra++;
      const cl = DDZ.classify(k.split(',').map(Number));
      bumpmap(extraByType, cl ? cl.type : '?');
      if (!seenExtra.has(k)) { seenExtra.add(k); if (extraExamples.length < 20) extraExamples.push({ label, key: k }); }
    }
  }
  if (miss) handsWithMiss++;
  if (extra) handsWithExtra++;
  missTotal += miss; extraTotal += extra;
}

for (let g = 0; g < N_HANDS; g++) {
  const deck = shuffled(DDZ.fullDeck());
  const size = g % 2 ? 17 : 20;
  checkHand(handFromCards(deck.slice(0, size)), 'rand' + size + '#' + g);
  checkHand(handFromCards(deck.slice(17, 17 + size)), 'rand' + size + '#' + g + 'b');
}

const tricky = [
  '3333445566778899TTJJQQKKAA22BR',
  '333344', '33334455', '333444555666777',
  '3334445556667778899T', '33344455566778899',
  '3456789TJQKA', '33445566778899TTJJQQ',
  'AAA222', '3333AAAA2222', '33344455566B', '3333445566',
  '333444555777', '333444555666', '333344556677',
];
for (const t of tricky) {
  checkHand(handFromCards(t.split('').map(ch => CH[ch])), 'tricky:' + t);
}

for (const a of ACTIONS) {
  const cards = a.key.split(',').map(Number);
  if (!DDZ.classify(cards)) {
    classifyNullTotal++;
    if (classifyNull.length < 20) classifyNull.push({ raw: a.raw, type: a.type, key: a.key });
  }
}

const top = (m, n) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
console.log('=== 差分测试结果 (rlcard card_type.json 为真值) ===');
console.log('随机手牌轮数:', N_HANDS, '(每轮 2 副) +', tricky.length, '副构造手牌');
console.log('权威动作总数:', ACTIONS.length);
console.log('');
console.log('[generateMoves 漏解]  累计', missTotal, '处，涉及', handsWithMiss, '副手牌');
console.log('  按类型 TOP:', JSON.stringify(top(missByType, 12)));
console.log('[generateMoves 多出]  累计', extraTotal, '处，涉及', handsWithExtra, '副手牌');
console.log('  按类型 TOP:', JSON.stringify(top(extraByType, 12)));
console.log('[classify 返回 null]   共', classifyNullTotal, '种权威动作');
console.log('');
console.log('--- 漏解示例 ---');
for (const e of missExamples) console.log(' ', e.type, e.label, '=>', e.key);
console.log('--- 多出示例 ---');
for (const e of extraExamples) console.log(' ', e.label, '=>', e.key);
console.log('--- classify null 示例 ---');
for (const e of classifyNull) console.log(' ', e.type, e.raw, '=>', e.key);
