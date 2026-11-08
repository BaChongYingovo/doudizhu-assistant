import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import assert from 'node:assert/strict'

// 插件包是 "type": "module"，src 里的 UMD 文件不能直接 require，
// 用最小的 CJS 上下文跑一遍拿 exports。
function loadUMD(rel) {
  const file = fileURLToPath(new URL(rel, import.meta.url))
  const mod = { exports: {} }
  const ctx = vm.createContext({ module: mod, exports: mod.exports, console })
  vm.runInContext(readFileSync(file, 'utf8'), ctx, { filename: file })
  return mod.exports
}

const DDZ = loadUMD('../src/engine.js')
const { GameCore } = loadUMD('../src/game.js')
const G = GameCore(DDZ)

function seeded(seed) {
  let s = seed >>> 0
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

let pass = 0, fail = 0
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.log('FAIL', name, '::', e.message) }
}

t('发牌：17+17+17 与 3 张底牌', () => {
  const st = G.createGame({ rng: seeded(1) })
  assert.equal(G.seatCounts(st).reduce((a, b) => a + b, 0), 51)
  assert.equal(DDZ.total(st.bottom), 3)
  assert.ok(st.bidOrder.length === 3)
  assert.equal(st.phase, 'bid')
})

t('叫分：三家全不叫 → 重新发牌', () => {
  const st = G.createGame({ mode: 'score', rng: seeded(2) })
  for (let i = 0; i < 3; i++) G.applyBid(st, G.bidSeat(st), 0)
  assert.equal(st.phase, 'redeal')
})

t('叫分：叫 3 分的人当地主并拿底牌', () => {
  const st = G.createGame({ mode: 'score', rng: seeded(3) })
  const first = G.bidSeat(st)
  G.applyBid(st, first, 3)
  G.applyBid(st, G.bidSeat(st), 0)
  G.applyBid(st, G.bidSeat(st), 0)
  assert.equal(st.landlord, first)
  assert.equal(st.phase, 'double')
  assert.equal(DDZ.total(st.hands[first]), 20)
})

t('抢地主：先不叫，第二家叫，第三家抢 → 第三家当地主', () => {
  const st = G.createGame({ mode: 'rob', rng: seeded(4) })
  G.applyBid(st, G.bidSeat(st), 0)
  G.applyBid(st, G.bidSeat(st), 'call')
  const third = G.bidSeat(st)
  G.applyBid(st, third, 'rob')
  assert.equal(st.landlord, third)
  assert.equal(st.phase, 'double')
})

t('加倍：三家选完进入出牌，地主先出', () => {
  const st = G.createGame({ rng: seeded(5) })
  G.applyBid(st, G.bidSeat(st), 3)
  G.applyBid(st, G.bidSeat(st), 0)
  G.applyBid(st, G.bidSeat(st), 0)
  G.applyDouble(st, 0, 2)
  G.applyDouble(st, 1, 1)
  assert.equal(st.phase, 'double')
  G.applyDouble(st, 2, 4)
  assert.equal(st.phase, 'play')
  assert.equal(st.turn, st.landlord)
})

t('领出不能过；跟牌可以过；两家连过回到领出者', () => {
  const st = G.createGame({ rng: seeded(6) })
  G.applyBid(st, G.bidSeat(st), 3)
  G.applyBid(st, G.bidSeat(st), 0)
  G.applyBid(st, G.bidSeat(st), 0)
  G.applyDouble(st, 0, 1); G.applyDouble(st, 1, 1); G.applyDouble(st, 2, 1)
  const L = st.landlord
  const { moves } = G.legalMoves(st, L)
  assert.ok(moves.length > 0)
  G.applyPlay(st, L, moves[0].cards)
  const n1 = st.turn
  assert.equal(G.legalMoves(st, n1).canPass, true)
  G.applyPass(st, n1)
  const n2 = st.turn
  G.applyPass(st, n2)
  assert.equal(st.turn, L)
  assert.equal(st.last, null)
})

