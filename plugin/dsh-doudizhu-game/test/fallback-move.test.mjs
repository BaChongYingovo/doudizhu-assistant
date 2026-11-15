/**
 * 兜底出牌 + 引擎信息通道验收
 *
 *   cd doudizhu && node plugin/dsh-doudizhu-game/test/fallback-move.test.mjs
 *
 * 覆盖（t4 契约）：
 *  - 兜底不拆炸弹：领出/跟牌都不把四张同点拆成 1~3 张
 *  - 领出永不返回 null：合法候选非空且 canPass=false 时必须给出一手
 *  - 不得把牌权白送：领出优先「外面压不住」的一手，而不是默认甩最小单张
 *  - 非法建议不落地：aiMove 对非法牌面 / 会拆炸弹的合法建议 / 领出时过牌，全部回退兜底
 *  - 信息通道（按队长 m00082 形状）：open 恒为 [bool,bool,bool] 数组；knownHands 自己可见、
 *    明牌座位可见、其余 null；旧调用（无 open/knownHands）保持原行为
 *  - 结算公式 / 阶段流转未改（game.test.mjs 另有整体覆盖）
 *
 * 手法：真实 DDZ 验证兜底与信息通道；用一个只覆盖 DDZ.advise / generateMoves 的桩，
 * 精确注入「非法建议」「强制过牌」「全部候选都拆炸弹」等边界，不污染对局状态。
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
const desc = m => m ? `${m.type}(${m.rank}) [${m.cards.join(',')}]` : 'null'
const keyOf = m => m && Array.isArray(m.cards) ? m.cards.slice().sort((a, b) => a - b).join(',') : ''
const breaks = (hand, m) => DDZ.breaksBomb(hand, m)
// game.js 在 vm context 里跑，产出的数组属于另一个 realm；deepStrictEqual 会因
// Array.prototype 不同而拒绝「结构相同」的数组。统一转成当前 realm 的数组再断言。
const plain = x => Array.from(x)
const knownCounts = kh => Array.from(kh, x => x ? DDZ.total(x) : null)

function st(hands, last, seat) {
  return {
    phase: 'play', turn: seat, hands, last,
    tiers: ['go', 'go', 'go'], landlord: 0,
    played: zero(), bottom: zero(), open: [false, false, false]
  }
}
// 只覆盖若干方法的 DDZ 桩（其余沿用真实实现，保证 classify/breaksBomb/planCount 真实）
function fake(overrides) { return GameCore(Object.assign({}, DDZ, overrides)) }

function seeded(seed) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

console.log('兜底出牌 / 引擎信息通道')

/* ------------------------------------------------------------------ *
 * ① 兜底不拆炸弹
 * ------------------------------------------------------------------ */

t('领出兜底：手握炸弹时不拆成单张/三张（朴素最小一手会拆，兜底不会）', () => {
  const hand = mk([3, 3, 3, 3, 4, 9, 12])
  const s = st([hand, zero(), zero()], null, 0)
  const { moves, canPass } = G.legalMoves(s, 0)
  assert.equal(canPass, false, '这是领出，不能过')
  assert.ok(moves.length > 0)
  const naive = moves.slice().sort((a, b) => (a.cards.length - b.cards.length) || (a.rank - b.rank))[0]
  assert.equal(breaks(hand, naive), true, '朴素「最小一手」确实会拆炸弹（原兜底缺陷）')
  const fb = G.fallbackMove(s, 0)
  assert.ok(fb.move, '兜底必须给牌')
  assert.equal(breaks(hand, fb.move), false, '兜底不得拆炸弹')
  console.log('    朴素最小=' + desc(naive) + '(拆炸弹) → 兜底=' + desc(fb.move) + '(不拆)')
})

