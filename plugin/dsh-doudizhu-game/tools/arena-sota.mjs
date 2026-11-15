/**
 * 插件内 A/B：同一批发牌，地主用 sota 档 vs 用对照档，农民固定同档。
 *
 *   node tools/arena-sota.mjs --a sota --b go --farmer plus --games 100 --seed 1
 *
 * 输出地主胜率与差值；发牌种子成对复用（同一手牌打两遍），减小方差。
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

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt
}

const A = arg('a', 'sota')
const B = arg('b', 'go')
const FARMER = arg('farmer', 'plus')
const GAMES = Number(arg('games', 100))
const SEED = Number(arg('seed', 1))

const DDZ = loadSrc('engine.js')
const G = loadSrc('game.js').GameCore(DDZ)

if (A === 'sota' || B === 'sota') {
  const SOTA = loadSrc('sota.js')
  SOTA.loadFromBytes(new Uint8Array(fs.readFileSync(path.join(repo, 'ai', 'models', 'douzero_WP', 'landlord.onnx'))))
  DDZ.setSotaRank(SOTA.rank)
}

function seeded(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function playOne(dealSeed, landlordTier) {
  const st = G.createGame({
    mode: 'score',
    rng: seeded(dealSeed),
    tiers: [landlordTier, FARMER, FARMER]
  })
  let guard = 0
  while (st.phase === 'bid' && guard++ < 20) G.applyBid(st, G.bidSeat(st), G.aiBid(st, G.bidSeat(st)))
  if (st.phase === 'redeal') return null
  if (st.phase === 'double') for (let s = 0; s < 3; s++) G.applyDouble(st, s, s === 0 ? 2 : G.aiDouble(st, s))
  guard = 0
  while (st.phase === 'play' && guard++ < 500) {
    const seat = st.turn
    const legal = G.legalMoves(st, seat)
    const mv = G.aiMove(st, seat)
    if (mv && mv.move) G.applyPlay(st, seat, mv.move.cards)
    else if (legal.canPass) G.applyPass(st, seat)
    else G.applyPlay(st, seat, legal.moves[0].cards)
  }
  if (st.phase !== 'over') return null
  return st.winners === 'landlord' ? 1 : 0
}

const res = { a: [0, 0], b: [0, 0] }
const t0 = Date.now()
for (let g = 0; g < GAMES; g++) {
  const seed = SEED * 100003 + g
  const ra = playOne(seed, A)
  if (ra !== null) { res.a[0] += ra; res.a[1]++ }
  const rb = playOne(seed, B)
  if (rb !== null) { res.b[0] += rb; res.b[1]++ }
  if ((g + 1) % 10 === 0) {
    process.stdout.write('  ' + (g + 1) + '/' + GAMES + ' 已用 ' + Math.round((Date.now() - t0) / 1000) + 's\n')
  }
}

const pa = res.a[1] ? res.a[0] / res.a[1] : 0
const pb = res.b[1] ? res.b[0] / res.b[1] : 0
const out = {
  a: A, b: B, farmer: FARMER, games: GAMES, seed: SEED,
  aWin: res.a[0], aGames: res.a[1], aRate: Number(pa.toFixed(4)),
  bWin: res.b[0], bGames: res.b[1], bRate: Number(pb.toFixed(4)),
  diff: Number((pa - pb).toFixed(4)),
  ms: Date.now() - t0
}
console.log(JSON.stringify(out, null, 2))
const file = path.join(repo, 'arena', 'result-sota-plugin-' + A + '-vs-' + B + '-' + GAMES + '.json')
fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8')
console.log('→ ' + file)
