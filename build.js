// 把 engine + ui 打包成一个自包含 HTML
const fs = require('fs');
const path = require('path');
const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const safe = (s) => s.replace(/<\/script>/gi, '<\\/script>');

const tpl = read('ui/template.html');
const css = read('ui/app.css');
const eng = safe(read('engine.js'));
const app = safe(read('ui/app.js'));

let out = tpl.split('__CSS__').join(css).split('__ENGINE__').join(eng).split('__APP__').join(app);
const target = path.join(root, 'doudizhu.html');
fs.writeFileSync(target, out, 'utf8');

// 静态检查：$('xxx') 引用是否都能在 HTML 里找到 id
const ids = new Set([...out.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const refs = new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
const missing = [...refs].filter((r) => !ids.has(r));
console.log('built:', target);
console.log('size:', (Buffer.byteLength(out, 'utf8') / 1024).toFixed(1) + 'KB');
console.log('ids:', ids.size, 'refs:', refs.size, 'missing:', missing.length ? missing.join(',') : 'none');
