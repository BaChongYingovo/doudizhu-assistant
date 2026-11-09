/**
 * sota 档自测：纯 JS 前向 vs onnxruntime-node（对齐基准），权重下载/校验，引擎接线。
 *
 *   node test/sota.test.mjs
 *
 * 依赖 ai/models/douzero_WP/*.onnx 与 ai/node_modules/onnxruntime-node；
 * 缺了就跳过数值对齐那一段（下载/接线测试照跑），不算失败。
 */
import fs from 'node:fs'
import path from 'node:path'
import { webcrypto } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(root, '..', '..')
const modelDir = path.join(repo, 'ai', 'models', 'douzero_WP')

let failures = 0
function ok(cond, name, extra) {
  if (cond) console.log('  ✓ ' + name)
  else { failures++; console.error('  ✗ ' + name + (extra ? ' — ' + extra : '')) }
}

/* ---------------- 加载 src/sota.js（与 build.mjs 嵌入的是同一份） ---------------- */
const sotaCode = fs.readFileSync(path.join(root, 'src', 'sota.js'), 'utf8')

function loadSota(env) {
  const shim = { exports: {} }
  const fn = new Function('module', 'exports', 'window', 'fetch', 'crypto', 'caches', 'TextDecoder', 'console',
    sotaCode + '\n;return module.exports')
  return fn(shim, shim.exports, undefined, env.fetch, env.crypto || webcrypto, env.caches, TextDecoder, console)
}

/* ---------------- 1. ONNX 解析 =--------------- */
const landlordBytes = fs.readFileSync(path.join(modelDir, 'landlord.onnx'))
const SOTA = loadSota({ fetch: async () => { throw new Error('测试不联网') } })

console.log('ONNX 解析')
const tensors = SOTA.parseOnnx(new Uint8Array(landlordBytes))
const names = Object.keys(tensors).sort()
ok(names.length === 15, 'landlord.onnx 解出 15 个权重张量', JSON.stringify(names))
ok(names.includes('base.dense1.weight') && names.includes('onnx::LSTM_133'), '层名与 DouZero 一致')
const t1 = tensors['base.dense1.weight']
ok(t1 && t1.dims.join('x') === '512x501', 'dense1 权重是 512×501（LSTM 128 + 地主 373）', t1 && t1.dims.join('x'))

const model = SOTA.loadFromBytes(new Uint8Array(landlordBytes))
ok(!!model && SOTA.ready(), 'loadFromBytes 后状态为 ready')

/* ---------------- 2. 数值对齐 onnxruntime ---------------- */
function makeCtx(position, seed) {
  let s = seed >>> 0
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const zero = () => new Array(15).fill(0)
  // 一副 54 张，洗牌后 17/17/17 发完，余 3 张做历史帧
  const deck = []
  for (let r = 0; r < 13; r++) for (let k = 0; k < 4; k++) deck.push(r)
  deck.push(13); deck.push(14)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const t = deck[i]; deck[i] = deck[j]; deck[j] = t
  }
  const hands = [zero(), zero(), zero()]
  for (let i = 0; i < 51; i++) hands[i % 3][deck[i]]++
  const history = []
  for (let i = 0; i < 6; i++) {
    const f = zero()
    f[deck[51 + (i % 3)]]++
    history.push({ counts: f })
  }
  const played = zero()
  for (const f of history) for (let r = 0; r < 15; r++) played[r] += f.counts[r]
  const myCounts = hands[0]
  const other = zero()
  const full = new Array(15).fill(4); full[13] = 1; full[14] = 1
  for (let r = 0; r < 15; r++) other[r] = Math.max(0, full[r] - myCounts[r] - played[r])
  const base = {
    myCounts, otherCounts: other, lastCounts: history[history.length - 1].counts,
    bombNum: 1, history
  }
  if (position === 'landlord') {
    return Object.assign(base, {
      position,
      playedCounts: { landlord_up: history[1].counts, landlord_down: history[2].counts },
      numLeft: { landlord_up: 11, landlord_down: 9 }
    })
  }
  return Object.assign(base, {
    position,
    playedCounts: { landlord: history[3].counts, teammate: history[4].counts },
    lastLandlordCounts: history[3].counts,
    lastTeammateCounts: history[4].counts,
    numLeft: { landlord: 6, teammate: 12 }
  })
}

function makeActions(seed) {
  let s = seed >>> 0
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296)
  const out = []
  for (let i = 0; i < 12; i++) {
    const c = new Array(15).fill(0)
    const r = Math.floor(rnd() * 15)
    c[r] = 1 + Math.floor(rnd() * (r === 13 || r === 14 ? 1 : 3))
    out.push(c)
  }
  out.push(new Array(15).fill(0)) // 过牌那一行
  return out
}

