/*!
 * 斗地主军师 · SOTA 档（DouZero）
 *
 * 这里不引入 onnxruntime-web@1.31.1。2026-11-14 量过这个包：npm 解包
 * 150,622,959 字节（143.6 MiB），四个 wasm 合计 86.8 MiB，最小的
 * ort-wasm-simd-threaded.wasm 也有 14,848,852 字节。DouZero 只有一个 LSTM
 * 加六层全连接，权重是 float32，直接解析 ONNX initializer 并手写前向。
 *
 * 编码规则逐行对齐 research/dist/DouZero-main/douzero/env/env.py 的 get_obs()，
 * 与 ai/douzero.mjs（Node 侧，已用 ai/golden-encoder.json 逐维对齐过）共用同一份实现。
 *
 * 权重不入包：运行时按 ai/models/MANIFEST.json 的地址下载 + sha256 校验，
 * 成功后放进 Cache Storage，第二次开面板不再下载。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SOTA = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================= 1. 权重清单 ================= */

  // 权重不入包：运行时按 ai/models/MANIFEST.json 的地址下载 + sha256 校验。
  // 国内直连 huggingface.co 常常连不上，所以按顺序试镜像；谁先成功用谁，
  // 字节仍然只认清单里的 sha256（镜像给错文件一律拒绝）。
  const MIRRORS = [
    'https://huggingface.co/palemoky/douzero-baselines/resolve/main/models_onnx/douzero_WP/',
    'https://hf-mirror.com/palemoky/douzero-baselines/resolve/main/models_onnx/douzero_WP/'
  ];
  const REMOTE = MIRRORS[0];

  // 只内置地主模型：实测 DouZero 的农民模型依赖同水平队友，弱队友下反而低于本引擎启发式，
  // 所以 sota 档在农民位回退 go 档（见 ai/SOTA.md 的 500/300 副实测）。
  const FILES = {
    landlord: {
      file: 'landlord.onnx',
      bytes: 5834135,
      sha256: '5ba2f1bb414483a3ecdf0d000159c1322b02e2d096e6d83be8a18765b56d6d32'
    }
  };

  const CACHE_NAME = 'ddz-sota-v1';

  /* ================= 2. 编码器（对齐 DouZero env.py） ================= */
  // 本引擎牌值 3..15(3..2) / 16(小王) / 17(大王) → DouZero 列号 0..12 / 52 / 53

  function cardCol(r) { return r <= 14 ? r - 3 : r === 15 ? 12 : -1; }

  // 54 维：4x13 牌面矩阵按列展平（flatten('F')）+ 2 维大小王
  function cards2array(counts) {
    const out = new Float32Array(54);
    for (let i = 0; i < 15; i++) {
      const n = counts[i] || 0;
      if (!n) continue;
      const rank = i + 3;
      if (rank <= 15) {
        const col = cardCol(rank);
        for (let k = 0; k < n && k < 4; k++) out[col * 4 + k] = 1;
      } else if (rank === 16) out[52] = 1;
      else if (rank === 17) out[53] = 1;
    }
    return out;
  }

  function countsOfCards(cards) {
    const c = new Array(15).fill(0);
    for (let i = 0; i < cards.length; i++) c[cards[i] - 3]++;
    return c;
  }

  function oneHot(value, max) {
    const v = new Float32Array(max);
    const i = value - 1;
    if (i >= 0 && i < max) v[i] = 1;
    return v;
  }

  // z：最近 15 手（不足前补零），每 3 手拼成 162 维 → [5, 162]
  function encodeZ(history) {
    const seq = history.slice(-15).map(h => cards2array(h.counts));
    while (seq.length < 15) seq.unshift(cards2array(new Array(15).fill(0)));
    const z = new Float32Array(5 * 162);
    for (let step = 0; step < 5; step++) {
      for (let k = 0; k < 3; k++) z.set(seq[step * 3 + k], step * 162 + k * 54);
    }
    return z;
  }

  function concat(parts) {
    let n = 0;
    for (let i = 0; i < parts.length; i++) n += parts[i].length;
    const out = new Float32Array(n);
    let o = 0;
    for (let i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }

  // x 里不含候选动作的那部分：地主 319 维 / 农民 430 维
  function encodeBase(ctx) {
    const { position, myCounts, otherCounts, playedCounts, lastCounts,
      lastLandlordCounts, lastTeammateCounts, numLeft, bombNum } = ctx;
    const parts = [];
    parts.push(cards2array(myCounts));
    parts.push(cards2array(otherCounts));
    if (position === 'landlord') {
      parts.push(cards2array(lastCounts));
      parts.push(cards2array(playedCounts.landlord_up));
      parts.push(cards2array(playedCounts.landlord_down));
      parts.push(oneHot(numLeft.landlord_up, 17));
      parts.push(oneHot(numLeft.landlord_down, 17));
    } else {
      parts.push(cards2array(playedCounts.landlord));
      parts.push(cards2array(playedCounts.teammate));
      parts.push(cards2array(lastCounts));
      parts.push(cards2array(lastLandlordCounts));
      parts.push(cards2array(lastTeammateCounts));
      parts.push(oneHot(numLeft.landlord, 20));
      parts.push(oneHot(numLeft.teammate, 17));
    }
    const bomb = new Float32Array(15);
    bomb[bombNum] = 1;
    parts.push(bomb);
    return concat(parts);
  }

  // 每个候选动作一行 x（地主 373 / 农民 484）
  function encodeX(ctx, legalCounts) {
    const base = encodeBase(ctx);
    const dim = base.length + 54;
    const rows = new Float32Array(legalCounts.length * dim);
    for (let i = 0; i < legalCounts.length; i++) {
      rows.set(base, i * dim);
      rows.set(cards2array(legalCounts[i]), i * dim + base.length);
    }
    return { rows, dim };
  }

  /* ================= 3. 极简 ONNX 读取（只要 initializer） ================= */

  function rdVarint(b, o) {
    let r = 0, m = 1, x;
    do { x = b[o++]; r += (x & 0x7f) * m; m *= 128; } while (x & 0x80);
    return [r, o];
  }

  function readFields(b) {
    const out = [];
    let o = 0;
    while (o < b.length) {
      let key; [key, o] = rdVarint(b, o);
      const f = key >>> 3, t = key & 7;
      if (t === 0) { let v; [v, o] = rdVarint(b, o); out.push({ f, t, v }); }
      else if (t === 1) { out.push({ f, t, v: b.subarray(o, o + 8) }); o += 8; }
      else if (t === 2) { let l; [l, o] = rdVarint(b, o); out.push({ f, t, v: b.subarray(o, o + l) }); o += l; }
      else if (t === 5) { out.push({ f, t, v: b.subarray(o, o + 4) }); o += 4; }
      else throw new Error('onnx: 不认识的 wire type ' + t);
    }
    return out;
  }

  function utf8(b) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(b);
    let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return s;
  }

  // 地主模型的全部 initializer。名字和形状都写死：不认识的名字直接拒绝，
  // 避免把张量名当成对象键时写到 __proto__，也避免超大 dims 把内存撑爆。
  const MAX_DIM = 1024;
  const MAX_ELEMS = 262144;
  const LANDLORD_SHAPES = {
    'onnx::LSTM_131': [1, 512, 162],
    'onnx::LSTM_132': [1, 512, 128],
    'onnx::LSTM_133': [1, 1024],
    'base.dense1.weight': [512, 501],
    'base.dense1.bias': [512],
    'base.dense2.weight': [512, 512],
    'base.dense2.bias': [512],
    'base.dense3.weight': [512, 512],
    'base.dense3.bias': [512],
    'base.dense4.weight': [512, 512],
    'base.dense4.bias': [512],
    'base.dense5.weight': [512, 512],
    'base.dense5.bias': [512],
    'base.dense6.weight': [1, 512],
    'base.dense6.bias': [1]
  };

  function sameDims(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function knownShape(name) {
    if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(LANDLORD_SHAPES, name)) return null;
    return LANDLORD_SHAPES[name];
  }

  function elemsOf(dims) {
    if (!dims || !dims.length || dims.length > 4) throw new Error('onnx: 维度超出地主模型');
    let n = 1;
    for (let i = 0; i < dims.length; i++) {
      const d = dims[i];
      if ((d | 0) !== d || d <= 0 || d > MAX_DIM) throw new Error('onnx: 维度超出地主模型');
      if (n > Math.floor(MAX_ELEMS / d)) throw new Error('onnx: 张量超出地主模型');
      n *= d;
    }
    return n;
  }

  // TensorProto → { dims, data: Float32Array }
  function readTensor(tp) {
    const fs = readFields(tp);
    let name = '', dataType = 1;
    const dims = [];
    let raw = null;
    const floats = [];
    for (const f of fs) {
      if (f.f === 1 && f.t === 0) dims.push(f.v);
      else if (f.f === 1 && f.t === 2) { // packed dims（极少见）
        let o = 0;
        while (o < f.v.length) { let v; [v, o] = rdVarint(f.v, o); dims.push(v); }
      } else if (f.f === 2 && f.t === 0) dataType = f.v;
      else if (f.f === 4) { // float_data（可能 packed）
        const view = new DataView(f.v.buffer, f.v.byteOffset, f.v.byteLength);
        for (let o = 0; o + 4 <= f.v.byteLength; o += 4) floats.push(view.getFloat32(o, true));
      } else if (f.f === 8 && f.t === 2) name = utf8(f.v);
      else if (f.f === 9 && f.t === 2) raw = f.v;
    }
    if (dataType !== 1) throw new Error('onnx: 只支持 float32，收到 data_type=' + dataType);
    // 先按维度封顶，再对数据长度；dims 报大数时不要按它去分配。
    const expect = elemsOf(dims);
    let data;
    if (raw) {
      if (raw.length !== expect * 4) throw new Error('onnx: 张量长度与维度不符');
      data = new Float32Array(expect);
      const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      for (let i = 0; i < expect; i++) data[i] = view.getFloat32(i * 4, true);
    } else {
      if (floats.length !== expect) throw new Error('onnx: 张量长度与维度不符');
      data = new Float32Array(floats);
    }
    return { name, dims, data };
  }

  // 返回 { 名字: {dims, data} }，只要 graph.initializer。
  // 表用空原型，并且只收下地主模型已知名字，避免 __proto__ 之类的键。
  function parseOnnx(input) {
    const b = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (b.length > FILES.landlord.bytes) throw new Error('onnx: 文件超出地主模型体积');
    const top = readFields(b);
    let graph = null;
    for (const f of top) if (f.f === 7 && f.t === 2) graph = f.v;
    if (!graph) throw new Error('onnx: 没有 graph');
    const tensors = Object.create(null);
    for (const f of readFields(graph)) {
      if (f.f !== 5 || f.t !== 2) continue;
      const t = readTensor(f.v);
      const want = knownShape(t.name);
      if (!want || !sameDims(t.dims, want)) throw new Error('onnx: 拒绝模型形状之外的张量');
      if (Object.prototype.hasOwnProperty.call(tensors, t.name)) throw new Error('onnx: 重复张量');
      tensors[t.name] = { dims: t.dims, data: t.data };
    }
    return tensors;
  }

  /* ================= 4. 前向：LSTM(162→128) + 六层全连接 ================= */

  const HIDDEN = 128;
  const SEQ = 5;

  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

  // ONNX LSTM 门序为 i o f c；卷积核布局 [1, 4*hidden, input] / [1, 4*hidden, hidden]
  function buildModel(tensors) {
    const get = (n) => {
      const t = tensors && tensors[n];
      const want = knownShape(n);
      if (!t || !want || !sameDims(t.dims, want) || !t.data || t.data.length !== elemsOf(want)) {
        throw new Error('onnx: 缺少或拒绝张量 ' + n);
      }
      return t;
    };
    const W = get('onnx::LSTM_131'); // [1, 512, 162]
    const R = get('onnx::LSTM_132'); // [1, 512, 128]
    const B = get('onnx::LSTM_133'); // [1, 1024]
    const dense = [];
    for (let i = 1; i <= 6; i++) {
      const w = get('base.dense' + i + '.weight');
      const b = get('base.dense' + i + '.bias');
      dense.push({ w, b, out: w.dims[0], in: w.dims[1] });
    }
    return { W, R, B, dense, inputDim: dense[0].in - HIDDEN };
  }

  // z: Float32Array(5*162) → h: Float32Array(128)
  function lstmLast(model, z) {
    const { W, R, B } = model;
    const H = HIDDEN;
    const inDim = 162;
    const h = new Float32Array(H);
    const c = new Float32Array(H);
    const xh = new Float32Array(4 * H);
    for (let t = 0; t < SEQ; t++) {
      const xoff = t * inDim;
      for (let g = 0; g < 4 * H; g++) {
        let s = B.data[g] + B.data[4 * H + g]; // Wb + Rb
        const woff = g * inDim;
        for (let k = 0; k < inDim; k++) s += W.data[woff + k] * z[xoff + k];
        const roff = g * H;
        for (let k = 0; k < H; k++) {
          const hv = h[k];
          if (hv !== 0) s += R.data[roff + k] * hv;
        }
        xh[g] = s;
      }
      for (let j = 0; j < H; j++) {
        const i = sigmoid(xh[j]);           // input gate
        const o = sigmoid(xh[H + j]);       // output gate
        const f = sigmoid(xh[2 * H + j]);   // forget gate
        const g = Math.tanh(xh[3 * H + j]); // cell candidate
        const cv = f * c[j] + i * g;
        c[j] = cv;
        h[j] = o * Math.tanh(cv);
      }
    }
    return h;
  }

  // 一行 x + 共享的 LSTM 输出 → 分数
  function forwardRow(model, h, x, xoff, scratch) {
    const d = model.dense;
    let vec = scratch.a;
    for (let i = 0; i < HIDDEN; i++) vec[i] = h[i];
    vec.set(x.subarray(xoff, xoff + model.inputDim), HIDDEN);
    let len = HIDDEN + model.inputDim;
    for (let li = 0; li < d.length; li++) {
      const layer = d[li];
      const out = li % 2 === 0 ? scratch.b : scratch.a;
      const bias = layer.b.data;
      const w = layer.w.data;
      for (let j = 0; j < layer.out; j++) {
        let s = bias[j];
        const base = j * layer.in;
        for (let k = 0; k < len; k++) s += w[base + k] * vec[k];
        out[j] = (li === d.length - 1) ? s : (s > 0 ? s : 0);
      }
      vec = out;
      len = layer.out;
    }
    return vec[0];
  }

  // n 行 x（步长 dim）→ Float32Array(n) 分数
  function score(model, z, rows, n, dim) {
    const h = lstmLast(model, z);
    const out = new Float32Array(n);
    // 第一层输入是 128 + x 维（地主 501、农民 612），缓冲区按最大维开
    const wide = Math.max(512, HIDDEN + model.inputDim);
    const scratch = { a: new Float32Array(wide), b: new Float32Array(wide) };
    for (let i = 0; i < n; i++) out[i] = forwardRow(model, h, rows, i * dim, scratch);
    return out;
  }

  /* ================= 5. 权重加载（下载 / 校验 / 缓存） ================= */

  const state = {
    status: 'idle',   // idle | downloading | ready | error
    progress: 0,
    error: '',
    source: '',
    model: null
  };
  const listeners = [];
  // 快照对象只在这一份状态真的变了才换新引用：
  // 订阅者拿同一个引用时 setState 会被 React 判等跳过，不会因为「每次都是新对象」而白白重渲染
  let snap = { status: 'idle', progress: 0, error: '', source: '' };
  function syncSnap() {
    if (snap.status !== state.status || snap.progress !== state.progress ||
      snap.error !== state.error || snap.source !== state.source) {
      snap = { status: state.status, progress: state.progress, error: state.error, source: state.source };
    }
  }
  function emit() {
    syncSnap();
    for (const fn of listeners.slice()) { try { fn(snap); } catch (e) { /* ignore */ } }
  }
  function status() {
    syncSnap();
    return snap;
  }
  function onStatus(fn) {
    listeners.push(fn);
    try { fn(status()); } catch (e) { /* ignore */ }
    return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
  }

  // 算不出摘要就拒绝，不能当成「没有 sha256 也可以加载」。
  function sha256Hex(buf) {
    const fail = () => Promise.reject(new Error('sha256 不可用，拒绝加载'));
    try {
      const c = typeof crypto !== 'undefined' ? crypto : null;
      const subtle = c && c.subtle;
      if (!subtle || typeof subtle.digest !== 'function') return fail();
      return Promise.resolve()
        .then(() => subtle.digest('SHA-256', buf))
        .then((d) => {
          const u = new Uint8Array(d);
          if (u.length !== 32) throw new Error('sha256 不可用，拒绝加载');
          let s = '';
          for (let i = 0; i < u.length; i++) s += (u[i] < 16 ? '0' : '') + u[i].toString(16);
          if (s.length !== 64) throw new Error('sha256 不可用，拒绝加载');
          return s;
        })
        .catch((err) => {
          if (err && err.message === 'sha256 不可用，拒绝加载') throw err;
          throw new Error('sha256 不可用，拒绝加载');
        });
    } catch (e) {
      return fail();
    }
  }

  async function readCache(key) {
    if (typeof caches === 'undefined') return null;
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(key);
      if (!hit) return null;
      return new Uint8Array(await hit.arrayBuffer());
    } catch (e) { return null; }
  }

  async function writeCache(key, bytes) {
    if (typeof caches === 'undefined') return;
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(key, new Response(bytes, {
        headers: { 'content-type': 'application/octet-stream', 'content-length': String(bytes.length) }
      }));
    } catch (e) { /* 配额或隐私模式，忽略 */ }
  }

  async function purgeCacheEntry(key) {
    if (typeof caches === 'undefined' || !caches) return;
    try {
      const cache = await caches.open(CACHE_NAME);
      if (cache && typeof cache.delete === 'function') await cache.delete(key);
    } catch (e) { /* ignore */ }
  }

  async function purgeCacheStorage() {
    if (typeof caches === 'undefined' || !caches || typeof caches.delete !== 'function') return;
    try { await caches.delete(CACHE_NAME); } catch (e) { /* ignore */ }
  }

  async function cancelStream(stream) {
    try {
      if (stream && typeof stream.cancel === 'function') await stream.cancel();
    } catch (e) { /* ignore */ }
  }

  async function download(url, expectBytes) {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error('下载失败 HTTP ' + res.status);
    const limit = expectBytes > 0 ? expectBytes : 0;
    const declared = Number(res.headers.get('content-length'));
    // content-length 已经超了就别把 body 读进来
    if (limit && Number.isFinite(declared) && declared > limit) {
      await cancelStream(res.body);
      throw new Error('体积超出：' + declared + ' > ' + limit);
    }
    if (!res.body || typeof res.body.getReader !== 'function') {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (limit && buf.length > limit) throw new Error('体积超出：' + buf.length + ' > ' + limit);
      state.progress = 1; emit();
      return buf;
    }
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const n = value && value.length ? value.length : 0;
      // 超出预期就停，不要先把整段超大 body 拼起来
      if (limit && got + n > limit) {
        await cancelStream(reader);
        throw new Error('体积超出：' + (got + n) + ' > ' + limit);
      }
      if (n) chunks.push(value);
      got += n;
      if (limit) { state.progress = Math.min(0.99, got / limit); emit(); }
    }
    const buf = new Uint8Array(got);
    let o = 0;
    for (const ch of chunks) { buf.set(ch, o); o += ch.length; }
    return buf;
  }

  // 加载地主模型；重复调用复用同一个 Promise
  let loading = null;
  let generation = 0;
  let cacheClear = Promise.resolve();
  function load(opts) {
    if (state.status === 'ready' && state.model) return Promise.resolve(true);
    if (loading) return loading;
    const options = opts || {};
    const meta = FILES.landlord;
    const sources = options.sources || (options.url ? [options.url] : MIRRORS);
    const cacheKey = 'sota:' + meta.file;
    const myGen = generation;
    let task;
    task = (async () => {
      try {
        await cacheClear;
        if (myGen !== generation) return false;
        // 摘要能力先探一下：不行就不要去打镜像站
        try { await sha256Hex(new Uint8Array(0)); }
        catch (e) { throw new Error('sha256 不可用，拒绝加载'); }
        state.status = 'downloading'; state.progress = 0; state.error = ''; state.source = ''; emit();
        let bytes = await readCache(cacheKey);
        let fromNet = false;
        if (bytes) {
          const badLen = !!(meta.bytes && bytes.length !== meta.bytes);
          let badHash = false;
          if (!badLen) {
            const digest = await sha256Hex(bytes);
            badHash = digest !== meta.sha256;
          }
          if (badLen || badHash) {
            await purgeCacheEntry(cacheKey);
            bytes = null;
          }
        }
        if (!bytes) {
          const fails = [];
          for (const base of sources) {
            if (myGen !== generation) return false;
            const url = base + meta.file;
            try {
              const got = await download(url, meta.bytes);
              if (meta.bytes && got.length !== meta.bytes) throw new Error('体积不符：' + got.length + ' ≠ ' + meta.bytes);
              const digest = await sha256Hex(got);
              if (digest !== meta.sha256) throw new Error('sha256 不符，拒绝加载');
              bytes = got;
              state.source = base;
              fromNet = true;
              break;
            } catch (err) {
              let host = url;
              try { host = new URL(url).host; } catch (e) { /* 非法地址就原文 */ }
              fails.push(host + '：' + ((err && err.message) || err));
            }
          }
          if (!bytes) throw new Error('所有源都失败（' + fails.join('；') + '）');
        }
        let model;
        try {
          model = buildModel(parseOnnx(bytes));
        } catch (err) {
          await purgeCacheEntry(cacheKey);
          throw err;
        }
        if (myGen !== generation) return false;
        // 解析通过之后才写入缓存，坏文件不要留给下一次命中
        if (fromNet) await writeCache(cacheKey, bytes);
        if (myGen !== generation) return false;
        state.model = model;
        state.status = 'ready'; state.progress = 1; emit();
        return true;
      } catch (err) {
        if (myGen !== generation) return false;
        state.status = 'error';
        state.error = (err && err.message) || String(err);
        emit();
        throw err;
      } finally {
        if (loading === task) loading = null;
      }
    })();
    loading = task;
    return task;
  }

  // 直接从内存里的 ONNX 字节建模型（测试与本地文件用）
  function loadFromBytes(bytes) {
    state.model = buildModel(parseOnnx(bytes));
    state.status = 'ready'; state.progress = 1; emit();
    return state.model;
  }

  function ready() { return state.status === 'ready' && !!state.model; }
  function reset() {
    generation++;
    loading = null;
    state.status = 'idle'; state.progress = 0; state.error = ''; state.source = ''; state.model = null;
    cacheClear = purgeCacheStorage();
    emit();
    return cacheClear;
  }

  // ctx + 候选动作 counts → { index, scores }
  function rank(ctx, legalCounts) {
    if (!ready()) throw new Error('sota 模型未加载');
    if (!legalCounts || !legalCounts.length) return { index: -1, scores: [] };
    const { rows, dim } = encodeX(ctx, legalCounts);
    const z = encodeZ(ctx.history || []);
    const scores = score(state.model, z, rows, legalCounts.length, dim);
    let best = 0;
    for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
    return { index: best, scores: Array.from(scores) };
  }

  return {
    REMOTE, MIRRORS, FILES, CACHE_NAME,
    cardCol, cards2array, countsOfCards, encodeZ, encodeBase, encodeX,
    parseOnnx, buildModel, lstmLast, score,
    load, loadFromBytes, ready, reset, rank, status, onStatus
  };
});
