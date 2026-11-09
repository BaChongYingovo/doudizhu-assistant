/**
 * 渲染自测：用假 React + 假时钟把 client.js 真跑一遍。
 *
 *   node test/render.test.mjs
 *   DDZ_DEBUG=1 node test/render.test.mjs   # 打印定时器/AI 推进轨迹
 *
 * 覆盖：插件注册（main / sidebar.panellist / sidebar.panellist.actions）、
 * 开局面板渲染、开局发牌、托管整局跑完、结算弹层、再来一局。
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const code = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
const DEBUG = !!process.env.DDZ_DEBUG

/* ---------------- 假时钟 ---------------- */
function makeClock() {
  let now = 0
  let seq = 1
  const timers = new Map()
  return {
    setTimeout(fn, delay = 0) {
      const id = seq++
      const at = now + Math.max(0, delay | 0)
      timers.set(id, { fn, at, every: 0 })
      if (DEBUG) console.error('[timer] +', id, 'delay=' + (delay | 0), 'at=' + at)
      return id
    },
    clearTimeout(id) { if (DEBUG && timers.has(id)) console.error('[timer] -', id); timers.delete(id) },
    setInterval(fn, delay = 0) {
      const id = seq++
      timers.set(id, { fn, at: now + Math.max(1, delay | 0), every: Math.max(1, delay | 0) })
      if (DEBUG) console.error('[interval] +', id, 'every=' + (delay | 0))
      return id
    },
    clearInterval(id) { timers.delete(id) },
    step() {
      let best = null
      for (const [id, t] of timers) if (!best || t.at < best.t.at || (t.at === best.t.at && id < best.id)) best = { id, t }
      if (!best) return false
      now = best.t.at
      if (DEBUG) console.error('[step]', best.id, 'at=' + best.t.at, best.t.every ? 'every=' + best.t.every : '')
      if (best.t.every) best.t.at = now + best.t.every
      else timers.delete(best.id)
      best.t.fn()
      return true
    },
    get time() { return now },
    get pending() { return timers.size },
    dump() { return [...timers.entries()].map(([id, t]) => `${id}@${t.at}${t.every ? '*' : ''}`).join(',') },
  }
}

/* ---------------- 假 React ---------------- */
function makeReact() {
  const el = (type, props, ...children) => ({
    __el: true,
    type,
    key: props && props.key !== undefined ? props.key : undefined,
    props: Object.assign({}, props, { children: children.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false) }),
  })

  let hookIndex = 0
  let cells = []
  let cleanups = []
  let pending = []
  let dirty = false

  const React = {
    createElement: el,
    Fragment: '__fragment__',
    useState(init) {
      const i = hookIndex++
      if (!(i in cells)) cells[i] = typeof init === 'function' ? init() : init
      return [cells[i], (v) => {
        const next = typeof v === 'function' ? v(cells[i]) : v
        if (Object.is(next, cells[i])) return
        cells[i] = next
        dirty = true
      }]
    },
    useRef(v) {
      const i = hookIndex++
      if (!(i in cells)) cells[i] = { current: v }
      return cells[i]
    },
    useMemo(fn) { hookIndex++; return fn() },
    useCallback(fn) { hookIndex++; return fn },
    useEffect(fn) { pending.push(fn) },
    useLayoutEffect(fn) { pending.push(fn) },
    useReducer(reducer, init) {
      const i = hookIndex++
      if (!(i in cells)) cells[i] = typeof init === 'function' ? init() : init
      return [cells[i], (action) => {
        const next = reducer(cells[i], action)
        if (Object.is(next, cells[i])) return
        cells[i] = next
        dirty = true
      }]
    },
  }

  function render(Component, props) {
    for (const fn of cleanups.splice(0)) { try { if (typeof fn === 'function') fn() } catch { /* ignore */ } }
    pending = []
    hookIndex = 0
    dirty = false
    const tree = Component(Object.assign({ id: 'doudizhu', ctx: {} }, props))
    const effects = pending.slice()
    pending = []
    for (const fn of effects) {
      try {
        const c = fn()
        if (typeof c === 'function') cleanups.push(c)
      } catch (e) {
        console.error('effect 抛错：', e)
        throw e
      }
    }
    return { tree, dirty: () => dirty }
  }

  return { React, render, reset() { cells = []; cleanups = []; pending = []; hookIndex = 0; dirty = false } }
}

/* ---------------- 环境 ---------------- */
const clock = makeClock()
const { React, render, reset } = makeReact()

const store = new Map()
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const noop = () => {}
const stubEl = () => ({
  style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop },
  setAttribute: noop, appendChild: noop, removeChild: noop, remove: noop,
  addEventListener: noop, removeEventListener: noop,
})

const document = {
  head: { appendChild: noop },
  body: { appendChild: noop, removeChild: noop },
  documentElement: { appendChild: noop },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: stubEl,
  createTextNode: () => stubEl(),
  addEventListener: noop,
  removeEventListener: noop,
}

