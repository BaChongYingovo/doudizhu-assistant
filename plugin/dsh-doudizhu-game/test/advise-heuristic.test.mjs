// 决策启发式（advise go 档）回归测试
// 口径：captain m00160 —— 启发式实现已由队长落地（旧基线 + 两处强制 pass 保留
//       + 拆牌惩罚 5.5），本文件只断言行为，不改 src/engine.js。
// 状态形状完全复刻 game.js 的 adviseState()（hand/me/landlord/seatCounts/
//       played/last/bottom/open/knownHands），不依赖随机、不依赖对局循环。
// 牌面记号：3..9 T J Q K A 2 B(小王) R(大王)，每个字符一张牌。
//
// 8 类局面：
//   a 队友刚出牌且非炸、我无一手走完 → pass（队友纪律）
//   b 队友刚出牌、我能一手走完 → 接管（pass=false, plan=0）
//   c 地主跟上家小牌、非 urgency、只有 2/王能压 → 仍 pass，reason 含「先过一手」
//   d 同 c 但对手剩 2 张（urgency）→ 不得 pass
//   e 跟牌只能开炸/王炸、非 urgency、restPlan>0 → pass；urgency 必出
//   f 拆牌/拆炸惩罚生效（对子 33、炸弹 3333 不被拆开打）
//   g 能一手走完不拆开打、领出永不返回 null
//   h 合法性：任何 pass=false 的 move 必在 generateMoves(hand, last.move) 内且 beats 成立
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import assert from 'node:assert/strict'

// 插件包是 "type": "module"，src 里的 UMD 文件不能直接 require，
// 用最小的 CJS 上下文跑一遍拿 exports（与 game.test.mjs / movegen.test.mjs 一致）。
function loadUMD(rel) {
  const file = fileURLToPath(new URL(rel, import.meta.url))
  const mod = { exports: {} }
  const ctx = vm.createContext({ module: mod, exports: mod.exports, console })
  vm.runInContext(readFileSync(file, 'utf8'), ctx, { filename: file })
  return mod.exports
}

const DDZ = loadUMD('../src/engine.js')

const CH = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10,
  J: 11, Q: 12, K: 13, A: 14, '2': 15, B: 16, R: 17
}
const NAME = Object.fromEntries(Object.entries(CH).map(([k, v]) => [v, String(k)]))
const cardsOf = spec => spec.split('').map(ch => {
  const r = CH[ch]
  assert.ok(r, `未知牌面字符 ${ch}`)
  return r
})
const counts = spec => DDZ.countsOf(cardsOf(spec))
const keyOfCards = cards => cards.slice().sort((a, b) => a - b).join(',')
const keyOfSpec = spec => keyOfCards(cardsOf(spec))
const nameOfMove = m => m.cards.slice().sort((a, b) => a - b).map(r => NAME[r]).join('')

// 与 game.js:385-417 adviseState() 完全同构；last 的 move 是 classify 结果（带 .cards）
function state(o) {
  return {
    hand: counts(o.hand),
    me: o.me,
    landlord: o.landlord ?? 0,
    seatCounts: o.seatCounts,
    played: counts((o.played || '') + (o.last || '')),
    last: o.last ? { seat: o.lastSeat, move: DDZ.classify(cardsOf(o.last)) } : null,
    bottom: DDZ.zero(),
    open: [false, false, false],
    knownHands: [null, null, null]
  }
}
const go = o => DDZ.advise(state(o), { tier: 'go' })

// 从 answers.options 里按牌面取分数 / 剩余手数（options 是 pruned+scored 后前 4 名）
function optOf(ans, spec) {
  const o = (ans.options || []).find(x => keyOfCards(x.move.cards) === keyOfSpec(spec))
  assert.ok(o, `options 应含 ${spec}，实际：${(ans.options || []).map(x => nameOfMove(x.move)).join(' ')}`)
  return o
}
const optScore = (ans, spec) => optOf(ans, spec).score
const optPlan = (ans, spec) => optOf(ans, spec).restPlan

