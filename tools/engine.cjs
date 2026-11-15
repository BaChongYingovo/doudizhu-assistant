// 从插件源码里加载 UMD 版引擎。
//
// 插件包是 `"type": "module"`，直接 require('../plugin/.../src/engine.js') 会被当成 ESM，
// UMD 的 `module.exports` 分支拿不到（root 在 ESM 里是 undefined），于是崩在 `root.DDZ = api`。
// 所以这里按 CommonJS 的语义把同一份源码求值一次，保证只有一份引擎源（插件 src/engine.js）。
const fs = require('node:fs');
const path = require('node:path');

// 默认加载插件的 src/engine.js；设 DDZ_ENGINE=<绝对/相对路径> 可切到别的引擎做 A/B。
const SRC = process.env.DDZ_ENGINE
  ? path.resolve(process.env.DDZ_ENGINE)
  : path.join(__dirname, '..', 'plugin', 'dsh-doudizhu-game', 'src', 'engine.js');
const code = fs.readFileSync(SRC, 'utf8');

const shim = { exports: {} };
// eslint-disable-next-line no-new-func
new Function('module', 'exports', 'window', code)(shim, shim.exports, undefined);

if (!shim.exports || typeof shim.exports.advise !== 'function') {
  throw new Error('engine.js 没有导出 advise，UMD 分支可能变了');
}

// 供 /health 校验「这一局到底跑的是哪个引擎」：A/B 时防止端口没杀干净、健康检查命中旧进程
shim.exports.__src = SRC;
shim.exports.__sha = require('node:crypto').createHash('sha256').update(code).digest('hex').slice(0, 12);

module.exports = shim.exports;
