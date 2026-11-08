/**
 * 叫分 / 加倍结构化评分验收
 *
 *   cd doudizhu && node plugin/dsh-doudizhu-game/test/bid-strength.test.mjs
 *
 * 覆盖：
 *  - 王 / 2 / A / 炸弹 / 手数 对 strength 单调（真实 DDZ、真实牌）
 *  - aiBid / aiDouble 阈值边界精确正确（7.4 / 5.6 / 4.0 / 7.2 / 5.0 / 4.6 / 5.8）
 *  - 具名常量、explainStrength 可解释、旧调用兼容
 *  - 结算公式与阶段未改
 *
 * 边界手法：strength = 控制牌 + 爆发力 + (10 - planCount) * 0.55。
 * 用一个只覆盖 planCount 的 DDZ 桩，把分数精确落到阈值上（及阈值下 0.01），
 * 再验证 aiBid / aiDouble 的分档；另用真实 DDZ 的随机牌局做映射一致性扫描。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import assert from 'node:assert/strict'

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

let pass = 0, fail = 0
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name) }
  catch (e) { fail++; console.log('  ✗ ' + name + ' :: ' + e.message) }
}

const zero = () => DDZ.zero()
const mk = (cards) => { const c = zero(); for (const r of cards) c[r - 3]++; return c }
// 只含 3..J 的干净手牌：控制牌 / 炸弹 / 王炸得分均为 0
const PLAIN = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
// 17 张基准散牌，用于替换单张做控制牌单调性
const BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 3, 4, 5, 6, 7, 8, 9, 10]

function state(cards, extra) {
  const st = {
    hands: [mk(cards), zero(), zero()],
    open: [false, false, false],
    played: zero(),
    bottom: zero(),
    mode: 'score',
    bidHigh: 0,
    bidHighSeat: -1,
    phase: 'bid',
    tiers: ['go', 'go', 'go'],
    startedAt: 0,
    endedAt: 0,
    base: 1
  }
  return Object.assign(st, extra || {})
}

// 精确控制 strength：把 planCount 桩成 10 - score/0.55，使 shape 恰好等于 score
function atScore(score, extra) {
  const fake = Object.assign({}, DDZ, { planCount: () => 10 - score / G.STRENGTH_WEIGHTS.shape.perPlan })
  const g = GameCore(fake)
  const st = state(PLAIN, extra)
  return { g, st, actual: g.strength(st, 0) }
}

// 固定手数项的 DDZ 桩：单独验证「控制牌 / 爆发力」维度时，不让 shape 跟着牌面变
// （真实 planCount 会因换牌而变，会掩盖控制牌的单调性，故此处隔离）
function fixedShape(plans) {
  return Object.assign({}, DDZ, { planCount: () => plans })
}

function seeded(seed) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

console.log('叫分/加倍结构化评分')

t('控制牌单调：大王 > 小王 > 2 > A > K > 基准（隔离 shape 项）', () => {
  // 固定手数，只让控制牌变化；否则 planCount 会跟着换牌变，掩盖单调性
  const g = GameCore(fixedShape(2))
  const s = (rank) => {
    const cards = BASE.slice(); cards[0] = rank
    return g.strength(state(cards), 0)
  }
  const base = g.strength(state(BASE), 0)
  const K = s(13), A = s(14), two = s(15), small = s(16), big = s(17)
  assert.ok(K > base, 'K 应高于基准: ' + K + ' > ' + base)
  assert.ok(A > K, 'A 应高于 K: ' + A + ' > ' + K)
  assert.ok(two > A, '2 应高于 A: ' + two + ' > ' + A)
  assert.ok(small > two, '小王应高于 2: ' + small + ' > ' + two)
  assert.ok(big > small, '大王应高于小王: ' + big + ' > ' + small)
  // 真实 DDZ 下 breakdown 的控制牌分项也必须严格单调（与手数项无关）
  const c = rank => {
    const cards = BASE.slice(); cards[0] = rank
    return G.strengthBreakdown(state(cards), 0).control.total
  }
  assert.ok(c(13) > 0 && c(14) > c(13) && c(15) > c(14) && c(16) > c(15) && c(17) > c(16))
  console.log('    基准/K/A/2/小王/大王 =', [base, K, A, two, small, big].join(' / '))
})

t('炸弹与王炸单调：四个 3 加分；王炸 > 单大王（隔离 shape 项）', () => {
  const g = GameCore(fixedShape(2))
  const base = g.strength(state(BASE), 0)
  const bombHand = [3, 3, 3, 3, 4, 5, 6, 7, 8, 9, 10, 11]   // 恰好四张 3，无控制牌
  const bomb = g.strength(state(bombHand), 0)
  assert.ok(bomb > base, '炸弹应加分: ' + bomb + ' > ' + base)
  assert.ok(Math.abs((bomb - base) - G.STRENGTH_WEIGHTS.power.bomb) < 1e-9,
    '炸弹加分应恰好等于具名权重 4.2')
  const oneBig = g.strength(state([17]), 0)
  const rocket = g.strength(state([16, 17]), 0)
  assert.ok(rocket > oneBig, '王炸应高于单大王: ' + rocket + ' > ' + oneBig)
  // 真实 DDZ 下 breakdown 的爆发力分项
  const d = G.strengthBreakdown(state(bombHand), 0)
  assert.equal(d.power.bombs, 1, '应有 1 个炸弹')
  assert.equal(d.power.rocket, false)
  assert.equal(d.power.total, G.STRENGTH_WEIGHTS.power.bomb)
  assert.ok(d.raw >= d.score, '封顶前分数不低于封顶后')
  const dr = G.strengthBreakdown(state([16, 17]), 0)
  assert.equal(dr.power.rocket, true)
  assert.equal(dr.power.rocketScore, G.STRENGTH_WEIGHTS.power.rocket)
  console.log('    基准/炸弹/单大王/王炸 =', [base, bomb, oneBig, rocket].join(' / '))
})

t('手数单调：一手能出完 > 两手 > 多手（隔离 shape 项）', () => {
  // 同一副干净手牌，只桩 planCount：shape = (10 - plans) * 0.55
  const s = plans => GameCore(fixedShape(plans)).strength(state(PLAIN), 0)
  const one = s(1), two = s(2), many = s(5)
  assert.ok(one > two && two > many, '手数越少分越高: ' + one + ' > ' + two + ' > ' + many)
  assert.ok(Math.abs((one - two) - G.STRENGTH_WEIGHTS.shape.perPlan) < 1e-9, '每多一手扣 0.55')
  console.log('    1手/2手/5手 =', [one, two, many].join(' / '))
})

t('真实牌型：顺子一手 > 散牌两手 > 散牌多手（真实 planCount）', () => {
  const one = G.strength(state([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 0)  // plan=1
  const two = G.strength(state([3, 9]), 0)                                // plan=2
  const many = G.strength(state([3, 6, 9, 12]), 0)                        // plan=4
  assert.ok(one > two, '一手应高于两手: ' + one + ' > ' + two)
  assert.ok(two > many, '两手应高于多手: ' + two + ' > ' + many)
  const d = G.strengthBreakdown(state([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 0)
  assert.equal(d.shape.plans, 1)
  assert.equal(d.shape.saved, 9)
  console.log('    顺子1手/两手/四手 =', [one, two, many].join(' / '))
})

t('阈值提为具名常量且数值正确（无散落魔数）', () => {
  assert.deepEqual(Object.assign({}, G.BID_THRESHOLDS), { three: 7.4, two: 5.6, one: 4.0, call: 4.6, rob: 5.8 })
  assert.deepEqual(Object.assign({}, G.DOUBLE_THRESHOLDS), { superDouble: 7.2, double: 5.0 })
  assert.equal(G.STRENGTH_WEIGHTS.cap, 10)
  assert.equal(G.STRENGTH_WEIGHTS.control.bigJoker, 4.5)
  assert.equal(G.STRENGTH_WEIGHTS.control.smallJoker, 2.4)
  assert.equal(G.STRENGTH_WEIGHTS.power.bomb, 4.2)
  assert.equal(G.STRENGTH_WEIGHTS.power.rocket, 3.5)
  assert.equal(G.STRENGTH_WEIGHTS.shape.perPlan, 0.55)
})

t('aiBid 阈值边界精确正确：7.4 / 5.6 / 4.0 及下 0.01', () => {
  const cases = [
    [7.40, 3], [7.39, 2],
    [5.60, 2], [5.59, 1],
    [4.00, 1], [3.99, 0]
  ]
  for (const [score, want] of cases) {
    const { g, st, actual } = atScore(score)
    assert.equal(actual, score, '桩应把分数精确落到 ' + score + '，实际 ' + actual)
    assert.equal(g.aiBid(st, 0), want, 'score=' + score + ' 应叫 ' + want)
  }
  console.log('    7.40→3 / 7.39→2 / 5.60→2 / 5.59→1 / 4.00→1 / 3.99→0')
})

t('aiBid 抢地主阈值边界：4.6 / 5.8 及下 0.01', () => {
  const callCases = [[4.60, 'call'], [4.59, 0]]
  for (const [score, want] of callCases) {
    const { g, st, actual } = atScore(score, { mode: 'rob' })
    assert.equal(actual, score)
    assert.equal(g.aiBid(st, 0), want, '无人叫 score=' + score)
  }
  const robCases = [[5.80, 'rob'], [5.79, 0]]
  for (const [score, want] of robCases) {
    const { g, st, actual } = atScore(score, { mode: 'rob', bidHighSeat: 1 })
    assert.equal(actual, score)
    assert.equal(g.aiBid(st, 0), want, '已有人叫 score=' + score)
  }
  console.log('    4.60→call / 4.59→0 / 5.80→rob / 5.79→0')
})

t('aiDouble 阈值边界精确正确：7.2 / 5.0 及下 0.01', () => {
  const cases = [[7.20, 4], [7.19, 2], [5.00, 2], [4.99, 1]]
  for (const [score, want] of cases) {
    const { g, st, actual } = atScore(score)
    assert.equal(actual, score)
    assert.equal(g.aiDouble(st, 0), want, 'score=' + score + ' 应加倍 ' + want)
  }
  console.log('    7.20→4 / 7.19→2 / 5.00→2 / 4.99→1')
})

t('aiBid 已有人叫得更高 → 只能过', () => {
  const { g, st } = atScore(9.0, { bidHigh: 3 })
  assert.equal(g.aiBid(st, 0), 0, '满分但已有人叫 3 分，必须过')
  const { g: g2, st: st2 } = atScore(9.0, { bidHigh: 2 })
  assert.equal(g2.aiBid(st2, 0), 3)
})

t('真实牌局扫描：aiBid/aiDouble 分档与具名常量逐局一致', () => {
  const T = G.BID_THRESHOLDS, D = G.DOUBLE_THRESHOLDS
  const wantBid = s => s >= T.three ? 3 : s >= T.two ? 2 : s >= T.one ? 1 : 0
  const wantDouble = s => s >= D.superDouble ? 4 : s >= D.double ? 2 : 1
  let n = 0
  for (let seed = 1; seed <= 120; seed++) {
    const rng = seeded(seed)
    // 用真实 DDZ 的 fullDeck + 洗牌构造 17 张手牌
    const cards = DDZ.fullDeck()
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const x = cards[i]; cards[i] = cards[j]; cards[j] = x
    }
    const st = state(cards.slice(0, 17))
    const s = G.strength(st, 0)
    assert.equal(G.aiBid(st, 0), wantBid(s), 'seed=' + seed + ' score=' + s)
    assert.equal(G.aiDouble(st, 0), wantDouble(s), 'seed=' + seed + ' score=' + s)
    n++
  }
  console.log('    ' + n + ' 副真实手牌逐局一致')
})

t('explainStrength 可解释且含三块分项', () => {
  const txt = G.explainStrength(state([16, 17]), 0)
  assert.match(txt, /控制牌/)
  assert.match(txt, /炸弹\/王炸/)
  assert.match(txt, /手数/)
  console.log('    ' + txt)
})

t('向后兼容：旧 state 无 open 等新字段也能算分 / 叫分 / 加倍', () => {
  const old = { hands: [mk([16, 17]), zero(), zero()] }
  assert.ok(G.strength(old, 0) > 0)
  assert.equal(G.aiBid(Object.assign({ mode: 'score', bidHigh: 0 }, old), 0), 3)
  assert.equal(G.aiDouble(old, 0), 4)
  assert.ok(G.explainStrength(old, 0).length > 0)
})

t('结算公式与阶段未改：computeResult 保持原样', () => {
  const st = state(BASE)
  st.phase = 'over'; st.landlord = 0; st.winners = 'landlord'
  st.doubling = [2, 1, 4]; st.open = [false, false, false]; st.bombs = 1
  st.playCounts = [3, 0, 0]; st.base = 1
  st.startedAt = 0; st.endedAt = 60000
  const r = G.computeResult(st)
  assert.equal(r.multiplier, 32)
  assert.equal(r.spring, true)
  assert.deepEqual(Array.from(r.delta), [64, -32, -32])
  assert.equal(r.bid, 1)
  // 阶段流转未被改动
  assert.equal(state(BASE).phase, 'bid')
})

console.log(`\n${pass} 通过，${fail} 失败`)
if (fail) process.exit(1)
