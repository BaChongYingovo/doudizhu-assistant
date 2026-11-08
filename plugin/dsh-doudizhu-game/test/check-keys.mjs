/**
 * 静态自检：UI 里用到的 T.xxx / G.xxx / DDZ.xxx 是否都真实存在。
 *   node test/check-keys.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const ui = read('src/ui.js')
const i18nSrc = read('src/i18n.js')
const engineSrc = read('src/engine.js')
const gameSrc = read('src/game.js')

const i18nBox = {}
vm.createContext(i18nBox)
vm.runInContext(i18nSrc + '\n;this.__I18N = I18N', i18nBox)
const I18N = i18nBox.__I18N

const engineBox = { module: { exports: {} }, exports: {}, window: undefined }
engineBox.globalThis = engineBox
vm.createContext(engineBox)
vm.runInContext(engineSrc, engineBox)
const DDZ = engineBox.module.exports

const gameBox = { module: { exports: {} }, exports: {}, window: undefined }
gameBox.globalThis = gameBox
vm.createContext(gameBox)
vm.runInContext(gameSrc, gameBox)
const GameCore = gameBox.module.exports.GameCore
const G = GameCore(DDZ)

function collect(src, prefix) {
  const re = new RegExp('\\b' + prefix + '\\.([A-Za-z_$][\\w$]*)', 'g')
  const out = new Set()
  let m
  while ((m = re.exec(src))) out.add(m[1])
  return [...out].sort()
}

const problems = []

for (const key of collect(ui, 'T')) {
  for (const lang of ['zh', 'en']) {
    if (!(key in I18N[lang])) problems.push(`I18N.${lang} 缺少 ${key}`)
  }
}
for (const key of collect(ui, 'G')) {
  if (!(key in G)) problems.push(`GameCore 缺少 ${key}`)
}
for (const key of collect(ui, 'DDZ')) {
  if (!(key in DDZ)) problems.push(`engine 缺少 ${key}`)
}
for (const key of collect(ui, 'I18N')) {
  if (!(key in I18N)) problems.push(`I18N 缺少 ${key}`)
}

// i18n 里定义却没被 UI 用的 key（提示用，不算错误）
const used = new Set(collect(ui, 'T'))
const unused = Object.keys(I18N.zh).filter(k => !used.has(k)).sort()

if (unused.length) console.log('· 未使用的文案（不算错）：' + unused.join(', '))

if (problems.length) {
  for (const p of problems) console.error('✗ ' + p)
  console.error(`✗ ${problems.length} 处引用不存在`)
  process.exit(1)
}
console.log('✓ 文案与 API 引用全部有效')