t('跟牌兜底：只剩拆炸弹的候选时宁可过牌，也不拆', () => {
  // 注入一个只会产出「单张 4」的 generateMoves（该牌用了四张 4 里的 1 张 = 拆炸弹），
  // 并让 beats 恒为 true 保证它进入 legalMoves；其余全用真实实现。
  const single4 = DDZ.classify([4])
  const g = fake({
    generateMoves: () => [single4],
    beats: () => true
  })
  const hand = mk([4, 4, 4, 4, 3, 5])
  const last = { seat: 2, move: DDZ.classify([3]) }   // 跟牌，可过
  const s = st([hand, zero(), zero()], last, 0)
  const { moves, canPass } = g.legalMoves(s, 0)
  assert.equal(canPass, true, '跟牌允许过')
  assert.equal(moves.length, 1)
  assert.equal(breaks(hand, moves[0]), true, '唯一能压的候选确实拆炸弹')
  const fb = g.fallbackMove(s, 0)
  assert.equal(fb.move, null, '宁可过牌 (move:null)，也不返回拆炸弹的牌')
})

t('随机牌局扫描：领出兜底始终非 null 且不拆炸弹', () => {
  let n = 0
  for (let seed = 1; seed <= 200; seed++) {
    const rng = seeded(seed)
    const deck = DDZ.fullDeck()
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const x = deck[i]; deck[i] = deck[j]; deck[j] = x
    }
    const hand = mk(deck.slice(0, 17))
    const s = st([hand, zero(), zero()], null, 0)
    const fb = G.fallbackMove(s, 0)
    assert.ok(fb.move, 'seed=' + seed + ' 领出兜底不得为 null')
    assert.equal(breaks(hand, fb.move), false, 'seed=' + seed + ' 领出兜底不得拆炸弹')
    assert.equal(G.legalMoves(s, 0).moves.some(m => keyOf(m) === keyOf(fb.move)), true,
      'seed=' + seed + ' 兜底结果必须是合法候选手牌面')
    n++
  }
  console.log('    ' + n + ' 副随机手牌：领出均非 null、均不拆炸弹、均为合法一手')
})

/* ------------------------------------------------------------------ *
 * ② 领出永不返回 null
 * ------------------------------------------------------------------ */

t('领出兜底：单张手牌 / 只剩炸弹都返回非 null 的一手', () => {
  const one = st([mk([15]), zero(), zero()], null, 0)
  const r1 = G.fallbackMove(one, 0)
  assert.ok(r1.move, '单张 2 领出必须返回牌')
  assert.deepEqual(plain(r1.move.cards), [15])

  const bomb = st([mk([5, 5, 5, 5]), zero(), zero()], null, 0)
  const r2 = G.fallbackMove(bomb, 0)   // 唯一合法就是整出炸弹（不拆）
  assert.ok(r2.move, '只剩炸弹领出必须返回牌')
  assert.equal(r2.move.type, 'bomb')
  assert.equal(breaks(mk([5, 5, 5, 5]), r2.move), false)
  console.log('    单张=' + desc(r1.move) + ' / 炸弹手=' + desc(r2.move))
})

/* ------------------------------------------------------------------ *
 * ③ 不得把牌权白送
 * ------------------------------------------------------------------ */

t('领出兜底：优先「外面压不住」的一手，不默认甩最小单张白送牌权', () => {
  // 手握单张 3 + 大王：大王是外面谁都压不住的单牌，兜底应领大王而非 3
  const hand = mk([3, 17])
  const s = st([hand, zero(), zero()], null, 0)
  const { moves } = G.legalMoves(s, 0)
  const naive = moves.slice().sort((a, b) => (a.rank - b.rank))[0]  // 最小单张 3
  assert.equal(naive.rank, 3, '朴素最小是单张 3')
  const fb = G.fallbackMove(s, 0)
  assert.ok(fb.move)
  assert.equal(fb.move.rank, 17, '兜底应领出压不住的大王(17)，而不是送牌权的单 3')
  console.log('    朴素最小=' + desc(naive) + '(白送) → 兜底=' + desc(fb.move) + '(保牌权)')
})

t('领出兜底：顺子+2 不再默认甩最小单牌', () => {
  const hand = mk([3, 4, 5, 6, 7, 15])
  const s = st([hand, zero(), zero()], null, 0)
  const fb = G.fallbackMove(s, 0)
  assert.ok(fb.move)
  // 兜底应挑控制权更高的一手（探针实测为单张 2），至少不是最小的单张 3
  assert.ok(!(fb.move.cards.length === 1 && fb.move.rank === 3),
    '不应再甩最小单张 3 白送牌权，实际=' + desc(fb.move))
  console.log('    兜底=' + desc(fb.move))
})