t('压不过的牌会被拒绝', () => {
  const st = G.createGame({ rng: seeded(7) })
  G.applyBid(st, G.bidSeat(st), 3)
  G.applyBid(st, G.bidSeat(st), 0)
  G.applyBid(st, G.bidSeat(st), 0)
  G.applyDouble(st, 0, 1); G.applyDouble(st, 1, 1); G.applyDouble(st, 2, 1)
  const L = st.landlord
  const { moves } = G.legalMoves(st, L)
  const single = moves.find(m => m.type === 'single' && m.rank <= 8)
  if (!single) return
  G.applyPlay(st, L, single.cards)
  const n1 = st.turn
  assert.throws(() => G.applyPlay(st, n1, single.cards))
})

t('AI 自对局 300 局跑得完，无异常、不卡死', () => {
  let finished = 0
  for (let g = 0; g < 300; g++) {
    const st = G.createGame({ mode: g % 2 ? 'rob' : 'score', rng: seeded(1000 + g), tiers: ['go', 'go', 'go'] })
    let guard = 0
    while (st.phase === 'bid' && guard++ < 20) {
      const seat = G.bidSeat(st)
      G.applyBid(st, seat, G.aiBid(st, seat))
    }
    if (st.phase === 'redeal') continue
    for (let s = 0; s < 3; s++) G.applyDouble(st, s, s === 0 ? 2 : G.aiDouble(st, s))
    guard = 0
    while (st.phase === 'play' && guard++ < 400) {
      const seat = st.turn
      const legal = G.legalMoves(st, seat)
      const ai = G.aiMove(st, seat)
      if (ai.move) G.applyPlay(st, seat, ai.move.cards)
      else if (legal.canPass) G.applyPass(st, seat)
      else G.applyPlay(st, seat, legal.moves[0].cards)
    }
    assert.equal(st.phase, 'over', '对局没结束')
    assert.ok(st.result && ['landlord', 'farmers'].indexOf(st.winners) >= 0)
    finished++
  }
  assert.ok(finished >= 250, '完成的局数太少：' + finished)
})

t('结算：地主赢，两家农民扣分，倍数正确', () => {
  const st = G.createGame({ rng: seeded(9) })
  st.phase = 'over'
  st.landlord = 0
  st.winners = 'landlord'
  st.doubling = [2, 1, 4]
  st.open = [false, false, false]
  st.bombs = 1
  st.playCounts = [3, 0, 0]
  st.endedAt = st.startedAt + 60000
  const r = G.computeResult(st)
  assert.equal(r.multiplier, 32)
  assert.equal(r.spring, true)
  assert.deepEqual(Array.from(r.delta), [64, -32, -32])
})

t('反春：农民赢且地主只出过一手', () => {
  const st = G.createGame({ rng: seeded(10) })
  st.phase = 'over'
  st.landlord = 1
  st.winners = 'farmers'
  st.doubling = [1, 1, 1]
  st.open = [false, false, false]
  st.bombs = 0
  st.playCounts = [2, 1, 2]
  const r = G.computeResult(st)
  assert.equal(r.antiSpring, true)
  assert.equal(r.multiplier, 2)
  assert.deepEqual(Array.from(r.delta), [2, -4, 2])
})

t('提示列表：跟牌时含不出，领出时不含', () => {
  const st = G.createGame({ rng: seeded(11) })
  G.applyBid(st, G.bidSeat(st), 3)
  G.applyBid(st, G.bidSeat(st), 0)
  G.applyBid(st, G.bidSeat(st), 0)
  G.applyDouble(st, 0, 1); G.applyDouble(st, 1, 1); G.applyDouble(st, 2, 1)
  const L = st.landlord
  assert.equal(G.hintList(st, L).canPass, false)
  const mv = G.hintList(st, L).moves[0]
  G.applyPlay(st, L, mv.cards)
  const n = st.turn
  assert.equal(G.hintList(st, n).canPass, true)
})

t('明牌 ×2', () => {
  const st = G.createGame({ rng: seeded(12) })
  st.phase = 'play'
  st.landlord = 0
  st.playCounts = [2, 1, 1]
  G.applyOpen(st, 1)
  st.phase = 'over'; st.winners = 'landlord'
  const r = G.computeResult(st)
  assert.equal(r.multiplier, 2)
})

console.log(`\n${pass} 通过，${fail} 失败`)
if (fail) process.exit(1)