const windowMock = {}
let loaderSpec = null
windowMock.__ModuleLoader__ = { load(spec) { loaderSpec = spec } }
// 记录 window 上的事件监听，键盘快捷键测试要派发 keydown
const winListeners = Object.create(null)
windowMock.addEventListener = (type, fn) => { (winListeners[type] = winListeners[type] || []).push(fn) }
windowMock.removeEventListener = (type, fn) => {
  const arr = winListeners[type]
  if (!arr) return
  const i = arr.indexOf(fn)
  if (i >= 0) arr.splice(i, 1)
}
function dispatchWindow(type, ev) {
  for (const fn of (winListeners[type] || []).slice()) fn(ev)
}

const ctxObj = {
  window: windowMock,
  document,
  localStorage,
  console,
  navigator: { language: 'zh-CN', languages: ['zh-CN'] },
  React,
  setTimeout: clock.setTimeout,
  clearTimeout: clock.clearTimeout,
  setInterval: clock.setInterval,
  clearInterval: clock.clearInterval,
  Date, Math, JSON, String, Number, Object, Array, Map, Set, Promise, Error, RegExp,
}
ctxObj.globalThis = ctxObj
ctxObj.self = ctxObj
if (DEBUG) ctxObj.__DDZ_DEBUG = true

vm.createContext(ctxObj)
const wrapped = vm.runInContext('(function (exports, module) {\n' + code + '\n; return module.exports })', ctxObj)
const modObj = { exports: {} }
wrapped(modObj.exports, modObj)

/* ---------------- 断言工具 ---------------- */
let failures = 0
function ok(cond, name, extra) {
  if (cond) console.log('  ✓ ' + name)
  else { failures++; console.error('  ✗ ' + name + (extra ? ' — ' + extra : '')) }
}

function walk(node, out = []) {
  if (node === null || node === undefined || node === false) return out
  if (Array.isArray(node)) { for (const n of node) walk(n, out); return out }
  if (typeof node !== 'object') return out
  out.push(node)
  if (node.props) walk(node.props.children, out)
  return out
}

function cls(n) { return n && n.props && typeof n.props.className === 'string' ? n.props.className : '' }

function textOf(n) {
  if (n === null || n === undefined || n === false) return ''
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(textOf).join('')
  if (n.__el) return textOf(n.props.children)
  return ''
}

function textNode(t) { return n => !!n.__el && textOf(n).trim() === t }

function findClickable(nodes, pred) {
  return nodes.find(n => n.__el && pred(n) && n.props && typeof n.props.onClick === 'function')
}

/* ---------------- 装上插件 ---------------- */
console.log('插件注册')
ok(!!loaderSpec, 'loader 收到 load 调用')
ok(loaderSpec && loaderSpec.id === 'dsh-doudizhu-game', 'loader 收到的 id 正确')
const plugin = loaderSpec.factory((name) => (name === 'react' ? React : undefined))
ok(Array.isArray(plugin.inject) && plugin.inject.indexOf('slots') >= 0, 'exports.inject 含 slots')

const regs = []
const cleanups = []
const slots = {
  inject(name, fn) {
    try { const c = fn(); if (typeof c === 'function') cleanups.push(c) } catch (e) { console.error('inject 抛错：', name, e); throw e }
  },
  register(target, comp) {
    regs.push({ name: target && target.name, key: target && target.key, id: target && target.id, comp })
    return () => {}
  },
}
const hostCtx = {
  get: (n) => (n === 'slots' ? slots : undefined),
  effect: (fn) => { const c = typeof fn === 'function' ? fn() : undefined; if (typeof c === 'function') cleanups.push(c) },
}
plugin.apply(hostCtx)

const mainReg = regs.find(x => x.name === 'main')
ok(!!mainReg, '注册了 main 整页')
ok(mainReg && mainReg.key === 'doudizhu', 'main 的 key 是 doudizhu')
const sideReg = regs.find(x => x.name === 'sidebar.panellist')
ok(!!sideReg, '注册了侧栏图标行')
ok(sideReg && sideReg.id === 'doudizhu', '侧栏图标 id 正确')
const moreReg = regs.find(x => x.name === 'sidebar.panellist.actions')
ok(!!moreReg, '注册了「更多」菜单行')

console.log('入口组件')
const opened = []
const moreTree = render(moreReg.comp, { entries: [], onOpen: (id) => opened.push(id), onPinnedChange: noop, onDismiss: noop })
const moreNodes = walk(moreTree.tree)
const moreBtn = findClickable(moreNodes, () => true)
ok(!!moreBtn && moreBtn.type === 'button', '更多菜单行是按钮')
if (moreBtn) { moreBtn.props.onClick(); ok(opened[0] === 'doudizhu', '点更多菜单行会 onOpen(doudizhu)', JSON.stringify(opened)) }
const iconTree = render(sideReg.comp, {})
const iconNodes = walk(iconTree.tree)
ok(iconNodes.some(n => n.__el && n.type === 'svg'), '侧栏图标是 svg')

