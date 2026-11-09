import fs from 'node:fs'
import { encodeBase, countsOfCards } from './douzero.mjs'
const g = JSON.parse(fs.readFileSync('golden-encoder.json','utf8'))
const toOurs = (c) => c === 20 ? 16 : c === 30 ? 17 : c === 17 ? 15 : c
const cnt = (cards) => countsOfCards(cards.map(toOurs))
const zero = () => new Array(15).fill(0)
const d = { landlord: cnt([3,3,4,5,6,7,8,9,9,10,10,11,11,12,12,13,13]),
            up: cnt([3,3,4]), down: cnt([17,17]), last: cnt([4,5,6,7,8]) }
const ctxL = { position:'landlord', myCounts:d.landlord,
  otherCounts:cnt([14,14,17,17,17,20,30]), playedCounts:{landlord_up:d.up, landlord_down:d.down},
  lastCounts:d.last, numLeft:{landlord_up:10, landlord_down:12}, bombNum:2 }
const ctxU = { position:'landlord_up', myCounts:cnt([3,4,5,5,6,7,9,9,10,11,12,12,13,14,14,20,30]),
  otherCounts:cnt([3,3,4,4,5,6,7,8,8,9,10,11,13,13,17,17,17]),
  playedCounts:{landlord:cnt([17,17,14]), teammate:cnt([3,3,4])},
  lastCounts:cnt([5,6,7,8,9]), lastLandlordCounts:cnt([17,17]), lastTeammateCounts:cnt([3,3,4]),
  numLeft:{landlord:15, teammate:14}, bombNum:1 }
let bad = 0
for (const [name, ctx, want] of [['landlord', ctxL, g.landlord.x_no_action], ['landlord_up', ctxU, g.landlord_up.x_no_action]]) {
  const got = encodeBase(ctx)
  if (got.length !== want.length) { bad++; console.log(name, 'dim', got.length, want.length); continue }
  let m = 0
  for (let i = 0; i < got.length; i++) if (Math.abs(got[i] - want[i]) > 1e-6) m++
  console.log(name, 'dim', got.length, m ? 'MISMATCH ' + m : 'OK')
  if (m) bad++
}
console.log(bad ? 'FAIL' : 'BASE ENCODER OK')
