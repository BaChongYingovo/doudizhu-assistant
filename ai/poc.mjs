#!/usr/bin/env node
// PerfectDou ONNX / Node feasibility POC — self-contained, no plugin/ changes.
// Reproducible:  cd doudizhu/ai && node poc.mjs
//
// What this proves (and deliberately does NOT do):
//   * Loads the three vendored PerfectDou ONNX models with onnxruntime-node.
//   * Reconstructs the InfoSet observation tensor from the upstream repo data
//     (generate_eval_data.py deal + env.py _cards2array + specific_map.json /
//     action_space.json / card_type.json) following the exact input contract
//     recovered from the ONNX graph initializers (see POC.md).
//   * Runs a forward, prints shapes + a raw logit slice, and maps argmax back
//     to an abstract action id and then to one of the 27471 rlcard actions.
//   * Times 200 forwards (p50/p95) and measures ./node_modules size.
//   * It does NOT integrate with the plugin, game.js, UI, or state machine.
//
// NOTE: upstream perfectdou/env/encode.py is shipped only as a Linux-only
// compiled .so (encode.cpython-37m-x86_64-linux-gnu.so), so its exact plane
// semantics cannot be executed on Windows. The state block below is a
// self-consistent reconstruction of the graph's [26,12,15] layout; the action
// slot layout, action ids and legality mask are exact (verified empirically).

import * as ort from 'onnxruntime-node';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PD = path.resolve(HERE, '..', 'research', 'dist', 'PerfectDou-main');
const MODEL_DIR = path.join(PD, 'perfectdou', 'model', 'perfectdou');
const MODELS = ['landlord', 'landlord_up', 'landlord_down'];

const readJSON = (f) => JSON.parse(readFileSync(path.join(PD, f), 'utf8'));
const actionSpace = readJSON('action_space.json');   // 621 abstract action ids
const specificMap = readJSON('specific_map.json');   // 27471 concrete -> abstract key(s) + "pass"
const cardType = readJSON('card_type.json');         // 27471 rlcard concrete actions
const cardKeys = Object.keys(cardType);
const idToKey = new Array(621);
for (const [k, id] of Object.entries(actionSpace)) idToKey[id] = k;