/* ---------------- 开局面板 ---------------- */
reset()
const PanelView = mainReg.comp
let r = render(PanelView)
let nodes = walk(r.tree)

console.log('开局面板')
ok(nodes.some(n => textOf(n).indexOf('斗地主') === 0), '渲染出开局面板')
ok(nodes.some(n => textOf(n).trim() === '斗地主'), '标题是「斗地主」')
const startBtn = findClickable(nodes, textNode('开始新一局'))
ok(!!startBtn, '有「开始新一局」按钮')
const selects = nodes.filter(n => n.__el && n.type === 'select')
ok(selects.length === 3, '三家各有一个档位下拉', '实际 ' + selects.length)
const optCounts = selects.map(s => walk(s.props.children).filter(n => n.__el && n.type === 'option').length)
ok(optCounts.every(c => c === 8), '每档下拉 8 个难度（含 sota）', JSON.stringify(optCounts))
const optValues = walk(selects[0].props.children).filter(n => n.__el && n.type === 'option').map(n => n.props.value)
ok(optValues.indexOf('sota') >= 0, '档位里有 sota', JSON.stringify(optValues))
ok(walk(selects[0].props.children).some(n => n.__el && /DouZero/.test(textOf(n))), 'sota 档的标签写了 DouZero')

/* ---------------- 开局 ---------------- */
console.log('开局')
if (startBtn) startBtn.props.onClick()
r = render(PanelView)
nodes = walk(r.tree)

ok(nodes.some(n => cls(n).indexOf('ddz-handwrap') >= 0), '进入牌桌')
const handEl = nodes.find(n => n.__el && typeof n.type === 'function' && n.type.name === 'Hand')
ok(!!handEl && Array.isArray(handEl.props.cards) && handEl.props.cards.length === 17, '手牌 17 张', handEl ? String(handEl.props.cards.length) : 'no hand')
ok(nodes.some(n => cls(n).indexOf('ddz-counterbar') >= 0), '有记牌器')
const seatEls = nodes.filter(n => n.__el && typeof n.type === 'function' && n.type.name === 'Seat')
ok(seatEls.length === 3, '三家座位都渲染', '实际 ' + seatEls.length)

/* ---------------- 托管整局 ---------------- */
console.log('托管整局')
const autoBtn = findClickable(nodes, textNode('托管'))
ok(!!autoBtn, '有托管按钮')
if (autoBtn) autoBtn.props.onClick()
r = render(PanelView)
nodes = walk(r.tree)

let steps = 0
let finished = false
while (steps < 6000) {
  if (!clock.step()) break
  steps++
  if (r.dirty()) { r = render(PanelView); nodes = walk(r.tree) }
  if (store.has('ddz-stats') || nodes.some(n => n.__el && typeof n.type === 'function' && n.type.name === 'Result')) { finished = true; break }
}

ok(finished, '整局自动打完并弹出结算', `steps=${steps} pending=${clock.pending} timers=${clock.dump()}`)
if (!finished) {
  const dbg = nodes.map(n => textOf(n)).filter(Boolean).join(' | ')
  console.error('[debug] tree:', dbg.slice(0, 500))
}

if (finished) {
  const resultEl = nodes.find(n => n.__el && typeof n.type === 'function' && n.type.name === 'Result')
  ok(!!resultEl, '结算弹层已挂载')
  if (resultEl) {
    const out = resultEl.type(resultEl.props)
    const txt = textOf(out)
    ok(txt.indexOf('本局得分') >= 0, '结算里有「本局得分」', txt.slice(0, 80))
    ok(txt.indexOf('再来一局') >= 0 || txt.indexOf('换挡再战') >= 0, '结算里有再来一局/换挡再战按钮')
    ok(!/undefined|NaN/.test(txt), '结算文案里没有 undefined/NaN', txt.slice(0, 160))
  }
  ok(store.has('ddz-stats'), '战绩已写入 localStorage')

  if (resultEl) {
    const out = resultEl.type(resultEl.props)
    const againBtn = findClickable(walk(out), textNode('再来一局'))
    ok(!!againBtn, '结算里有可点的「再来一局」')
    if (againBtn) {
      againBtn.props.onClick()
      r = render(PanelView)
      nodes = walk(r.tree)
      ok(nodes.some(n => cls(n).indexOf('ddz-handwrap') >= 0), '再来一局回到牌桌')
      ok(!nodes.some(n => n.__el && typeof n.type === 'function' && n.type.name === 'Result'), '再来一局后结算弹层关闭')
    }
  }
}

console.log(`\n${failures === 0 ? '✓ 全部通过' : '✗ ' + failures + ' 项失败'}`)
process.exit(failures === 0 ? 0 : 1)