// 确定性局面集合；h 的合法性扫描会遍历全部
const F = {
  // a 队友纪律
  a1: { hand: '345', me: 1, landlord: 0, seatCounts: [10, 3, 8], last: '6', lastSeat: 2 },
  a2: { hand: '3457', me: 1, landlord: 0, seatCounts: [10, 4, 8], last: '6', lastSeat: 2 },
  a3: { hand: '45', me: 1, landlord: 0, seatCounts: [2, 2, 8], last: '3', lastSeat: 2 },
  // b 能一手走完 → 接管
  b1: { hand: '4', me: 1, landlord: 0, seatCounts: [10, 1, 8], last: '3', lastSeat: 2 },
  b2: { hand: '44', me: 1, landlord: 0, seatCounts: [10, 2, 8], last: '33', lastSeat: 2 },
  b3: { hand: '3333', me: 1, landlord: 0, seatCounts: [10, 4, 8], last: 'A', lastSeat: 2 },
  b4: { hand: '4', me: 1, landlord: 0, seatCounts: [2, 1, 8], last: '3', lastSeat: 2 }, // 残局
  // c 地主跟上家小牌：2/小王/大王 保留 pass
  c1: { hand: '33442', me: 0, landlord: 0, seatCounts: [5, 6, 6], last: 'T', lastSeat: 2 },
  c2: { hand: '3344B', me: 0, landlord: 0, seatCounts: [5, 6, 6], last: 'T', lastSeat: 2 },
  c3: { hand: '3344R', me: 0, landlord: 0, seatCounts: [5, 6, 6], last: 'T', lastSeat: 2 },
  // d 同样局面但对手剩 2 张 → urgency 解除 pass
  d1: { hand: '33442', me: 0, landlord: 0, seatCounts: [5, 2, 6], last: 'T', lastSeat: 2 },
  d2: { hand: '3344B', me: 0, landlord: 0, seatCounts: [5, 2, 6], last: 'T', lastSeat: 2 },
  d3: { hand: '3344R', me: 0, landlord: 0, seatCounts: [5, 2, 6], last: 'T', lastSeat: 2 },
  // e 只能开炸/王炸：非 urgency pass，urgency 必出
  e1: { hand: '333345', me: 0, landlord: 0, seatCounts: [6, 6, 6], last: 'A', lastSeat: 1 },
  e2: { hand: '333345', me: 0, landlord: 0, seatCounts: [6, 2, 6], last: 'A', lastSeat: 1 },
  e3: { hand: 'BR5', me: 0, landlord: 0, seatCounts: [3, 6, 6], last: '4444', lastSeat: 1 },
  e4: { hand: 'BR5', me: 0, landlord: 0, seatCounts: [3, 2, 6], last: '4444', lastSeat: 1 },
  // f 拆牌 / 拆炸惩罚
  f1: { hand: '33445', me: 1, landlord: 0, seatCounts: [8, 5, 8], last: '3', lastSeat: 0 },
  f2: { hand: '334', me: 0, landlord: 0, seatCounts: [3, 8, 8], last: null },
  f3: { hand: '33334', me: 0, landlord: 0, seatCounts: [5, 8, 8], last: null },
  // g 一手走完 / 领出非 null
  g1: { hand: '34567', me: 0, landlord: 0, seatCounts: [5, 6, 6], last: null },
  g2: { hand: '334455', me: 0, landlord: 0, seatCounts: [6, 8, 8], last: null },
  g3: { hand: 'BR', me: 0, landlord: 0, seatCounts: [2, 8, 8], last: null },
  g4: { hand: '3456789TJQKA2BR', me: 0, landlord: 0, seatCounts: [17, 8, 8], last: null },
  g5: { hand: '33', me: 0, landlord: 0, seatCounts: [2, 8, 8], last: null },
  g6: { hand: '333', me: 0, landlord: 0, seatCounts: [3, 8, 8], last: null },
  g7: { hand: '3333', me: 0, landlord: 0, seatCounts: [4, 8, 8], last: null },
  g8: { hand: '33344455', me: 0, landlord: 0, seatCounts: [8, 8, 8], last: null },
  // h 附加：自己座位的 last = 领出；要不起；队友炸弹例外（urgency）
  h1: { hand: '345', me: 1, landlord: 0, seatCounts: [10, 3, 8], last: '6', lastSeat: 1 },
  h2: { hand: '33', me: 1, landlord: 0, seatCounts: [2, 6, 8], last: 'A', lastSeat: 0 },
  h3: { hand: '44445', me: 1, landlord: 0, seatCounts: [2, 5, 8], last: '3333', lastSeat: 2 }
}

