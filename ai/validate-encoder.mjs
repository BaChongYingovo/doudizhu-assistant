import fs from 'node:fs'
import { cards2array, encodeZ, countsOfCards } from './douzero.mjs'
const g = JSON.parse(fs.readFileSync('golden-encoder.json','utf8'))
let fail = 0
const near = (a,b) => Math.abs(a-b) < 1e-6
g.cards.forEach((want, i) => {
  const counts = countsOfCards(g.handsRaw ? g.handsRaw[i] : [])
  // 用 DouZero 牌值重建 counts 不通用；直接按 54 维比对固定手牌
})
// 手牌用原始 DouZero 牌值 -> 我们的 rank
const toOurs = (c) => c === 20 ? 16 : c === 30 ? 17 : c === 17 ? 15 : c
const hands = [
  [3,3,4,17,20,30],
  [5,6,7,8,9,10,11,12,13,14,17,17],
  [20,30],
  [3,3,3,3,17,17,17,17],
  [10,10,11,11,12,12,13,13,14,14],
]
hands.forEach((h, i) => {
  const ours = cards2array(countsOfCards(h.map(toOurs)))
  const want = g.cards[i]
  let bad = 0
  for (let k = 0; k < 54; k++) if (!near(ours[k], want[k])) bad++
  if (bad) { fail++; console.log('cards mismatch', i, bad) }
})
const z = encodeZ(g.seq.map(c => ({ counts: countsOfCards(c.map(toOurs)) })))
let zb = 0
for (let i = 0; i < 5; i++) for (let k = 0; k < 162; k++) if (!near(z[i*162+k], g.landlord.z[i][k])) zb++
if (zb) { fail++; console.log('z mismatch', zb) }
console.log(fail ? 'FAIL ' + fail : 'ENCODER OK (cards 5/5, z 810 dims)')
