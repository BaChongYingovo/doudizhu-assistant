/**
 * 宿主启动等价测试：只给 window.__ModuleLoader__，factory 只传 require。
 *
 * 这条测的是「插件能不能被宿主加载」——之前就栽在 factory 里没声明
 * module/exports，宿主启动直接报 `exports is not defined`。
 *
 *   node test/host-boot.test.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const code = fs.readFileSync(path.join(root, 'client.js'), 'utf8')

let failures = 0
const ok = (cond, name, extra) => {
  if (cond) console.log('  ✓ ' + name)
  else { failures++; console.error('  ✗ ' + name + (extra ? ' — ' + extra : '')) }
}

const stubEl = () => ({
  style: {}, dataset: {}, setAttribute() {}, appendChild() {}, remove() {},
  classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, removeEventListener() {},
})
const React = {
  createElement: () => ({ __el: true, type: 'div', props: { children: [] } }),
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect() {}, useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f(),
}
const win = {
  __ModuleLoader__: { load(spec) { globalThis.__spec = spec } },
  addEventListener() {}, removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
}
const document = {
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: stubEl, createTextNode: stubEl, addEventListener() {}, removeEventListener() {},
  head: { appendChild() {} }, body: { appendChild() {} }, documentElement: { appendChild() {} },
}
const sandbox = {
  window: win, document, console,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { language: 'zh-CN', languages: ['zh-CN'] },
  setTimeout, clearTimeout, setInterval, clearInterval, React,
  Date, Math, JSON, String, Number, Object, Array, Map, Set, Promise, Error, RegExp,
}
sandbox.globalThis = sandbox
sandbox.self = sandbox
vm.createContext(sandbox)

console.log('宿主加载')
vm.runInContext(code, sandbox)
const spec = globalThis.__spec
ok(!!spec, 'loader 收到 load 调用')
ok(spec && spec.id === 'dsh-doudizhu-game', 'id 正确', spec && spec.id)

let mod
try {
  mod = spec.factory((name) => {
    if (name === 'react') return React
    throw new Error('宿主没给这个模块：' + name)
  })
  ok(true, 'factory 不依赖宿主提供 module/exports')
} catch (e) {
  ok(false, 'factory 执行', e.message)
}

const exportsObj = mod || {}
ok(Array.isArray(exportsObj.inject) && exportsObj.inject.indexOf('slots') >= 0, 'inject 含 slots')
ok(typeof exportsObj.apply === 'function', 'apply 是函数')

// 用最小 slots 桩跑一遍 apply，确认三处注册与 dispose 都成立
const registered = []
const disposed = []
const slots = {
  inject(name, fn) { const r = fn(); return () => { disposed.push(name) } },
  register(meta, comp) { registered.push({ name: meta.name, meta, comp }); return () => {} },
}
const ctx = {
  get(name) { return name === 'slots' ? slots : null },
  effect(fn) { const c = fn(); return c },
}
try {
  exportsObj.apply(ctx)
  ok(registered.length === 3, 'apply 注册了三处槽位', '实际 ' + registered.length)
  const names = registered.map((r) => r.name).sort().join(',')
  ok(names === 'main,sidebar.panellist,sidebar.panellist.actions', '槽位名正确', names)
  ok(registered.every((r) => typeof r.comp === 'function'), '每处都给了组件')
} catch (e) {
  ok(false, 'apply 可执行', e.message)
}

console.log(failures ? `\n✗ ${failures} 项失败` : '\n✓ 全部通过')
process.exit(failures ? 1 : 0)