let pass = 0, fail = 0
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.log('  ✗ FAIL', name, '::', e.message) }
}
const evidence = []

/* ---------------- a 队友纪律：无一手走完则让队友继续 ---------------- */
t('a1/a2/a3 队友刚出牌、我无一手走完 → pass=true，move=null', () => {
  for (const k of ['a1', 'a2', 'a3']) {
    const a = go(F[k])
    assert.equal(a.pass, true, `${k} 应过牌`)
    assert.equal(a.move, null, `${k} 过牌时 move 必须为 null`)
    assert.ok(a.reason.includes('让队友继续带牌'), `${k} reason=${a.reason}`)
  }
  // a2 手里有单 7 能压单 6：说明 pass 是「纪律」而不是「要不起」
  const s = state(F.a2)
  const legal = DDZ.generateMoves(s.hand, s.last.move)
  assert.ok(legal.length > 0, 'a2 本应有可压的牌，pass 必须是主动决策')
  evidence.push(`a 队友纪律：a1/a2/a3 全部 pass=true、move=null；a2 可压牌 ${legal.length} 手仍主动过牌；reason=「${go(F.a1).reason}」`)
})

t('a 重复同一队友局面不会退化成连续强制 pass（每次都是确定性纪律）', () => {
  const seq = [0, 1, 2].map(() => go(F.a1))
  assert.deepEqual(seq.map(a => a.pass), [true, true, true])
  // 过牌后轮到自己领出：必出牌（lead never null），不会卡在 pass 链里
  const lead = go(F.g1)
  assert.equal(lead.pass, false, '领出必须出牌')
  assert.ok(lead.move, '领出 move 非 null')
  evidence.push(`a 连续 3 次队友跟牌均 pass=true；随后领出 ${nameOfMove(lead.move)} → pass=false（无病态连续 pass）`)
})

/* ---------------- b 队友出牌、我能一手走完 → 接管 ---------------- */
t('b1..b4 队友刚出牌、我能一手走完 → pass=false 且 plan=0', () => {
  const expected = { b1: '4', b2: '44', b3: '3333', b4: '4' }
  const seen = []
  for (const k of ['b1', 'b2', 'b3', 'b4']) {
    const a = go(F[k])
    assert.equal(a.pass, false, `${k} 应接管`)
    assert.equal(a.plan, 0, `${k} plan 应为 0`)
    assert.equal(keyOfCards(a.move.cards), keyOfSpec(expected[k]), `${k} 出牌`)
    assert.equal(DDZ.total(DDZ.minus(state(F[k]).hand, a.move.cards)), 0, `${k} 应确实一手走完`)
    assert.ok(a.reason.includes('一手走完'), `${k} reason=${a.reason}`)
    seen.push(`${k}=${expected[k]}`)
  }
  evidence.push(`b 接管：${seen.join(' ')}，全部 pass=false/plan=0/一手走完`)
})

/* ---------------- c 地主放上家：2/王 保留 pass，reason 含「先过一手」 ---------------- */
t('c1/c2/c3 只有 2/小王/大王 能压、非 urgency → 仍 pass（保留规则）', () => {
  const expected = { c1: '2', c2: 'B', c3: 'R' }
  const reasonBits = { c1: '2', c2: '小王', c3: '大王' }
  const seen = []
  for (const k of ['c1', 'c2', 'c3']) {
    const a = go(F[k])
    assert.equal(a.pass, true, `${k} 应保留强制 pass`)
    assert.equal(a.move, null, `${k} move=null`)
    assert.ok(a.reason.includes('先过一手'), `${k} reason 应含「先过一手」，实际=${a.reason}`)
    assert.ok(a.reason.includes(reasonBits[k]), `${k} reason 应点名 ${reasonBits[k]}，实际=${a.reason}`)
    const s = state(F[k])
    const legal = DDZ.generateMoves(s.hand, s.last.move)
    assert.equal(legal.length, 1, `${k} 唯一合法解就是那张控制牌`)
    assert.equal(keyOfCards(legal[0].cards), keyOfSpec(expected[k]), `${k} 唯一解`)
    assert.ok(optPlan(a, expected[k]) > 0, `${k} restPlan>0（不是一手走完才 pass）`)
    seen.push(`${k}:${expected[k]}/score=${optScore(a, expected[k])}`)
  }
  evidence.push(`c 保留强制 pass：${seen.join(' ')}；reason 均含「先过一手」且 restPlan>0`)
})

