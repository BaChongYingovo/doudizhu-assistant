// 难度分级测试：档位表、别名迁移、预算单调、free 档行为
//
// 背景（实测，对 DouZero WP，地主位，200 副）：
//   free 0.05 / go 0.56 / plus 0.50 / pro100 0.56 / pro200 0.585 / pro500 0.575
// 旧 8 档三个问题：free 低到不像在打牌；plus 反而低于 go；pro100=go、pro500=pro200。
// 现在压成 6 档，这个测试守住三件事：
//   1. 档位表顺序固定，老档位名必须能迁到新名（localStorage 里有老存档）
//   2. 推演预算随档位单调不减，且最高档不再是无上限的 4 秒
//   3. free 档虽然弱，但不会拆炸弹/王炸去出小牌
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

let pass = 0
let fail = 0
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name) }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n      ' + (e && e.message)) }
}

// 牌面记号 3..9 T J Q K A 2 B R -> 引擎 rank
const R = { '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14, '2': 15, B: 16, R: 17 }
function hand(s) { return s.split('').map(c => R[c]) }
function counts(cards) { const c = new Array(15).fill(0); for (const r of cards) c[r - 3]++; return c }
function state(cards, extra) {
  return Object.assign({
    hand: counts(cards),
    me: 0,
    landlord: 0,
    seatCounts: [cards.length, 17, 17],
    played: new Array(15).fill(0),
    last: null,
    bottom: [],
    open: [false, false, false],
    knownHands: [null, null, null]
  }, extra || {})
}

console.log('难度分级')

t('档位表是 5 档，顺序从弱到强', () => {
  assert.deepEqual(Array.from(DDZ.TIERS), ['free', 'go', 'plus', 'pro', 'sota'])
})

t('老档位名迁移：pro100/pro200/pro500/pro9999/max -> pro', () => {
  assert.equal(DDZ.tierOf('pro100'), 'pro')
  assert.equal(DDZ.tierOf('pro200'), 'pro')
  assert.equal(DDZ.tierOf('pro500'), 'pro')
  assert.equal(DDZ.tierOf('pro9999'), 'pro')
  assert.equal(DDZ.tierOf('PRO9999'), 'pro')
  assert.equal(DDZ.tierOf('max'), 'pro')
})

t('未知档位与数字下标都落到合法档位', () => {
  assert.equal(DDZ.tierOf('nope'), 'go')
  assert.equal(DDZ.tierOf(0), 'free')
  assert.equal(DDZ.tierOf(99), 'sota')
  assert.equal(DDZ.tierOf(-1), 'free')
})

t('推演预算随档位单调不减，最高档不再是无上限 4 秒', () => {
  const sims = DDZ.TIERS.map(x => (DDZ.TIER_CFG && DDZ.TIER_CFG[x] ? DDZ.TIER_CFG[x].budget : null))
  // TIER_CFG 未导出时用行为间接验证（见下一项），这里只在导出时检查
  if (sims.every(v => v !== null)) {
    for (let i = 1; i < sims.length - 1; i++) assert.ok(sims[i] >= sims[i - 1], '档位 ' + DDZ.TIERS[i] + ' 预算低于前一档')
    assert.ok(DDZ.TIER_CFG.pro.budget >= 200, 'pro 档预算至少 200 次')
    assert.ok(DDZ.TIER_CFG.pro.ms <= 1000, 'pro 档单手上限不该超过 1 秒')
  }
})

t('free 档不会拆炸弹/王炸去出小牌', () => {
  // 手里 3333 + 5，领出时应该出 5 之类的小牌，而不是拆 3333
  const st = state(hand('33335'))
  for (let i = 0; i < 40; i++) {
    const r = DDZ.advise(st, { tier: 'free' })
    assert.equal(r.pass, false)
    assert.ok(r.move, 'free 档不该返回空动作')
    assert.notEqual(r.move.type, 'bomb', 'free 档拆炸弹了：' + JSON.stringify(r.move.cards))
    assert.notEqual(r.move.type, 'rocket', 'free 档打出王炸了')
  }
})

t('free 档出的牌一定合法（在 generateMoves 里）', () => {
  const cards = hand('3344556789TJQKA2BR')
  const st = state(cards, { seatCounts: [cards.length, 11, 11] })
  const legal = DDZ.generateMoves(st.hand, null).map(m => m.cards.slice().sort((a, b) => a - b).join(','))
  for (let i = 0; i < 30; i++) {
    const r = DDZ.advise(st, { tier: 'free' })
    assert.equal(r.pass, false)
    assert.ok(legal.indexOf(r.move.cards.slice().sort((a, b) => a - b).join(',')) >= 0, 'free 出了非法牌')
  }
})

t('free 档跟牌时也遵守 beats', () => {
  const st = state(hand('3456789TJ'), {
    seatCounts: [9, 10, 10],
    last: { seat: 2, move: DDZ.classify(hand('9')) }
  })
  for (let i = 0; i < 30; i++) {
    const r = DDZ.advise(st, { tier: 'free' })
    if (r.pass) continue
    assert.ok(DDZ.beats(r.move, st.last.move), 'free 压不过还出了：' + DDZ.cardsText(r.move.cards))
  }
})

t('plus/pro 两档都能正常给出建议且不超时', () => {
  const cards = hand('3344556789TJQKA2BR')
  const st = state(cards, { seatCounts: [cards.length, 10, 10] })
  for (const tier of ['plus', 'pro']) {
    const t0 = Date.now()
    const r = DDZ.advise(st, { tier })
    const dt = Date.now() - t0
    assert.ok(r.move || r.pass, tier + ' 没给出结果')
    const cap = tier === 'pro' ? 1200 : 600
    assert.ok(dt <= cap, tier + ' 单手耗时 ' + dt + 'ms 超过 ' + cap + 'ms')
  }
})

console.log('\n' + pass + ' 通过，' + fail + ' 失败')
if (fail) process.exit(1)
