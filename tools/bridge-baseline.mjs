// 竞技场桥：把 Node 版斗地主军师引擎暴露成 HTTP 接口，供 Python 侧（rlcard 裁判）调用
// 用法：node tools/bridge.mjs [port]
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const DDZ = require('./engine-baseline.cjs');

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

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, engine: 'doudizhu-assistant' }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/move') {
    res.writeHead(404).end('not found');
    return;
  }
  let raw = '';
  req.on('data', (d) => { raw += d; });
  req.on('end', () => {
    try {
      const out = decide(JSON.parse(raw || '{}'));
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