/* ---------------- d urgency：对手剩 2 张 → 不得 pass ---------------- */
t('d1/d2/d3 同 c 但对手剩 2 张（urgency）→ 不得 pass', () => {
  const expected = { d1: '2', d2: 'B', d3: 'R' }
  const seen = []
  for (const k of ['d1', 'd2', 'd3']) {
    const a = go(F[k])
    assert.equal(a.pass, false, `${k} urgency 下必须出牌`)
    assert.equal(keyOfCards(a.move.cards), keyOfSpec(expected[k]), `${k} 出牌`)
    assert.equal(a.move.type, 'single', `${k} 单张控制牌`)
    assert.ok(a.plan > 0, `${k} 仍是残局跟牌（plan>0，说明是 urgency 解锁而非一手走完）`)
    assert.ok(!a.reason.includes('先过一手'), `${k} 不应再是强制过牌话术`)
    seen.push(`${k}=${expected[k]}/plan=${a.plan}`)
  }
  evidence.push(`d 残局解锁：${seen.join(' ')}，全部 pass=false（与 c 同手牌仅 seatCounts 改为对手 2 张）`)
})

/* ---------------- e 只能开炸/王炸：非 urgency pass，urgency 必出 ---------------- */
t('e1 跟单 A 只能开炸、非 urgency、restPlan>0 → pass', () => {
  const a = go(F.e1)
  assert.equal(a.pass, true)
  assert.equal(a.move, null)
  assert.ok(a.reason.includes('先过') && a.reason.includes('炸弹'), `reason=${a.reason}`)
  assert.equal(keyOfCards(optOf(a, '3333').move.cards), keyOfSpec('3333'))
  assert.ok(optPlan(a, '3333') > 0, 'restPlan>0 才触发这条 pass')
  const s = state(F.e1)
  assert.equal(DDZ.generateMoves(s.hand, s.last.move).length, 1, '唯一解就是炸弹')
  evidence.push(`e1 仅炸弹可压：pass=true，reason=「${a.reason}」，best=3333/score=${optScore(a, '3333')}/restPlan=${optPlan(a, '3333')}`)
})
t('e2 同 e1 但对手剩 2 张 → 必须开炸', () => {
  const a = go(F.e2)
  assert.equal(a.pass, false)
  assert.equal(a.move.type, 'bomb')
  assert.equal(keyOfCards(a.move.cards), keyOfSpec('3333'))
  assert.equal(a.plan, 2)
  assert.ok(a.reason.includes('要动炸弹/王炸了'), `reason=${a.reason}`)
  evidence.push(`e2 urgency 开炸：pass=false、move=3333(bomb)、plan=${a.plan}、reason=「${a.reason}」`)
})
t('e3 跟炸弹只能王炸、非 urgency、restPlan>0 → pass', () => {
  const a = go(F.e3)
  assert.equal(a.pass, true)
  assert.ok(a.reason.includes('先过') && a.reason.includes('王炸'), `reason=${a.reason}`)
  assert.ok(optPlan(a, 'BR') > 0, 'restPlan>0 才触发')
  const s = state(F.e3)
  assert.equal(DDZ.generateMoves(s.hand, s.last.move).length, 1, '唯一解就是王炸')
  evidence.push(`e3 仅王炸可压：pass=true，reason=「${a.reason}」，best=BR/score=${optScore(a, 'BR')}/restPlan=${optPlan(a, 'BR')}`)
})
t('e4 同 e3 但对手剩 2 张 → 必须王炸', () => {
  const a = go(F.e4)
  assert.equal(a.pass, false)
  assert.equal(a.move.type, 'rocket')
  assert.equal(keyOfCards(a.move.cards), keyOfSpec('BR'))
  assert.ok(a.reason.includes('要动炸弹/王炸了'), `reason=${a.reason}`)
  evidence.push(`e4 urgency 王炸：pass=false、move=BR(rocket)、plan=${a.plan}`)
})

