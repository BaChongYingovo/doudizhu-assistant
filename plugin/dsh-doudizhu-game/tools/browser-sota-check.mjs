/**
 * 真浏览器验证：把插件三份源码丢进 Chrome，走完整链路
 * 下载权重 → sha256 校验 → 写 Cache Storage → 解析 ONNX → 前向 → 引擎 sota 建议
 *
 *   node tools/browser-sota-check.mjs
 *
 * 结果写到同目录 report.json；失败也会写（带错误栈）。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const pkg = path.resolve(here, '..')
const srcDir = path.join(pkg, 'src')
const repo = path.resolve(pkg, '..', '..')
const report = path.join(here, 'report.json')
const PORT = 8899
if (fs.existsSync(report)) fs.unlinkSync(report)

const PAGE = `<!doctype html><meta charset="utf-8"><title>sota check</title>
<body><pre id="out">running</pre>
<script src="/sota.js"></script>
<script>
const log = []
const out = document.getElementById('out')
function say(s) { log.push(s); out.textContent = log.join('\\n') }
async function loadModule(file) {
  const code = await (await fetch('/' + file)).text()
  const shim = { exports: {} }
  new Function('module', 'exports', 'window', code)(shim, shim.exports, undefined)
  return shim.exports
}
async function main() {
  try {
    say('SOTA 存在: ' + (typeof SOTA))
    const t0 = performance.now()
    await SOTA.load()
    const s = SOTA.status()
    say('load 耗时 ' + Math.round(performance.now() - t0) + ' ms，状态 ' + s.status + '，源 ' + s.source)
    if (s.status !== 'ready') throw new Error('未就绪: ' + s.error)

    const DDZ = await loadModule('engine.js')
    const G = (await loadModule('game.js')).GameCore(DDZ)
    DDZ.setSotaRank(SOTA.rank)
    say('sotaAvailable: ' + DDZ.sotaAvailable())

    let seed = 12345
    const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    const st = G.createGame({ mode: 'score', tiers: ['sota', 'sota', 'sota'], rng })
    let guard = 0
    while (st.phase === 'bid' && guard++ < 20) G.applyBid(st, G.bidSeat(st), G.aiBid(st, G.bidSeat(st)))
    say('叫分后阶段 ' + st.phase + '，地主 ' + st.landlord)
    if (st.phase === 'double') for (let i = 0; i < 3; i++) G.applyDouble(st, i, i === 0 ? 2 : G.aiDouble(st, i))
    while (st.phase === 'play' && st.turn !== st.landlord && guard++ < 200) {
      const seat = st.turn
      const mv = G.aiMove(st, seat)
      if (mv && mv.move) G.applyPlay(st, seat, mv.move.cards)
      else if (G.legalMoves(st, seat).canPass) G.applyPass(st, seat)
      else G.applyPlay(st, seat, G.legalMoves(st, seat).moves[0].cards)
    }
    say('轮到地主: 阶段 ' + st.phase + ' turn ' + st.turn)

    const advState = G.adviseState(st, st.landlord)
    const tier = st.tiers[st.landlord]
    say('地主档位 ' + tier + '，adviseState 带 sotaCtx: ' + !!advState.sotaCtx)
    const t2 = performance.now()
    const advice = DDZ.advise(advState, { tier })
    say('建议耗时 ' + (performance.now() - t2).toFixed(2) + ' ms')
    say('建议档位 ' + advice.tier + '，fallback=' + !!advice.fallback + '，理由 ' + (advice.reason || '-'))
    say('建议出牌 ' + JSON.stringify(advice.move ? advice.move.type + ':' + advice.move.cards : advice.pass))

    const ctx = G.sotaCtx(st, st.landlord)
    const t1 = performance.now()
    const legal = G.legalMoves(st, st.landlord)
    const counts = legal.moves.map(m => DDZ.countsOf(m.cards))
    const r = SOTA.rank(ctx, counts)
    say('前向 ' + (performance.now() - t1).toFixed(2) + ' ms，index ' + r.index + '/' + counts.length +
        '，最高分 ' + r.scores[r.index].toFixed(4))
    say('CACHE_OK ' + (typeof caches !== 'undefined'))
    await fetch('/report', { method: 'POST', body: JSON.stringify({ ok: true, log }) })
  } catch (e) {
    say('ERROR ' + e.message)
    await fetch('/report', { method: 'POST', body: JSON.stringify({ ok: false, log, error: String(e.stack || e) }) })
  }
}
main()
</script>`

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/report') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      fs.writeFileSync(report, body, 'utf8')
      res.writeHead(204).end()
      setTimeout(() => { server.close(); chrome.kill() }, 200)
    })
    return
  }
  if (req.url === '/' ) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE) }
  const map = { '/sota.js': 'sota.js', '/engine.js': 'engine.js', '/game.js': 'game.js' }
  if (map[req.url]) {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
    return res.end(fs.readFileSync(path.join(srcDir, map[req.url]), 'utf8'))
  }
  res.writeHead(404).end('no')
})

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
let chrome
server.listen(PORT, '127.0.0.1', () => {
  chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
    '--user-data-dir=' + path.join(here, 'chrome-profile'),
    'http://127.0.0.1:' + PORT + '/'
  ], { stdio: 'ignore' })
  console.log('chrome pid ' + chrome.pid + '，等待 report.json …')
})

const t0 = Date.now()
const tick = setInterval(() => {
  if (fs.existsSync(report)) {
    clearInterval(tick)
    const r = JSON.parse(fs.readFileSync(report, 'utf8'))
    console.log((r.ok ? '✓ 通过' : '✗ 失败') + '（' + Math.round((Date.now() - t0) / 1000) + 's）')
    console.log(r.log.join('\n'))
    if (!r.ok) console.log(r.error)
    process.exit(r.ok ? 0 : 1)
  }
  if (Date.now() - t0 > 120000) {
    clearInterval(tick)
    console.log('✗ 超时，没有 report.json')
    process.exit(1)
  }
}, 500)
