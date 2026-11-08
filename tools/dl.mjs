// 下载文件：sandbox 里 curl/git 走不通，但 Node fetch 可用
// 用法：node tools/dl.mjs <url> <outfile>
import { writeFileSync } from 'node:fs';

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('用法: node tools/dl.mjs <url> <outfile>');
  process.exit(2);
}
const res = await fetch(url, {
  headers: { 'user-agent': 'dsh-agent' },
  redirect: 'follow'
});
if (!res.ok) {
  console.error('HTTP', res.status, url);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync(out, buf);
console.log('saved', out, buf.length + 'B');
