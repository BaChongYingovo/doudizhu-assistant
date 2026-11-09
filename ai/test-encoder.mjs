import fs from 'node:fs'
import { cards2array, countsOfCards, encodeBase, encodeZ } from './douzero.mjs'
const g = JSON.parse(fs.readFileSync(new URL('./golden-encoder.json', import.meta.url), 'utf8'))
const toOurs = (c) => (c === 20 ? 16 : c === 30 ? 17 : c === 17 ? 15 : c)
const cnt = (cards) => countsOfCards(cards.map(toOurs))
let fail = 0
const check = (name, got, want) => {
  if (got.length !== want.length) { fail++; console.log('FAIL', name, 'dim', got.length, want.length); return }
  let bad = 0
  for (let i = 0; i < got.length; i++) if (Math.abs(got[i] - want[i]) > 1e-6) bad++
  if (bad) { fail++; console.log('FAIL', name, bad + ' dims') } else console.log('ok', name)
}
const hands = [[3,3,4,17,20,30],[5,6,7,8,9,10,11,12,13,14,17,17],[20,30],[3,3,3,3,17,17,17,17],[10,10,11,11,12,12,13,13,14,14]]
hands.forEach((h, i) => check('cards#' + i, cards2array(cnt(h)), g.cards[i]))
check('z', encodeZ(g.seq.map((c) => ({ counts: cnt(c) }))), g.landlord.z.flat())
const ctxL = { position:'landlord', myCounts:cnt([3,3,4,5,6,7,8,9,9,10,10,11,11,12,12,13,13]),
  otherCounts:cnt([14,14,17,17,17,20,30]), playedCounts:{landlord_up:cnt([3,3,4]), landlord_down:cnt([17,17])},
  lastCounts:cnt([4,5,6,7,8]), numLeft:{landlord_up:10, landlord_down:12}, bombNum:2 }
check('x_landlord', encodeBase(ctxL), g.landlord.x_no_action)
const ctxU = { position:'landlord_up', myCounts:cnt([3,4,5,5,6,7,9,9,10,11,12,12,13,14,14,20,30]),
  otherCounts:cnt([3,3,4,4,5,6,7,8,8,9,10,11,13,13,17,17,17]),
  playedCounts:{landlord:cnt([17,17,14]), teammate:cnt([3,3,4])},
  lastCounts:cnt([5,6,7,8,9]), lastLandlordCounts:cnt([17,17]), lastTeammateCounts:cnt([3,3,4]),
  numLeft:{landlord:15, teammate:14}, bombNum:1 }
check('x_landlord_up', encodeBase(ctxU), g.landlord_up.x_no_action)
console.log(fail ? 'ENCODER FAIL ' + fail : 'ENCODER OK')
process.exit(fail ? 1 : 0)
