#!/usr/bin/env node
/**
 * 把 src/ 下的引擎、规则核心、文案、样式、UI 拼成一个自包含的 client.js。
 *
 *   node build.mjs
 *
 * 产物 client.js 直接给宿主 __ModuleLoader__ 加载，不需要打包器。
 * 注意：src 里的代码会被原样嵌入同一个函数作用域，彼此靠顶层 const 共享符号：
 *   DDZ / G / I18N / CSS / h / useState …（由本文件注入）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const engine = read('src/engine.js')
const game = read('src/game.js')
const i18n = read('src/i18n.js')
const style = read('src/style.js')
const ui = read('src/ui.js')

const parts = []

parts.push(
  '/*! dsh-doudizhu-game · 生成的 client.js —— 不要手改，改 src/*.js 后执行 node build.mjs */',
  'window.__ModuleLoader__.load({',
  "  id: 'dsh-doudizhu-game',",
  '  factory(require) {',
  "    const React = require('react')",
  '    const {',
  '      useState, useEffect, useRef, useMemo, useCallback, useReducer, useLayoutEffect,',
  '    } = React',
  '    const h = React.createElement',
  '',
  '    /* ================= 1. 牌型引擎（纯逻辑） ================= */',
  '    const __engine = { exports: {} }',
  '    ;(function (module, exports) {',
)

parts.push(engine)

parts.push(
  '    })(__engine, __engine.exports)',
  '    const DDZ = __engine.exports',
  '',
  '    /* ================= 2. 对局规则核心 ================= */',
  '    const __game = { exports: {} }',
  '    ;(function (module, exports) {',
)

parts.push(game)

parts.push(
  '    })(__game, __game.exports)',
  '    const G = __game.exports.GameCore(DDZ)',
  '',
  '    /* ================= 3. 文案 / 样式 ================= */',
)

parts.push(i18n)
parts.push(style)

parts.push('    /* ================= 4. 界面 ================= */')
parts.push(ui)

parts.push(
  '',
  '    /* ================= 5. 插件入口 ================= */',
  '    const STYLE_ID = "dsh-doudizhu-styles"',
  '',
  '    function currentLang() {',
  '      try { return localStorage.getItem("ddz-lang") === "en" ? "en" : "zh" } catch (e) { return "zh" }',
  '    }',
  '',
  '    function ensureStyles() {',
  '      if (typeof document === "undefined") return function () {}',
  '      const old = document.getElementById(STYLE_ID)',
  '      if (old) {',
  '        if (old.parentNode) old.parentNode.removeChild(old)',
  '      }',
  '      const el = document.createElement("style")',
  '      el.id = STYLE_ID',
  '      el.textContent = CSS',
  '      ;(document.head || document.body || document.documentElement).appendChild(el)',
  '      return function () {',
  '        try { if (el.parentNode) el.parentNode.removeChild(el) } catch (e) { /* ignore */ }',
  '      }',
  '    }',
  '',
  '    const inject = ["slots"]',
  '',
  '    function apply(ctx) {',
  '      const slots = ctx && typeof ctx.get === "function" ? ctx.get("slots") : ctx && ctx.slots',
  '      if (slots === void 0 || slots === null || typeof slots.register !== "function") {',
  '        console.warn("[doudizhu] 宿主没有 slots 服务，侧栏入口未注册")',
  '        return',
  '      }',
  '',
  '      const disposeStyles = ensureStyles()',
  '      const disposers = []',
  '',
  '      disposers.push(',
  '        slots.inject("main", () => slots.register({ name: "main", key: PANEL_ID }, PanelView)),',
  '      )',
  '',
  '      disposers.push(',
  '        slots.inject("sidebar.panellist", () => slots.register(',
  '          { name: "sidebar.panellist", id: PANEL_ID, order: 55, label: () => I18N[currentLang()].appName },',
  '          SidebarIcon,',
  '        )),',
  '      )',
  '',
  '      disposers.push(',
  '        slots.inject("sidebar.panellist.actions", () => slots.register(',
  '          { name: "sidebar.panellist.actions", id: PANEL_ID + "-more" },',
  '          MoreMenuRow,',
  '        )),',
  '      )',
  '',
  '      if (typeof ctx.effect === "function") {',
  '        ctx.effect(',
  '          () => () => {',
  '            for (const dispose of disposers.splice(0)) {',
  '              try { if (typeof dispose === "function") dispose() } catch (e) { /* 已卸载 */ }',
  '            }',
  '            try { disposeStyles() } catch (e) { /* ignore */ }',
  '          },',
  '          "dsh-doudizhu-game:client",',
  '        )',
  '      }',
  '    }',
  '',
  '    exports.inject = inject',
  '    exports.apply = apply',
  '    return module.exports',
  '  },',
  '})',
)

let code = parts.join('\n')
// 内嵌源码若含 </script>，在 HTML 注入场景会被截断；先转义
code = code.replace(/<\/script/gi, '<\\/script')

fs.writeFileSync(path.join(root, 'client.js'), code, 'utf8')

const checks = [
  ['__ModuleLoader__.load', code.includes('__ModuleLoader__.load')],
  ['DDZ 导出', /const DDZ = __engine\.exports/.test(code)],
  ['GameCore 可调用', /GameCore\(DDZ\)/.test(code)],
  ['PanelView 定义', /function PanelView\s*\(/.test(code)],
  ['apply 定义', /function apply\(ctx\)/.test(code)],
  ['exports.inject', /exports\.inject = inject/.test(code)],
]

let bad = 0
for (const [name, ok] of checks) {
  if (!ok) { bad++; console.error('✗ 缺少：' + name) }
}

const kb = (Buffer.byteLength(code, 'utf8') / 1024).toFixed(1)
console.log(`✓ client.js ${kb} KB`)
if (bad) {
  console.error(`✗ ${bad} 项自检失败`)
  process.exit(1)
}