/* ------------------------------------------------------------------ *
 * ④ 非法建议不落地（aiMove）
 * ------------------------------------------------------------------ */

t('aiMove：牌面不在合法候选里的建议不落地，回退到合法且不拆炸弹的兜底', () => {
  const hand = mk([3, 3, 3, 3, 4, 9, 12])
  const s = st([hand, zero(), zero()], null, 0)
  const bogus = DDZ.classify([15])             // 手里没有的 2，非法建议
  assert.equal(G.legalMoves(s, 0).moves.some(m => keyOf(m) === keyOf(bogus)), false)
  const r = fake({ advise: () => ({ pass: false, move: bogus, reason: '乱出' }) }).aiMove(s, 0)
  assert.ok(r.move, '领出不能因非法建议而返回 null')
  assert.equal(G.legalMoves(s, 0).moves.some(m => keyOf(m) === keyOf(r.move)), true, '落地必须是合法一手')
  assert.equal(breaks(hand, r.move), false, '兜底不得拆炸弹')
  assert.notEqual(keyOf(r.move), keyOf(bogus), '非法建议未被落地')
  console.log('    非法建议=' + desc(bogus) + ' → 兜底=' + desc(r.move) + ' / reason=' + r.reason)
})

t('aiMove：合法但会拆炸弹的建议同样不落地', () => {
  const hand = mk([3, 3, 3, 3, 4, 9, 12])
  const s = st([hand, zero(), zero()], null, 0)
  const legalButBreak = DDZ.classify([3])     // 单张 3 合法，但拆了四个 3 的炸弹
  assert.equal(breaks(hand, legalButBreak), true)
  const r = fake({ advise: () => ({ pass: false, move: legalButBreak }) }).aiMove(s, 0)
  assert.ok(r.move)
  assert.equal(breaks(hand, r.move), false, '会拆炸弹的建议被拒，落到不拆的兜底')
  assert.notEqual(keyOf(r.move), keyOf(legalButBreak))
  console.log('    拆炸弹建议=' + desc(legalButBreak) + ' → 兜底=' + desc(r.move))
})

t('aiMove：领出时「建议过牌」是非法建议，必须兜底领出一手（永不 null）', () => {
  const hand = mk([3, 3, 3, 3, 4, 9, 12])
  const s = st([hand, zero(), zero()], null, 0)
  const r = fake({ advise: () => ({ pass: true, reason: '想放过' }) }).aiMove(s, 0)
  assert.ok(r.move, '领出不能过牌，必须兜底给一手')
  assert.equal(G.legalMoves(s, 0).moves.some(m => keyOf(m) === keyOf(r.move)), true)
  assert.match(r.reason, /领出不能过/, '应标注原因')
  console.log('    建议过牌 → 兜底=' + desc(r.move) + ' / reason=' + r.reason)
})

t('aiMove：合法建议照常落地；跟牌时过牌被尊重（不过度拦截）', () => {
  // 合法建议照常落地
  const lead = st([mk([3, 4, 5, 6, 7, 15]), zero(), zero()], null, 0)
  const good = DDZ.classify([15])
  const r1 = fake({ advise: () => ({ pass: false, move: good, reason: '压住' }) }).aiMove(lead, 0)
  assert.equal(keyOf(r1.move), keyOf(good), '合法一手应原样落地')
  // 跟牌时 pass 应真的返回 null
  const follow = st([mk([3, 4, 5, 6, 7, 15]), zero(), zero()], { seat: 2, move: DDZ.classify([9]) }, 0)
  const r2 = fake({ advise: () => ({ pass: true, reason: '要不起' }) }).aiMove(follow, 0)
  assert.equal(r2.move, null, '跟牌建议过牌应真的过')
})

t('aiMove：advise 抛异常也能兜底领出（不因引擎异常返回 null）', () => {
  const hand = mk([3, 4, 5, 6, 7])
  const s = st([hand, zero(), zero()], null, 0)
  const r = fake({ advise: () => { throw new Error('engine down') } }).aiMove(s, 0)
  assert.ok(r.move, '引擎异常时领出兜底仍要给牌')
  console.log('    engine down → 兜底=' + desc(r.move))
})