// ---- rlcard <-> PerfectDou env card integers --------------------------------
const CH2ENV = { '3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14,'2':17,'B':20,'R':30 };
const CH2RL  = { '3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14,'2':15,'B':16,'R':17 };
const ENV2RL  = { 3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,11:11,12:12,13:13,14:14,17:15,20:16,30:17 };
const CARD2COL = { 3:0,4:1,5:2,6:3,7:4,8:5,9:6,10:7,11:8,12:9,13:10,14:11,17:12 };

function cards2array(envCards) {
  // faithful port of perfectdou/env/env.py::_cards2array -> 54 floats
  const m = new Float32Array(4 * 13);
  const jokers = new Float32Array(2);
  const cnt = new Map();
  for (const c of envCards) cnt.set(c, (cnt.get(c) || 0) + 1);
  for (const [c, n] of cnt) {
    if (c < 20) {
      const col = CARD2COL[c];
      for (let r = 0; r < 4; r++) m[col * 4 + r] = r < n ? 1 : 0;
    } else if (c === 20) jokers[0] = 1;
    else if (c === 30) jokers[1] = 1;
  }
  const out = new Float32Array(54);
  out.set(m, 0);          // m is already column-major (4 rows x 13 cols)
  out.set(jokers, 52);
  return out;
}

const parseConcrete = (key) => Array.from(key, (ch) => CH2ENV[ch]);

function fitsHand(key, counts) {
  const need = new Array(15).fill(0);
  for (const ch of key) need[CH2RL[ch] - 3]++;
  return need.every((n, i) => n <= counts[i]);
}

function concreteToAbstractId(key) {
  const arr = specificMap[key];
  if (!arr) return null;
  for (const a of arr) if (a in actionSpace) return actionSpace[a];
  return null;
}

// ---- one deterministic real deal (same deck as generate_eval_data.py) --------
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function deal(seed = 20261109) {
  const deck = [];
  for (let r = 3; r <= 14; r++) for (let k = 0; k < 4; k++) deck.push(r);
  for (let k = 0; k < 4; k++) deck.push(17);
  deck.push(20, 30);
  const rnd = mulberry32(seed);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const toCounts = (arr) => {
    const c = new Array(15).fill(0);
    for (const e of arr) c[ENV2RL[e] - 3]++;
    return c;
  };
  return {
    landlord: deck.slice(0, 20),
    landlord_up: deck.slice(20, 37),
    landlord_down: deck.slice(37, 54),
    three_landlord_cards: deck.slice(17, 20),
    landlordCounts: toCounts(deck.slice(0, 20)),
    otherCounts: toCounts(deck.slice(20)),
  };
}

// ---- build the 32738-float InfoSet observation -----------------------------
const N = 32738, STATE = 4680, EXTRA = 8, ACTION_BASE = 4688, SLOT = 187, MAX_SLOTS = 150;
function buildObservation(d) {
  const buf = new Float32Array(N);

  // [0:4680] reshaped by the graph as 26 planes x 12 x 15.
  // Plane layout is reconstructed from ONNX Slice constants:
  //   planes 2..3  + planes 19..25 -> 1620-dim "card feature" block
  //   planes 4..18                 -> 5 x 540 LSTM history steps
  //   planes 0..1                  -> unused by this graph
  const plane = (p) => p * 180;
  const putCount = (p, counts, featBase) => {
    for (let r = 0; r < 15; r++)
      for (let k = 0; k < Math.min(counts[r], 4); k++) buf[plane(p) + r * 12 + featBase + k] = 1;
  };
  putCount(2, d.landlordCounts, 0);   // my hand (features 0..3)
  putCount(3, d.otherCounts, 4);     // other two hands (features 4..7)
  // 7 "summary" planes at 19..25: card-left counts / bomb one-hot / empty history.
  buf[plane(19) + 0] = 17 / 20;       // landlord_up cards left (normalized)
  buf[plane(20) + 0] = 17 / 20;       // landlord_down cards left
  buf[plane(21) + 0] = 1;             // landlord cards left (20)
  buf[plane(22) + 0] = 1;             // bomb_num = 0 one-hot
  // planes 4..18, 23..25 stay zero (opening lead: no played cards / no history)

  // [4680:4688] 8 extra floats; graph appends the last 6 (col 2..7).
  const extra = new Float32Array([0, 0, 0, 17 / 20, 17 / 20, 1, 1, 0]);
  buf.set(extra, STATE);

  // Legal actions = rlcard card_type.json actions whose cards fit this hand,
  // collapsed to distinct abstract ids (the policy outputs 621 logits).
  const legalConcrete = cardKeys.filter((k) => fitsHand(k, d.landlordCounts));
  const repBySlot = new Map(); // abstract id -> representative concrete action
  for (const k of legalConcrete) {
    const id = concreteToAbstractId(k);
    if (id == null || repBySlot.has(id)) continue;
    repBySlot.set(id, k);
  }
  const slots = [...repBySlot.entries()].slice(0, MAX_SLOTS);

  for (let i = 0; i < MAX_SLOTS; i++) {
    const b = ACTION_BASE + i * SLOT;
    if (i < slots.length) {
      const [id, rep] = slots[i];
      buf[b] = id;                       // col 0 = abstract action id (OneHot depth 621)
      buf[b + 6] = 1;                    // col 6 = legality flag (Greater > 0)
      const arr = cards2array(parseConcrete(rep));
      for (let j = 0; j < 54; j++) buf[b + 7 + j] = arr[j]; // action card features
      // cols 1..5 and 61..186 stay zero (exact upstream features are in the closed .so)
    } else {
      buf[b] = 0;
      buf[b + 6] = 0;                    // masked-out slot
    }
  }
  return { buf, slots, legalConcrete };
}

function dirSize(p) {
  let s = 0;
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const fp = path.join(p, e.name);
    if (e.isDirectory()) s += dirSize(fp);
    else if (e.isFile()) s += statSync(fp).size;
  }
  return s;
}
const pct = (a, q) => a[Math.min(a.length - 1, Math.floor(q * a.length))];

const ortp = JSON.parse(readFileSync(path.join(HERE, 'node_modules', 'onnxruntime-node', 'package.json'), 'utf8'));
console.log('=== PerfectDou ONNX / Node POC ===');
console.log('onnxruntime-node version :', ortp.version);
console.log('action_space (abstract)  :', Object.keys(actionSpace).length, 'ids 0..' + (Object.keys(actionSpace).length - 1));
console.log('card_type (rlcard truth) :', cardKeys.length, 'concrete actions');
console.log('specific_map             :', Object.keys(specificMap).length, 'keys (incl. pass)');

const modelBytes = MODELS.map((m) => statSync(path.join(MODEL_DIR, m + '.onnx')).size);
console.log('model files              :', MODELS.map((m, i) => `${m}.onnx=${(modelBytes[i] / 1048576).toFixed(2)}MiB`).join(', '));
console.log('weights copied into ai/  : NO (referenced in place under research/dist/)');

const obs = buildObservation(deal());
console.log('real deal (landlord)     :', obs.legalConcrete.length, 'legal concrete actions ->', obs.slots.length, 'abstract slots');
console.log('observation              : Float32Array[' + N + '], first 12 =', Array.from(obs.buf.slice(0, 12)));

const sessions = {};
for (const m of MODELS) {
  const s = await ort.InferenceSession.create(path.join(MODEL_DIR, m + '.onnx'));
  sessions[m] = s;
  const im = s.inputMetadata[0], om = s.outputMetadata[0];
  console.log(`[meta] ${m}.onnx input=${im.name} type=${im.type} shape=${JSON.stringify(im.shape)} | output=${om.name} shape=${JSON.stringify(om.shape)}`);
}

const feedName = sessions.landlord.inputNames[0];
const outName = sessions.landlord.outputNames[0];
const tensor = new ort.Tensor('float32', obs.buf, [1, N]);
const feeds = { [feedName]: tensor };

// ---- one forward on each model, with shapes + raw logit snippet --------------
for (const m of MODELS) {
  const s = sessions[m];
  const feedsM = { [s.inputNames[0]]: new ort.Tensor('float32', obs.buf, [1, N]) };
  const res = await s.run(feedsM);
  const o = res[s.outputNames[0]];
  const finite = Array.from(o.data).filter((v) => Number.isFinite(v) && v > -1e30);
  console.log(`[forward] ${m}.onnx output dims=${JSON.stringify(o.dims)} len=${o.data.length} finiteLogits=${finite.length}`);
}
const first = await sessions.landlord.run(feeds);
const logits = first[outName].data;
let best = -1, bestVal = -Infinity;
for (let i = 0; i < logits.length; i++) if (logits[i] > bestVal) { bestVal = logits[i]; best = i; }
const finiteIds = [];
for (let i = 0; i < logits.length; i++) if (Number.isFinite(logits[i]) && logits[i] > -1e30) finiteIds.push(i);
console.log('[forward] raw logits[0..9] =', Array.from(logits.slice(0, 10)));
console.log('[forward] masked logits[10..12] =', Array.from(logits.slice(10, 13)), '(illegal ids = -3.4028234663852886e+38)');
console.log('[forward] argmax abstract id =', best, 'key =', idToKey[best], 'logit =', bestVal);
console.log('[forward] finite abstract ids =', finiteIds.length, 'expected slots =', obs.slots.length);

// ---- map argmax back into the 27471-action rlcard space ---------------------
const absKey = idToKey[best];
const concrete = obs.legalConcrete.find((k) => specificMap[k] && specificMap[k].includes(absKey));
const actionIdx = cardKeys.indexOf(concrete);
console.log('[map] abstract id', best, '->', JSON.stringify(absKey), '-> concrete', JSON.stringify(concrete), '-> rlcard card_type index', actionIdx, 'of', cardKeys.length);
if (best < 0 || best > 620 || concrete == null || actionIdx < 0) {
  throw new Error('output action id did not map back into the 27471 action space');
}
console.log('[map] OK: 621 logits -> abstract id -> 27471-action card_type.json');

// ---- 200 forwards, p50 / p95 -------------------------------------------------
for (let i = 0; i < 10; i++) await sessions.landlord.run(feeds); // warm-up
const times = [];
for (let i = 0; i < 200; i++) {
  const t0 = performance.now();
  await sessions.landlord.run(feeds);
  times.push(performance.now() - t0);
}
times.sort((a, b) => a - b);
console.log(`[bench] 200 forwards landlord.onnx  p50=${pct(times, 0.50).toFixed(3)}ms  p95=${pct(times, 0.95).toFixed(3)}ms  min=${times[0].toFixed(3)}ms  max=${times[times.length - 1].toFixed(3)}ms`);

const nm = dirSize(path.join(HERE, 'node_modules'));
console.log(`[size] ai/node_modules = ${nm} bytes = ${(nm / 1048576).toFixed(2)} MiB (${(nm / 1000000).toFixed(2)} MB)`);
console.log('=== POC DONE: 通 ===');
