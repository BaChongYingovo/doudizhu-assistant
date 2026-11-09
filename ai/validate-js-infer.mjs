// 校验 src/sota.js 里纯 JS 的 DouZero 前向与 onnxruntime-node 的官方 ONNX 结果是否一致。
//
//   node ai/validate-js-infer.mjs             # 地主模型（插件实际用的那个）
//   node ai/validate-js-infer.mjs up down     # 连农民模型一起校验
//
// 判据：逐候选打分的最大绝对误差 < 1e-4，且 argmax 完全一致（否则选牌会漂）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ort from 'onnxruntime-node';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'plugin', 'dsh-doudizhu-game', 'src', 'sota.js');

function loadSota() {
  const shim = { exports: {} };
  const code = fs.readFileSync(SRC, 'utf8');
  new Function('module', 'exports', 'window', code)(shim, shim.exports, undefined);
  return shim.exports;
}

const SOTA = loadSota();

function randCounts(n, rnd) {
  const c = new Array(15).fill(0);
  let left = n;
  let guard = 0;
  while (left > 0 && guard++ < 500) {
    const i = Math.floor(rnd() * 15);
    const cap = i < 13 ? 4 : 1;
    if (c[i] >= cap) continue;
    c[i]++; left--;
  }
  return c;
}

// 简易确定性随机
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function check(label, file, position, dims) {
  const rnd = mulberry32(20261109);
  const buf = fs.readFileSync(path.join(HERE, 'models', 'douzero_WP', file));
  const u8 = new Uint8Array(buf);

  const t0 = Date.now();
  const tensors = SOTA.parseOnnx(u8);
  const model = SOTA.buildModel(tensors);
  const parseMs = Date.now() - t0;

  const sess = await ort.InferenceSession.create(path.join(HERE, 'models', 'douzero_WP', file));

  let maxDiff = 0;
  let argmaxMiss = 0;
  let cases = 0;
  let jsMs = 0;

  for (let round = 0; round < 6; round++) {
    const n = [1, 3, 17, 41, 64, 9][round];
    const z = new Float32Array(5 * 162);
    for (let i = 0; i < z.length; i++) z[i] = rnd() < 0.06 ? 1 : 0;
    const rows = new Float32Array(n * dims);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < dims; k++) rows[i * dims + k] = rnd() < 0.08 ? 1 : 0;
    }

    const zBatch = new Float32Array(n * 5 * 162);
    for (let i = 0; i < n; i++) zBatch.set(z, i * 5 * 162);
    const out = await sess.run({
      z: new ort.Tensor('float32', zBatch, [n, 5, 162]),
      x: new ort.Tensor('float32', rows, [n, dims])
    });
    const ref = out.values.data;

    const t1 = Date.now();
    const mine = SOTA.score(model, z, rows, n, dims);
    jsMs += Date.now() - t1;

    let bestMine = 0, bestRef = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(mine[i] - ref[i]);
      if (d > maxDiff) maxDiff = d;
      if (mine[i] > mine[bestMine]) bestMine = i;
      if (ref[i] > ref[bestRef]) bestRef = i;
    }
    if (bestMine !== bestRef) argmaxMiss++;
    cases += n;
  }

  const ok = maxDiff < 1e-4 && argmaxMiss === 0;
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  console.log(`  解析 ${parseMs}ms，前向 ${cases} 行共 ${jsMs}ms（${(jsMs / cases).toFixed(3)} ms/行）`);
  console.log(`  最大绝对误差 ${maxDiff.toExponential(2)}，argmax 不一致 ${argmaxMiss}/6 组`);
  return ok;
}

const which = process.argv.slice(2);
const jobs = [];
if (!which.length || which.includes('landlord')) jobs.push(['landlord (373 维)', 'landlord.onnx', 'landlord', 373]);
if (which.includes('up')) jobs.push(['landlord_up (484 维)', 'landlord_up.onnx', 'landlord_up', 484]);
if (which.includes('down')) jobs.push(['landlord_down (484 维)', 'landlord_down.onnx', 'landlord_down', 484]);

let bad = 0;
for (const [label, file, pos, dims] of jobs) {
  const ok = await check(label, file, pos, dims);
  if (!ok) bad++;
}
if (bad) { console.error(`\n✗ ${bad} 个模型不一致`); process.exit(1); }
console.log('\n✓ 纯 JS 前向与 onnxruntime 一致');