/* ------------------------------------------------------------------ *
 * ⑤ 信息通道：open / knownHands（按队长 m00082 形状）
 * ------------------------------------------------------------------ */

t('adviseState：open 恒为 [bool,bool,bool] 数组；knownHands 自己/明牌座位可见，其余 null', () => {
  const h0 = mk([3, 4, 5]), h1 = mk([6, 7]), h2 = mk([8, 9])
  const s = { hands: [h0, h1, h2], landlord: 0, last: null, played: zero(), bottom: zero(), open: [true, false, true] }
  const a = G.adviseState(s, 0)
  assert.ok(Array.isArray(a.open) && a.open.length === 3, 'open 必须是长度 3 的数组')
  assert.deepEqual(plain(a.open), [true, false, true])
  assert.deepEqual(knownCounts(a.knownHands), [3, null, 2],
    '自己(0)恒可见、明牌座位(2)可见、暗牌座位(1)=null')
  assert.notStrictEqual(a.knownHands[0], h0, '返回的是副本，不改原状态')
  assert.ok(a.knownHands[0].length === 15)
})

t('adviseState：旧 state 无 open 字段时保持原行为（全暗、仅自己可见，旧字段语义不变）', () => {
  const h0 = mk([3, 4, 5]), h1 = mk([6, 7]), h2 = mk([8, 9])
  const old = { hands: [h0, h1, h2], landlord: 1, last: null, played: zero(), bottom: zero() } // 无 open
  const a = G.adviseState(old, 1)
  assert.deepEqual(plain(a.open), [false, false, false], '缺省全暗')
  assert.deepEqual(knownCounts(a.knownHands), [null, 2, null],
    '只有自己(座位1)可见，其余 null')
  // 旧字段一个不少、语义不变
  assert.strictEqual(a.hand, h1)
  assert.equal(a.me, 1)
  assert.equal(a.landlord, 1)
  assert.deepEqual(plain(a.seatCounts), [3, 2, 2])
  assert.equal(a.last, null)
  assert.strictEqual(a.bottom, old.bottom)
  assert.ok(a.played.length === 15)
})

t('adviseState：第三参数 info 可逐座覆盖 open/knownHands（含 null 强制未知）', () => {
  const h0 = mk([3, 4, 5]), h1 = mk([6, 7]), h2 = mk([8, 9])
  const s = { hands: [h0, h1, h2], landlord: 0, last: null, played: zero(), bottom: zero() }
  const a = G.adviseState(s, 1, { open: [true, true, true], knownHands: [null, h1, undefined] })
  assert.deepEqual(plain(a.open), [true, true, true], 'info.open 覆盖生效')
  assert.deepEqual(knownCounts(a.knownHands), [null, 2, 2],
    'info 把座位0强制为 null(未知)，座位1=自己，座位2未给则按 open 推导可见')
})

t('aiMove 旧两参调用可用；三参 info 确实透传到 adviseState 的 state', () => {
  const hand = mk([3, 4, 5, 6, 7])
  const s = st([hand, zero(), zero()], null, 0)
  // 旧两参：不传 info 也能跑
  const r0 = G.aiMove(s, 0)
  assert.ok(r0.move, 'aiMove(st, seat) 仍返回一手合法牌')
  // 三参：捕获传给 advise 的 state，验证 open/knownHands 透传
  let captured = null
  const g = fake({ advise: (state) => { captured = state; return { pass: false, move: DDZ.classify([7]) } } })
  const r = g.aiMove(s, 0, { open: [false, true, false], knownHands: [hand, mk([9]), null] })
  assert.ok(captured, 'advise 被调用')
  assert.deepEqual(plain(captured.open), [false, true, false], 'info.open 透传到引擎 state')
  assert.deepEqual(knownCounts(captured.knownHands), [5, 1, null],
    'info.knownHands 透传到引擎 state')
  assert.ok(r.move, '返回结果非空')
  console.log('    引擎收到的 open=' + JSON.stringify(captured.open) +
    ' knownHands=' + JSON.stringify(captured.knownHands.map(x => x ? DDZ.total(x) : null)))
})

console.log(`\n${pass} 通过，${fail} 失败`)
if (fail) process.exit(1)