/* ---------------- f 拆牌 / 拆炸惩罚 ---------------- */
// 说明：跟「单 3」时单 3 永远 beats 不过单 3，所以「拆 33 的那张 3」根本不会进
// generateMoves——字面意义上的「不拆 33」在跟牌下是空洞的。这里用两处可观测证据覆盖：
//   f1 跟单 3：合法解只有 4/5，选中 5（不拆 44）而非 4（拆 44），分差即拆牌惩罚；
//   f2 领出 334：选中整对 33，单张 3 的得分显著低于 33/4（拆 33 罚分）；
//   f3 领出 33334：单张 3 同时触发 breaksBomb(-24) 与拆牌(-16.5)，得分远低于单 4。
t('f1 跟单 3：优先出不拆对的单张 5，而不是拆 44 的 4', () => {
  const a = go(F.f1)
  assert.equal(a.pass, false)
  assert.equal(a.move.type, 'single')
  assert.equal(keyOfCards(a.move.cards), keyOfSpec('5'), '应选中单 5')
  assert.notEqual(keyOfCards(a.move.cards), keyOfSpec('3'), '选中的不是拆 33 的那张 3')
  assert.ok(a.move.rank !== 3, '绝不拆 33')
  const s = state(F.f1)
  const legal = Array.from(DDZ.generateMoves(s.hand, s.last.move), m => nameOfMove(m)).sort()
  // generateMoves 的数组来自 vm realm，用 Array.from 拷回主 realm 再做 deepEqual，
  // 否则 strict 断言会因跨 realm 原型不同而误报。
  assert.deepEqual(legal, ['4', '5'], '单 3 压不过单 3，合法解只有 4/5')
  assert.ok(optScore(a, '5') > optScore(a, '4'), '不拆对 44 的 5 应优于拆对的 4')
  evidence.push(`f1 跟单 3：选 ${nameOfMove(a.move)}（合法解 ${legal.join(',')}），score(5)=${optScore(a, '5')} > score(4)=${optScore(a, '4')}（拆 44 罚分）`)
})
t('f2 领出 334：选中整对 33，单张 3 因拆 33 被重罚', () => {
  const a = go(F.f2)
  assert.equal(a.pass, false)
  assert.equal(a.move.type, 'pair')
  assert.equal(keyOfCards(a.move.cards), keyOfSpec('33'))
  assert.ok(optScore(a, '3') < optScore(a, '33'), '单张 3 得分应低于整对 33')
  assert.ok(optScore(a, '3') < optScore(a, '4'), '单张 3 得分应低于不拆牌的单 4')
  assert.equal(optPlan(a, '3'), 2, '拆开打要多一手')
  evidence.push(`f2 领出 334：选 33(pair)，score(33)=${optScore(a, '33')} / score(4)=${optScore(a, '4')} / score(3)=${optScore(a, '3')}（拆对罚分），restPlan(3)=${optPlan(a, '3')}`)
})
t('f3 领出 33334：拆炸弹+拆牌双重惩罚，选中单 4 不拆 3333', () => {
  const a = go(F.f3)
  assert.equal(a.pass, false)
  assert.equal(keyOfCards(a.move.cards), keyOfSpec('4'), '应选中单 4')
  const hand = state(F.f3).hand
  assert.equal(DDZ.breaksBomb(hand, DDZ.classify(cardsOf('3'))), true, '单 3 拆炸弹')
  assert.equal(DDZ.breaksBomb(hand, DDZ.classify(cardsOf('3334'))), true, '三带一 3334 拆炸弹')
  assert.ok(optScore(a, '3') < optScore(a, '4'), '拆炸的单 3 应远低于单 4')
  assert.ok(optScore(a, '3333') < optScore(a, '4'), '非残局炸弹本身也有 -20 罚分')
  assert.ok(optScore(a, '3334') < optScore(a, '4'), '拆炸的三带一也低于单 4')
  evidence.push(`f3 领出 33334：选 4；breaksBomb(3)=true、breaksBomb(3334)=true；score(4)=${optScore(a, '4')} > score(3333)=${optScore(a, '3333')} > score(3334)=${optScore(a, '3334')} > score(3)=${optScore(a, '3')}`)
})

