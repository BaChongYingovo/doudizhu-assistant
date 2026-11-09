// DouZero (WP) 推理：把本引擎的局面编码成 DouZero 的 (z, x)，再用 onnxruntime-node 打分。
// 编码规则逐行对齐 research/dist/DouZero-main/douzero/env/env.py 的 get_obs()。
//
// 牌值映射：本引擎 3..15(3..2) / 16(小王) / 17(大王)
//          DouZero 3..14(3..A) / 17(2) / 20(小王) / 30(大王)
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export const CARD_COL = (r) => (r <= 14 ? r - 3 : r === 15 ? 12 : -1)

// 54 维：4x13 的牌面矩阵按列展平（flatten('F')）+ 2 维大小王
export function cards2array(counts) {
  const out = new Float32Array(54)
  for (let i = 0; i < 15; i++) {
    const n = counts[i] || 0
    if (!n) continue
    const rank = i + 3
    if (rank <= 15) {
      const col = CARD_COL(rank)
      for (let k = 0; k < n && k < 4; k++) out[col * 4 + k] = 1
    } else if (rank === 16) out[52] = 1
    else if (rank === 17) out[53] = 1
  }
  return out
}

export function countsOfCards(cards) {
  const c = new Array(15).fill(0)
  for (const r of cards) c[r - 3]++
  return c
}

// 一次 54 维 -> 直接给 counts 版本
export function counts2array(counts) { return cards2array(counts) }

function oneHot(value, max) {
  const v = new Float32Array(max)
  const i = value - 1
  if (i >= 0 && i < max) v[i] = 1
  return v
}

// z: 最近 15 手（不足前补零），每 3 手拼成 162 维，得到 5x162
export function encodeZ(history) {
  const seq = history.slice(-15).map((h) => cards2array(h.counts))
  while (seq.length < 15) seq.unshift(cards2array(new Array(15).fill(0)))
  const z = new Float32Array(5 * 162)
  for (let step = 0; step < 5; step++) {
    for (let k = 0; k < 3; k++) {
      const a = seq[step * 3 + k]
      z.set(a, step * 162 + k * 54)
    }
  }
  return z
}

// x 里不含候选动作的那部分：landlord 319 维 / 农民 430 维
export function encodeBase(ctx) {
  const { position, myCounts, otherCounts, playedCounts, lastCounts,
    lastLandlordCounts, lastTeammateCounts, numLeft, bombNum } = ctx
  const parts = []
  const push = (arr) => parts.push(arr)
  push(cards2array(myCounts))
  push(cards2array(otherCounts))
  if (position === 'landlord') {
    push(cards2array(lastCounts))
    push(cards2array(playedCounts.landlord_up))
    push(cards2array(playedCounts.landlord_down))
    push(oneHot(numLeft.landlord_up, 17))
    push(oneHot(numLeft.landlord_down, 17))
  } else {
    push(cards2array(playedCounts.landlord))
    push(cards2array(playedCounts.teammate))
    push(cards2array(lastCounts))
    push(cards2array(lastLandlordCounts))
    push(cards2array(lastTeammateCounts))
    push(oneHot(numLeft.landlord, 20))
    push(oneHot(numLeft.teammate, 17))
  }
  const bomb = new Float32Array(15)
  bomb[bombNum] = 1
  push(bomb)
  return concat(parts)
}

// position: 'landlord' | 'landlord_up' | 'landlord_down'
// 返回每条候选动作一行的 x（Float32Array），维度 373 / 484
export function encodeX(ctx, legalCounts) {
  const base = encodeBase(ctx)
  const dim = base.length + 54
  const rows = new Float32Array(legalCounts.length * dim)
  legalCounts.forEach((c, i) => {
    rows.set(base, i * dim)
    rows.set(cards2array(c), i * dim + base.length)
  })
  return { rows, dim }
}

function concat(parts) {
  const n = parts.reduce((s, p) => s + p.length, 0)
  const out = new Float32Array(n)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

export class DouZeroPolicy {
  constructor(opts = {}) {
    this.dir = opts.dir || path.join(HERE, 'models', 'douzero_WP')
    this.sessions = new Map()
    this.ort = null
  }

  async _session(position) {
    if (!this.ort) this.ort = (await import('onnxruntime-node')).default
    if (!this.sessions.has(position)) {
      const file = path.join(this.dir, `${position}.onnx`)
      this.sessions.set(position, await this.ort.InferenceSession.create(file))
    }
    return this.sessions.get(position)
  }

  // legal: 每个候选动作的 counts；返回 {index, scores}
  async rank(position, ctx, legalCounts) {
    const sess = await this._session(position)
    const { rows, dim } = encodeX(ctx, legalCounts)
    const n = legalCounts.length
    const z = encodeZ(ctx.history)
    const zBatch = new Float32Array(n * 5 * 162)
    for (let i = 0; i < n; i++) zBatch.set(z, i * 5 * 162)
    const feeds = {
      z: new this.ort.Tensor('float32', zBatch, [n, 5, 162]),
      x: new this.ort.Tensor('float32', rows, [n, dim])
    }
    const out = await sess.run(feeds)
    const values = out.values.data
    let best = 0
    for (let i = 1; i < n; i++) if (values[i] > values[best]) best = i
    return { index: best, scores: Array.from(values) }
  }
}