console.log('数值对齐（纯 JS 前向 vs onnxruntime-node）')
let ort = null
try {
  // onnxruntime-node 装在 ai/ 下，插件测试目录里没有，用 createRequire 从 ai/package.json 解析
  const { createRequire } = await import('node:module')
  const req = createRequire(path.join(repo, 'ai', 'package.json'))
  ort = req('onnxruntime-node')
} catch (e) {
  console.log('  · 跳过：没装 onnxruntime-node（' + (e && e.message) + '）')
}
if (ort) {
  const o = ort.default || ort
  for (const position of ['landlord', 'landlord_up']) {
    const file = path.join(modelDir, position + '.onnx')
    if (!fs.existsSync(file)) { console.log('  · 跳过 ' + position + '：没有权重文件'); continue }
    const bytes = fs.readFileSync(file)
    const sess = await o.InferenceSession.create(file)
    // 纯 JS 侧换成同一个模型
    SOTA.loadFromBytes(new Uint8Array(bytes))
    let worst = 0
    let argmaxSame = 0
    let trials = 0
    for (let k = 1; k <= 5; k++) {
      const ctx = makeCtx(position === 'landlord' ? 'landlord' : 'landlord_up', k * 7919)
      const actions = makeActions(k * 104729)
      const mine = SOTA.rank(ctx, actions)
      // 用与 onnxruntime 完全同构的编码器（这里直接复用 sota 的 encodeX/encodeZ 会被怀疑自证，
      // 所以把同一批输入喂给 ort：编码一致性的另一层保障是 ai/test-encoder.mjs）
      const { rows, dim } = SOTA.encodeX(ctx, actions)
      const n = actions.length
      const z = SOTA.encodeZ(ctx.history)
      const zBatch = new Float32Array(n * 5 * 162)
      for (let i = 0; i < n; i++) zBatch.set(z, i * 5 * 162)
      const res = await sess.run({
        z: new o.Tensor('float32', zBatch, [n, 5, 162]),
        x: new o.Tensor('float32', rows, [n, dim])
      })
      const ref = res.values.data
      for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(ref[i] - mine.scores[i]))
      let best = 0
      for (let i = 1; i < n; i++) if (ref[i] > ref[best]) best = i
      if (best === mine.index) argmaxSame++
      trials++
    }
    ok(trials === 5, position + '：跑了 5 组对比', String(trials))
    ok(worst < 1e-4, position + '：逐动作分值最大误差 < 1e-4', 'worst=' + worst.toExponential(2))
    ok(argmaxSame === trials, position + '：argmax 与 onnxruntime 完全一致', argmaxSame + '/' + trials)
  }
}

/* ---------------- 3. 下载 + sha256 + 缓存 ---------------- */
console.log('权重下载')
function fakeFetch(bytes, opt) {
  const o = opt || {}
  const buf = new Uint8Array(bytes)
  if (o.tamper) buf[buf.length - 1] ^= 0xff
  const failHosts = o.failHosts || []
  return async (url) => {
    const host = String(url).split('/')[2]
    if (failHosts.indexOf(host) >= 0) throw new Error('连不上 ' + host)
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => (k === 'content-length' ? String(buf.length) : null) },
      body: {
        getReader() {
          let off = 0
          return {
            read: async () => {
              if (off >= buf.length) return { done: true, value: undefined }
              const size = Math.min(1 << 20, buf.length - off)
              const chunk = buf.subarray(off, off + size)
              off += size
              return { done: false, value: chunk }
            }
          }
        }
      },
      arrayBuffer: async () => buf.buffer
    }
  }
}

const progressSeen = []
const S2 = loadSota({ fetch: fakeFetch(landlordBytes) })
S2.onStatus((s) => progressSeen.push(s.progress))
const dlOk = await S2.load().then(() => true).catch(() => false)
ok(dlOk && S2.ready(), '按清单地址下载后 ready')
ok(progressSeen.some((p) => p > 0 && p < 1), '下载过程有中间进度回报', JSON.stringify(progressSeen.slice(0, 5)))
ok(S2.status().progress === 1, '完成后进度为 1')

const S3 = loadSota({ fetch: fakeFetch(landlordBytes, { tamper: true }) })
const dlBad = await S3.load().then(() => true).catch(() => false)
ok(dlBad === false, '字节被改动 → 拒绝加载')
ok(S3.status().status === 'error' && /sha256|体积/.test(S3.status().error || ''), '错误状态与原因写清楚', S3.status().error)

const S4 = loadSota({ fetch: async () => ({ ok: false, status: 404, headers: { get: () => null } }) })
const dl404 = await S4.load().then(() => true).catch(() => false)
ok(dl404 === false && /404/.test(S4.status().error || ''), 'HTTP 404 报错不吞', S4.status().error)

// 国内直连 huggingface.co 基本连不上，必须能自动切镜像（本机实测：hf-mirror.com 通）
const S5 = loadSota({ fetch: fakeFetch(landlordBytes, { failHosts: ['huggingface.co'] }) })
const dlMirror = await S5.load().then(() => true).catch(() => false)
ok(dlMirror && S5.ready(), '官方站连不上时自动切镜像')
ok(/hf-mirror/.test(S5.status().source || ''), '记录实际用上的源', S5.status().source)