/* ---------------- g 一手走完不拆开打 / 领出非 null ---------------- */
t('g1..g3/g5..g8 能一手走完 → plan=0 且出的是走完那手（不拆开打）', () => {
  const expected = {
    g1: '34567', g2: '334455', g3: 'BR',
    g5: '33', g6: '333', g7: '3333', g8: '33344455'
  }
  const seen = []
  for (const [k, spec] of Object.entries(expected)) {
    const a = go(F[k])
    assert.equal(a.pass, false, `${k} 领出必须出牌`)
    assert.ok(a.move, `${k} move 非 null`)
    assert.equal(a.plan, 0, `${k} plan=0`)
    assert.equal(keyOfCards(a.move.cards), keyOfSpec(spec), `${k} 应整手走完，实际 ${nameOfMove(a.move)}`)
    assert.equal(DDZ.total(DDZ.minus(state(F[k]).hand, a.move.cards)), 0, `${k} 确实清空手牌`)
    seen.push(`${k}=${spec}(${a.move.type})`)
  }
  evidence.push(`g 一手走完：${seen.join(' ')}，全部 pass=false/plan=0/整手清空`)
})
t('g4 17 张领出仍非 null，且优先最长的 12 张顺子', () => {
  const a = go(F.g4)
  assert.equal(a.pass, false)
  assert.ok(a.move, '领出永不返回 null')
  assert.equal(keyOfCards(a.move.cards), keyOfSpec('3456789TJQKA'))
  assert.equal(a.move.type, 'straight')
  assert.equal(a.move.len, 12)
  assert.equal(a.plan, 2)
  evidence.push(`g4 17 张领出：pass=false、move=3456789TJQKA(straight/12)、plan=${a.plan}（未拆成单张）`)
})
t('h1 自己座位的 last 视为领出 → 必出牌', () => {
  const a = go(F.h1)
  assert.equal(a.pass, false, 'last.seat===me 时 follows=false，领出不能过')
  assert.ok(a.move)
  evidence.push(`h1 自己座位的 last：pass=false、move=${nameOfMove(a.move)}（按领出处理）`)
})
t('h2 要不起时 pass 且 move=null', () => {
  const a = go(F.h2)
  assert.equal(a.pass, true)
  assert.equal(a.move, null)
  assert.ok(a.reason.includes('要不起'), `reason=${a.reason}`)
  evidence.push(`h2 无合法解：pass=true、move=null、reason=「${a.reason}」`)
})
t('h3 队友出炸弹时不套队友纪律，urgency 下开炸接管', () => {
  const a = go(F.h3)
  assert.equal(a.pass, false, '队友炸弹例外 + urgency 应出牌')
  assert.equal(a.move.type, 'bomb')
  assert.equal(keyOfCards(a.move.cards), keyOfSpec('4444'))
  evidence.push(`h3 队友炸弹(3333)：pass=false、move=4444(bomb)、plan=${a.plan}`)
})

/* ---------------- h 合法性：遍历全部 33 个局面 ---------------- */
t('h 任何 pass=false 的 move 都在 generateMoves(hand,last.move) 内且 beats 成立', () => {
  let checked = 0, passed = 0
  for (const [k, o] of Object.entries(F)) {
    const s = state(o)
    const a = go(o)
    assert.equal(a.tier, 'go', `${k} 应走 go 档`)
    if (a.pass) {
      assert.equal(a.move, null, `${k} pass 时 move 必须为 null`)
      passed++
      continue
    }
    assert.ok(a.move, `${k} 非 pass 必须有 move`)
    const follows = !!(s.last && s.last.seat !== s.me)
    const lm = follows ? s.last.move : null
    const legal = DDZ.generateMoves(s.hand, lm)
    const keys = new Set(legal.map(m => keyOfCards(m.cards)))
    assert.ok(keys.has(keyOfCards(a.move.cards)),
      `${k} 出 ${nameOfMove(a.move)} 不在 generateMoves 里（follows=${follows}）`)
    if (follows) {
      assert.equal(DDZ.beats(a.move, lm), true, `${k} 出的牌必须压得过 last.move`)
    }
    checked++
  }
  assert.ok(checked >= 15, `应覆盖足够多的出牌局面，实际 ${checked}`)
  evidence.push(`h 合法性：${Object.keys(F).length} 个局面 → ${checked} 个出牌（全部在 generateMoves 内且 beats=true）、${passed} 个过牌（move=null）`)
})

console.log('\n--- 8 类局面实际结果 ---')
for (const e of evidence) console.log('  ' + e)
console.log(`\n${pass} 通过，${fail} 失败`)
if (fail) process.exit(1)
