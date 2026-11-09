// 竞技场桥：把 Node 版斗地主军师引擎暴露成 HTTP 接口，供 Python 侧（rlcard 裁判）调用
// 用法：node tools/bridge.mjs [port]
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const DDZ = require('./engine.cjs');

const PORT = Number(process.argv[2] || 8791);
const RC = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15, 'B': 16, 'R': 17
};
const CR = { 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: 'T',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2', 16: 'B', 17: 'R' };

function toCounts(str) {
  const c = new Array(15).fill(0);
  for (const ch of String(str || '')) {
    if (ch === ' ' || ch === '|' || ch === ',') continue;
    const r = RC[ch];
    if (!r) throw new Error('bad card: ' + ch);
    c[r - 3]++;
  }
  return c;
}

function toStr(cards) {
  return cards.map((r) => CR[r]).join('');
}

function decide(body) {
  const hand = toCounts(body.hand);
  const me = Number(body.me);
  const landlord = Number(body.landlord);
  const seatCounts = (body.seatCounts || []).map(Number);
  const trace = body.trace || [];

  // 最近一次非 pass 出牌；若出牌人是我 → 我是领出者，last 置空
  let last = null;
  for (let i = trace.length - 1; i >= 0; i--) {
    const [pid, act] = trace[i];
    if (act === 'pass') continue;
    if (Number(pid) !== me) {
      const move = DDZ.classify(toCounts(act).flatMap((n, idx) => Array(n).fill(idx + 3)));
      last = { seat: Number(pid), move };
    }
    break;
  }

  // 已出现的牌（trace 里每一次非 pass 出的牌，不含我手里的）
  const played = new Array(15).fill(0);
  for (const [, act] of trace) {
    if (!act || act === 'pass') continue;
    const c = toCounts(act);
    for (let i = 0; i < 15; i++) played[i] += c[i];
  }

  const bottom = body.bottom ? DDZ.parseCards(body.bottom) : undefined;
  const tier = body.tier || 'go';
  const res = DDZ.advise({ hand, me, landlord, seatCounts, played, last, bottom }, { tier });
  return {
    pass: !!res.pass,
    move: res.move ? toStr(res.move.cards) : null,
    reason: res.reason || '',
    restPlan: res.plan == null ? null : res.plan,
    options: (res.options || []).map((o) => (o.move ? toStr(o.move.cards) : null))
  };
}


// ---- DouZero (SOTA) 档 ----
let dz = null
async function douzeroDecide(body, trace) {
  if (!dz) {
    const mod = await import('../ai/douzero.mjs')
    dz = new mod.DouZeroPolicy()
  }
  const hand = toCounts(body.hand)
  const me = Number(body.me)
  const landlord = Number(body.landlord)
  const seatCounts = (body.seatCounts || []).map(Number)
  const full = new Array(15).fill(0)
  for (let i = 0; i < 13; i++) full[i] = 4
  full[13] = 1; full[14] = 1
  const perSeat = [new Array(15).fill(0), new Array(15).fill(0), new Array(15).fill(0)]
  const lastBySeat = [null, null, null]
  const seq = []
  let played = new Array(15).fill(0)
  let bombs = 0
  for (const [pid, act] of trace) {
    const seat = Number(pid)
    if (!act || act === 'pass') { seq.push(new Array(15).fill(0)); continue }
    const c = toCounts(act)
    seq.push(c)
    for (let i = 0; i < 15; i++) { perSeat[seat][i] += c[i]; played[i] += c[i] }
    lastBySeat[seat] = c
    const mv = DDZ.classify(c.flatMap((n, idx) => Array(n).fill(idx + 3)))
    if (mv && (mv.type === 'bomb' || mv.type === 'rocket')) bombs++
  }
  const other = new Array(15).fill(0)
  for (let i = 0; i < 15; i++) other[i] = Math.max(0, full[i] - hand[i] - played[i])
  // 最近一次非 pass（若是我出的，视为我领出）
  let lastCounts = new Array(15).fill(0)
  for (let i = trace.length - 1; i >= 0; i--) {
    const [pid, act] = trace[i]
    if (!act || act === 'pass') continue
    if (Number(pid) !== me) lastCounts = toCounts(act)
    break
  }
  const landlordSeat = landlord
  const downSeat = (landlord + 1) % 3
  const upSeat = (landlord + 2) % 3
  const empty = new Array(15).fill(0)
  const base = {
    myCounts: hand, otherCounts: other,
    lastCounts, bombNum: Math.min(bombs, 14),
    history: seq.map((c) => ({ counts: c }))
  }
  // 农民位默认回退启发式档：DouZero 的农民模型依赖同水平队友，实测低于本引擎
  if (me !== landlordSeat && process.env.DZ_SOTA_FARMER !== '1') {
    const fb = decide({ ...body, tier: process.env.DZ_FARMER_TIER || 'go' })
    return { ...fb, reason: 'sota: 农民位回退启发式（' + (process.env.DZ_FARMER_TIER || 'go') + '）' }
  }

  let ctx
  if (me === landlordSeat) {
    ctx = { ...base, position: 'landlord',
      playedCounts: { landlord_up: perSeat[upSeat], landlord_down: perSeat[downSeat] },
      numLeft: { landlord_up: seatCounts[upSeat], landlord_down: seatCounts[downSeat] } }
  } else {
    const teammate = me === upSeat ? downSeat : upSeat
    const pos = me === upSeat ? 'landlord_up' : 'landlord_down'
    ctx = { ...base, position: pos,
      playedCounts: { landlord: perSeat[landlordSeat], teammate: perSeat[teammate] },
      lastLandlordCounts: lastBySeat[landlordSeat] || empty,
      lastTeammateCounts: lastBySeat[teammate] || empty,
      numLeft: { landlord: seatCounts[landlordSeat], teammate: seatCounts[teammate] } }
  }
  // 合法动作：优先用引擎生成的（已对齐 rlcard）
  const lastMove = lastCounts.some((n) => n) ? DDZ.classify(lastCounts.flatMap((n, i) => Array(n).fill(i + 3))) : null
  const moves = DDZ.generateMoves(hand, lastMove)
  const counts = moves.map((m) => { const c = new Array(15).fill(0); for (const r of m.cards) c[r - 3]++; return c })
  if (!counts.length) return { pass: true, move: null, reason: 'sota: 要不起' }
  const { index } = await dz.rank(ctx.position, ctx, counts)
  return { pass: false, move: toStr(moves[index].cards), reason: 'sota: DouZero WP' }
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, engine: 'doudizhu-assistant', src: DDZ.__src, sha: DDZ.__sha, sota: true }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/move') {
    res.writeHead(404).end('not found');
    return;
  }
  let raw = '';
  req.on('data', (d) => { raw += d; });
  req.on('end', async () => {
    try {
      const body = JSON.parse(raw || '{}');
      const out = (body.tier === 'sota')
        ? await douzeroDecide(body, body.trace || [])
        : decide(body);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out));
    } catch (e) {
      const stack = String((e && e.stack) || e).split('\n').slice(1, 4).join(' | ');
      process.stderr.write('bridge error: ' + (e && e.message) + ' <- ' + stack +
        '\n  body=' + raw.slice(0, 600) + '\n');
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: String(e && e.message) }));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('bridge listening on http://127.0.0.1:' + PORT);
});
