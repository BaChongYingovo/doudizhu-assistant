// 出牌生成 / 牌型识别回归测试
// 口径：research/dist/rlcard-1.2.0/rlcard/games/doudizhu 的 card_type.json + judger.py
//   - 三带一/三带二翅膀：judger.playable_cards_from_hand 用 non_zero_indexes / more_than_1_indexes，
//     不走 solo_attachments，所以 2 / 单王都能带。
//   - 四带二：单翅膀允许同点成对（最多 3 张），双王(小王+大王)同时带不合法；
//     四带两对必须是两个不同点数对。
//   - 飞机带单：solo_attachments 允许同点最多 3 张；邻接主体的点数最多 2 张（'2' 例外）；
//     双王不能同时当翅膀。
//   - 顺子 len 5..12、连对 len 3..10，且 2 / 大小王不能进顺子（chain_indexes 在 index>=12 断开）。
// 字符串记号：3..9 T J Q K A 2 B(小王) R(大王)，每个字符一张牌。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import assert from 'node:assert/strict'

// 插件包是 "type": "module"，src 里的 UMD 文件不能直接 require，
// 用最小的 CJS 上下文跑一遍拿 exports（与 game.test.mjs 一致）。
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
const cardsOf = spec => spec.split('').map(ch => {
  const r = CH[ch]
  assert.ok(r, `未知牌面字符 ${ch}`)
  return r
})
const keyOf = spec => cardsOf(spec).slice().sort((a, b) => a - b).join(',')
const movesOf = hand => new Set(
  DDZ.generateMoves(DDZ.countsOf(cardsOf(hand)), null)
    .map(m => m.cards.slice().sort((a, b) => a - b).join(','))
)

let pass = 0, fail = 0
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.log('FAIL', name, '::', e.message) }
}

// 合法：classify 必须给出精确牌型/长度/主体点数，且该动作能从"恰好这些牌"的手牌里生成。
function legal(spec, type, len, rank, rlcard) {
  t(`${spec} → ${type}/${len}/${rank}（${rlcard}）`, () => {
    const m = DDZ.classify(cardsOf(spec))
    assert.ok(m, `${spec} 应可识别，实际 null`)
    assert.equal(m.type, type, `${spec} 牌型`)
    assert.equal(m.len, len, `${spec} 长度`)
    assert.equal(m.rank, rank, `${spec} 主体点数`)
    assert.ok(movesOf(spec).has(keyOf(spec)), `${spec} 应出现在 generateMoves`)
  })
}

// 非法：classify 必须返回 null，且 generateMoves 不得产出该动作。
function illegal(spec, why) {
  t(`${spec} 非法（${why}）`, () => {
    assert.equal(DDZ.classify(cardsOf(spec)), null, `${spec} 不应被识别`)
    assert.ok(!movesOf(spec).has(keyOf(spec)), `${spec} 不应出现在 generateMoves`)
  })
}

/* ---------------- 三带一 / 三带二翅膀 ---------------- */
legal('3332', 'trio1', 1, 3, 'trio_solo：带 2')
legal('333B', 'trio1', 1, 3, 'trio_solo：带小王')
legal('333R', 'trio1', 1, 3, 'trio_solo：带大王')
legal('4443', 'trio1', 1, 4, 'trio_solo：带牌比三张主体小')
legal('33322', 'trio2', 1, 3, 'trio_pair：带 22')

/* ---------------- 四带二 / 四带两对 ---------------- */
legal('333344', 'four2', 1, 3, 'four_two_solo：带同点成对')
legal('3333B5', 'four2', 1, 3, 'four_two_solo：带小王 + 单张')
legal('3333R5', 'four2', 1, 3, 'four_two_solo：带大王 + 单张')
legal('33334455', 'four2pair', 1, 3, 'four_two_pair：两个不同对')
illegal('3333BR', '四带二禁止带双王')
illegal('33334444', '四带二翅膀不能是四张（炸弹）')

