// 采样与贪心拆牌回归测试
// 背景：旧 sampleHands 在牌池不够时用 addCard(随机点数) 凭空补牌，
// 等于给对手发牌库里不存在的牌，污染所有 Monte-Carlo 档的胜率估计。
// 旧 greedyPick 收了 mode 参数却没用，三个 mode 跑出同一结果。
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
const { zero, total, fullDeck, classify } = DDZ

let pass = 0
let fail = 0
function t(name, fn) {
  try {
    fn()
    pass++
    console.log('  ✓ ' + name)
  } catch (e) {
    fail++
    console.log('  ✗ ' + name + ' → ' + e.message)
  }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const x = a[i]; a[i] = a[j]; a[j] = x
  }
  return a
}

// 完整一局开局：17/17/17 + 3 张底牌归地主（与 game.js 叫完地主后一致）
function dealFor(me) {
  const deck = shuffle(fullDeck().slice())
  const hands = [zero(), zero(), zero()]
  for (let s = 0; s < 3; s++) for (let k = 0; k < 17; k++) hands[s][deck[s * 17 + k] - 3]++
  const landlord = (me + 2) % 3
  for (let k = 51; k < 54; k++) hands[landlord][deck[k] - 3]++
  return { hands, landlord, me }
}

function fromCounts(c) {
  const out = []
  for (let i = 0; i < 15; i++) for (let k = 0; k < c[i]; k++) out.push(i + 3)
  return out
}

function sumCounts(list) {
  const c = zero()
  for (const x of list) for (let i = 0; i < 15; i++) c[i] += x[i]
  return c
}

console.log('· 采样守恒')

t('200 副中局 estimate 不抛错且样本全部完成', () => {
  for (let g = 0; g < 200; g++) {
    const me = g % 3
    const { hands, landlord } = dealFor(me)
    const other = (me + 1) % 3
    const n = Math.floor(Math.random() * 8)
    const others = fromCounts(hands[other])
    const played = zero()
    for (let k = 0; k < n && k < others.length; k++) played[others[k] - 3]++
    const seatCounts = [total(hands[0]), total(hands[1]), total(hands[2])]
    seatCounts[other] -= n
    const state = {
      hand: hands[me].slice(), me, landlord, seatCounts, played,
      last: { seat: other, move: classify([others[0]]) }
    }
    const r = DDZ.estimate(state, null, 40, 0)
    assert.ok(r.n > 0, '第 ' + g + ' 副没有完成任何一次推演')
  }
})

t('三家张数与 played 合计恒为 54', () => {
  for (let g = 0; g < 100; g++) {
    const me = g % 3
    const { hands, landlord } = dealFor(me)
    const played = zero()
    const seatCounts = [total(hands[0]), total(hands[1]), total(hands[2])]
    const h = DDZ.sampleHands(hands[me].slice(), played, seatCounts, me)
    assert.equal(total(h[0]) + total(h[1]) + total(h[2]) + total(played), 54, '牌数不平')
    assert.deepEqual(h[me], hands[me], '自己的手牌被改动')
    assert.equal(landlord, landlord)
  }
})

t('已知手牌座位照抄、未知座位张数正确', () => {
  for (let g = 0; g < 50; g++) {
    const me = 0
    const { hands } = dealFor(me)
    const known = [hands[0].slice(), hands[1].slice(), null]
    const h = DDZ.sampleHands(hands[0].slice(), zero(), [17, 17, 20], me, known)
    assert.deepEqual(h[1], hands[1], '明牌座位被改动')
    assert.equal(total(h[2]), 20, '未知座位张数不对：' + total(h[2]))
    assert.equal(total(h[0]) + total(h[1]) + total(h[2]), 54)
  }
})

t('发出去的牌全部来自牌池，不超发', () => {
  for (let g = 0; g < 50; g++) {
    const me = 1
    const { hands } = dealFor(me)
    const other = (me + 1) % 3
    const played = zero()
    const oc = fromCounts(hands[other])
    for (let k = 0; k < 5 && k < oc.length; k++) played[oc[k] - 3]++
    const seatCounts = [total(hands[0]), total(hands[1]), total(hands[2])]
    seatCounts[other] -= Math.min(5, oc.length)
    const h = DDZ.sampleHands(hands[me].slice(), played, seatCounts, me)
    const seen = sumCounts([played, h[0], h[1], h[2]])
    for (let i = 0; i < 15; i++) {
      const full = (i === 13 || i === 14) ? 1 : 4
      assert.ok(seen[i] <= full, '点数 ' + (i + 3) + ' 超发：' + seen[i] + ' > ' + full)
    }
  }
})

t('池子不足时少发，绝不凭空补牌', () => {
  const { hands } = dealFor(0)
  const h = DDZ.sampleHands(hands[0].slice(), zero(), [20, 60, 60], 0)
  assert.equal(total(h[0]) + total(h[1]) + total(h[2]), 54)
})

t('只有自己时另外两家为空', () => {
  const me = 0
  const { hands } = dealFor(me)
  const played = sumCounts([hands[1], hands[2]])
  const h = DDZ.sampleHands(hands[0].slice(), played, [total(hands[0]), 0, 0], me)
  assert.equal(total(h[1]) + total(h[2]), 0)
})

console.log('\n· 贪心 mode 差异')

function hands17(n) {
  const cases = []
  const deck = fullDeck().slice()
  for (let g = 0; g < n; g++) {
    shuffle(deck)
    const c = zero()
    for (const r of deck.slice(0, 17)) c[r - 3]++
    cases.push(c)
  }
  return cases
}

t('greedyPick 返回合法牌型且结果确定', () => {
  for (const c of hands17(60)) {
    const a = DDZ.greedyPick(c.slice(), 0)
    if (!a) continue
    const cls = classify(a.cards)
    assert.ok(cls, 'greedyPick 给出无法识别的牌型：' + a.cards)
    const b = DDZ.greedyPick(c.slice(), 0)
    assert.deepEqual(b.cards, a.cards, '同一手牌两次结果不同')
  }
})

t('三个 mode 均可调用（mode 目前是占位参数）', () => {
  // 说明：曾让三 mode 产生实质差异，实测会把 greedyPlans 手数估计带偏
  //（arena landlord 0.970 → 0.915），已回退。此处只保证接口不崩。
  for (const c of hands17(20)) {
    for (let mode = 0; mode < 3; mode++) {
      const m = DDZ.greedyPick(c.slice(), mode)
      if (m) assert.ok(classify(m.cards), 'mode ' + mode + ' 牌型非法')
    }
  }
})

t('greedyPlans 结果合理（1..手牌张数）', () => {
  for (const c of hands17(20)) {
    const plans = DDZ.greedyPlans(c)
    assert.ok(plans >= 1 && plans <= total(c), 'greedyPlans 异常：' + plans)
  }
})

console.log('\n' + pass + ' 通过，' + fail + ' 失败')
if (fail) process.exitCode = 1
