/**
 * sota 档纯 JS 前向的速度基准（不参与断言，只看数字）。
 *
 *   node tools/bench-sota.mjs [局数]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(root, '..', '..')

function loadSrc(rel) {
  const code = fs.readFileSync(path.join(root, 'src', rel), 'utf8')
  const shim = { exports: {} }
  new Function('module', 'exports', 'window', code)(shim, shim.exports, undefined)
  return shim.exports
}

const SOTA = loadSrc('sota.js')
const DDZ = loadSrc('engine.js')
const G = loadSrc('game.js').GameCore(DDZ)
SOTA.loadFromBytes(new Uint8Array(fs.readFileSync(path.join(repo, 'ai', 'models', 'douzero_WP', 'landlord.onnx'))))

let calls = 0
let rankMs = 0
const orig = SOTA.rank
DDZ.setSotaRank((ctx, actions) => {
  const t0 = process.hrtime.bigint()
  const r = orig(ctx, actions)
  rankMs += Number(process.hrtime.bigint() - t0) / 1e6
  calls++
  return r
})

const games = Number(process.argv[2] || 10)
const t0 = process.hrtime.bigint()
let played = 0
for (let i = 0; i < games; i++) {
  const g = G.createGame({ mode: 'score', tiers: ['sota', 'sota', 'sota'] })
  let guard = 0
  while (g.phase === 'bid' && guard++ < 20) G.applyBid(g, G.bidSeat(g), G.aiBid(g, G.bidSeat(g)))
  if (g.phase === 'double') for (let s = 0; s < 3; s++) G.applyDouble(g, s, s === 0 ? 2 : G.aiDouble(g, s))
  guard = 0
  while (g.phase === 'play' && guard++ < 400) {
    const seat = g.turn
    const legal = G.legalMoves(g, seat)
    const mv = G.aiMove(g, seat)
    if (mv && mv.move) G.applyPlay(g, seat, mv.move.cards)
    else if (legal.canPass) G.applyPass(g, seat)
    else G.applyPlay(g, seat, legal.moves[0].cards)
  }
  played++
}
const wall = Number(process.hrtime.bigint() - t0) / 1e6

console.log('局数         ' + played)
console.log('模型决策次数 ' + calls)
console.log('单次前向     ' + (calls ? (rankMs / calls).toFixed(2) : '—') + ' ms（含编码 + 全部候选打分）')
console.log('总耗时       ' + wall.toFixed(0) + ' ms（' + (wall / played).toFixed(0) + ' ms/局）')