/* ---------------- 飞机带单 / 带对 ---------------- */
legal('33344455', 'plane1', 2, 3, 'trio_solo_chain_2')
legal('33344456', 'plane1', 2, 3, 'trio_solo_chain_2：不同点数单翅膀')
legal('333444B8', 'plane1', 2, 3, 'trio_solo_chain_2：单小王合法')
legal('333444R8', 'plane1', 2, 3, 'trio_solo_chain_2：单大王合法')
legal('333444555888', 'plane1', 3, 3, 'trio_solo_chain_3：单翅膀为三张同点')
legal('333444555777', 'plane1', 3, 3, 'trio_solo_chain_3：三张同点翅膀')
legal('QQQKKKAAA222', 'plane1', 3, 12, 'trio_solo_chain_3：222 邻接例外')
legal('333444555666', 'plane', 4, 3, 'trio_chain_4：不带翅膀')
legal('3334445556662228', 'plane1', 4, 3, 'trio_solo_chain_4：222 例外')
legal('3334445556667788', 'plane1', 4, 3, 'trio_solo_chain_4')
legal('3334445566', 'plane2', 2, 3, 'trio_pair_chain_2')
illegal('333444BR', '飞机带单禁止双王翅膀')
illegal('333444555BR8', '飞机带单禁止双王翅膀')
illegal('3334445556667778', '飞机邻接主体的点数不能带 3 张')
illegal('3334445556667779', '飞机邻接主体的点数不能带 3 张')
illegal('3334445556667777', '单翅膀同点最多 3 张')
illegal('33344455566677778899', '单翅膀同点最多 3 张')
illegal('3334445556662222', '单翅膀同点最多 3 张（2 也只是最多 3 张）')
illegal('333444555666778899', '带对翅膀不能凑成单牌混搭')

/* ---------------- 顺子 / 连对边界 ---------------- */
legal('34567', 'straight', 5, 3, 'solo_chain_5：最短顺子')
legal('3456789TJQKA', 'straight', 12, 3, 'solo_chain_12：最长顺子，止于 A')
legal('456789TJQKA', 'straight', 11, 4, 'solo_chain_11')
legal('334455', 'pairseq', 3, 3, 'pair_chain_3：最短连对')
legal('TTJJQQKKAA', 'pairseq', 5, 10, 'pair_chain_5')
legal('33445566778899TTJJQQ', 'pairseq', 10, 3, 'pair_chain_10：最长连对')
legal('5566778899TTJJQQKKAA', 'pairseq', 10, 5, 'pair_chain_10：止于 A')
illegal('3456', '顺子最少 5 张')
illegal('3456789TJQKA2', '顺子不能含 2')
illegal('3344', '连对最少 3 对')
illegal('AA22', '连对不能含 2')
illegal('66778899TTJJQQKKAA22', '连对不能含 2')
illegal('445566778899TTJJQQKKAA22', '连对不能含 2')

/* ---------------- generateMoves 边界（超集手牌） ---------------- */
t('含 2 的手牌只生成止于 A 的顺子', () => {
  const mv = movesOf('3456789TJQKA2')
  assert.ok(mv.has(keyOf('3456789TJQKA')), '应生成 3..A 的 12 张顺子')
  assert.ok(mv.has(keyOf('456789TJQKA')), '应生成 4..A 的 11 张顺子')
  assert.ok(!mv.has(keyOf('3456789TJQKA2')), '不应生成含 2 的 13 张顺子')
})
t('含 22 的手牌只生成止于 A 的连对', () => {
  const mv = movesOf('33445566778899TTJJQQKKAA22')
  assert.ok(mv.has(keyOf('33445566778899TTJJQQ')), '应生成 3..T 的 10 连对')
  assert.ok(mv.has(keyOf('5566778899TTJJQQKKAA')), '应生成 5..A 的 10 连对')
  assert.ok(!mv.has(keyOf('66778899TTJJQQKKAA22')), '不应生成含 22 的连对')
  assert.ok(!mv.has(keyOf('445566778899TTJJQQKKAA22')), '不应生成含 22 的连对')
})

console.log(`${pass} 通过，${fail} 失败`)
if (fail) process.exit(1)