const S6 = loadSota({ fetch: fakeFetch(landlordBytes, { failHosts: ['huggingface.co', 'hf-mirror.com'] }) })
const dlNone = await S6.load().then(() => true).catch(() => false)
ok(dlNone === false && /huggingface\.co/.test(S6.status().error || '') && /hf-mirror/.test(S6.status().error || ''),
  '全部源失败时把每个源的原因都报出来', S6.status().error)

/* ---------------- 4. 引擎接线：sota 档真的会用模型 ---------------- */
console.log('引擎接线')
function loadSrc(rel) {
  const code = fs.readFileSync(path.join(root, 'src', rel), 'utf8')
  const shim = { exports: {} }
  new Function('module', 'exports', 'window', code)(shim, shim.exports, undefined)
  return shim.exports
}
const DDZ = loadSrc('engine.js')
const GC = loadSrc('game.js')
const G = GC.GameCore(DDZ)

ok(DDZ.TIERS.indexOf('sota') >= 0, 'sota 在档位表里', JSON.stringify(DDZ.TIERS))
ok(DDZ.tierOf('sota') === 'sota', 'tierOf 认 sota')
ok(DDZ.advise({ hand: DDZ.parseCards('3 4 5 6 7'), last: null, seatCounts: [5, 9, 9], played: new Array(15).fill(0) }, { tier: 'sota' }).fallback === true,
  '没注入推理钩子时 sota 档回退启发式并标记 fallback')

SOTA.loadFromBytes(new Uint8Array(landlordBytes))
const calls = { landlord: 0, farmer: 0 }
const origRank = SOTA.rank
DDZ.setSotaRank((ctx, actions) => {
  if (ctx.position === 'landlord') calls.landlord++
  else calls.farmer++
  return origRank(ctx, actions)
})
ok(DDZ.sotaAvailable(), 'setSotaRank 后 sotaAvailable() 为真')

function playGame() {
  calls.landlord = 0
  calls.farmer = 0
  let threw = null
  let guard = 0
  const g = G.createGame({ mode: 'score', tiers: ['sota', 'sota', 'sota'] })
  try {
    while (g.phase === 'bid' && guard++ < 20) {
      const seat = G.bidSeat(g)
      G.applyBid(g, seat, G.aiBid(g, seat))
    }
    if (g.phase === 'double') {
      for (let s = 0; s < 3; s++) G.applyDouble(g, s, s === 0 ? 2 : G.aiDouble(g, s))
    }
    guard = 0
    while (g.phase === 'play' && guard++ < 400) {
      const seat = g.turn
      const legal = G.legalMoves(g, seat)
      const mv = G.aiMove(g, seat)
      if (mv && mv.move) G.applyPlay(g, seat, mv.move.cards)
      else if (legal.canPass) G.applyPass(g, seat)
      else G.applyPlay(g, seat, legal.moves[0].cards)
    }
  } catch (e) { threw = e }
  return { g, threw, guard, calls: { landlord: calls.landlord, farmer: calls.farmer } }
}

const run1 = playGame()
ok(!run1.threw, 'sota 档整局跑完不抛异常', run1.threw && run1.threw.message)
ok(run1.g.phase === 'over', '整局真的结束了（没有死循环）', 'phase=' + run1.g.phase + ' steps=' + run1.guard)
ok(run1.calls.landlord > 0, '地主位确实走了 DouZero', JSON.stringify(run1.calls))
ok(run1.calls.farmer === 0, '农民位默认不调用模型（按实测回退启发式）', JSON.stringify(run1.calls))

DDZ.setSotaFarmer(true)
const run2 = playGame()
ok(!run2.threw && run2.g.phase === 'over', '强制农民位走 DouZero 也能整局跑完', run2.threw && run2.threw.message)
ok(run2.calls.farmer > 0, 'setSotaFarmer(true) 后农民位会调用模型', JSON.stringify(run2.calls))
DDZ.setSotaFarmer(false)

// 农民位默认策略：真模型仍在农民位被调用（由 SOTA.md 的实测结论决定是否回退，接线层不做判断）
const st2 = G.createGame({ mode: 'score', tiers: ['sota', 'go', 'go'] })
const advise = G.adviseState(st2, 0)
ok(!!advise.sotaCtx, 'sota 档的 adviseState 带 sotaCtx')
ok(advise.sotaCtx.position === 'landlord' || advise.sotaCtx.position === 'landlord_up' || advise.sotaCtx.position === 'landlord_down',
  'sotaCtx.position 合法', advise.sotaCtx && advise.sotaCtx.position)
ok(Array.isArray(advise.sotaCtx.history) && advise.sotaCtx.myCounts.length === 15, 'sotaCtx 的 history/myCounts 形状对')

const st3 = G.createGame({ mode: 'score', tiers: ['go', 'go', 'go'] })
ok(G.adviseState(st3, 0).sotaCtx === undefined, '非 sota 档不付这份转换代价（无 sotaCtx）')

console.log(`\n${failures === 0 ? '✓ 全部通过' : '✗ ' + failures + ' 项失败'}`)
process.exit(failures === 0 ? 0 : 1)
