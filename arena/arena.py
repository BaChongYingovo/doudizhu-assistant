"""斗地主军师 × rlcard 官方裁判 的竞技场。

用法（在 doudizhu 目录下）：
    python arena/arena.py --games 200 --seat 0 --opp random
    python arena/arena.py --games 200 --seat 1 --opp random --out arena/result-farmer.json

需先起桥：node tools/bridge.mjs 8791
PYTHONPATH 需包含 rlcard 源码（research/dist/rlcard-1.2.0 与 research/vendored）。
"""
import argparse
import json
import os
import random
import statistics
import sys
import time
import urllib.request
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
for p in (os.path.join(ROOT, 'research', 'dist', 'rlcard-1.2.0'),
          os.path.join(ROOT, 'research', 'vendored')):
    if os.path.isdir(p) and p not in sys.path:
        sys.path.insert(0, p)

from rlcard.envs.doudizhu import DoudizhuEnv  # noqa: E402
from rlcard.games.doudizhu.utils import ACTION_2_ID, ID_2_ACTION  # noqa: E402


def canon(cards):
    return tuple(sorted(Counter(cards).items()))


def ask_bridge(port, body, timeout=5):
    req = urllib.request.Request(
        'http://127.0.0.1:%d/move' % port,
        data=json.dumps(body).encode('utf-8'),
        headers={'content-type': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def find_action(legal_ids, move_str):
    key = canon(move_str)
    for aid in sorted(legal_ids):
        if ID_2_ACTION[aid] != 'pass' and canon(ID_2_ACTION[aid]) == key:
            return aid
    return None


def our_action(state, pid, port, tier='go'):
    raw = state['raw_obs']
    body = {
        'hand': raw['current_hand'],
        'me': int(raw['self']),
        'landlord': int(raw['landlord']),
        'seatCounts': [int(n) for n in raw['num_cards_left']],
        'trace': [[int(a), b] for a, b in raw['trace']],
        'bottom': raw.get('seen_cards') or '',
        'tier': tier,
    }
    decision = ask_bridge(port, body)
    legal = list(state['legal_actions'].keys())
    if decision.get('pass'):
        return ACTION_2_ID['pass'] if ACTION_2_ID['pass'] in legal else None, decision
    aid = find_action(legal, decision['move'])
    return aid, decision


def random_action(state, rng):
    legal = list(state['legal_actions'].keys())
    return rng.choice(legal)


def play_one(env, seat, port, rng, opp='random', tier='go', opp_tier='go'):
    state, pid = env.reset()
    steps = 0
    illegal = 0
    decisions = []
    while not env.is_over():
        if pid == seat:
            try:
                aid, decision = our_action(state, pid, port, tier)
            except Exception as e:  # 桥挂了也要能跑完，记为非法/兜底
                aid, decision = None, {'error': str(e)}
            if aid is None:
                illegal += 1
                if os.environ.get('ARENA_DEBUG') and illegal <= 3:
                    legal = [ID_2_ACTION[a] for a in state['legal_actions']]
                    print('!! 非法建议 pid=%d 建议=%r pass=%r 手牌=%s 合法=%s trace=%r' % (
                        pid, decision.get('move'), decision.get('pass'),
                        state['raw_obs']['current_hand'], legal,
                        state['raw_obs']['trace'][-4:]), file=sys.stderr)
                aid = random_action(state, rng)
            decisions.append({'turn': steps, 'move': decision.get('move'),
                              'pass': bool(decision.get('pass')),
                              'reason': decision.get('reason', '')[:60]})
        else:
            if opp == 'random':
                aid = random_action(state, rng)
            elif opp == 'bridge':
                try:
                    oaid, _ = our_action(state, pid, port, opp_tier)
                except Exception:
                    oaid = None
                aid = oaid if oaid is not None else random_action(state, rng)
            elif opp == 'min':  # 最简单的贪心：能出就出牌数最少的
                # 必须按 (张数, 牌面) 排序再取：legal_actions 的遍历顺序受
                # PYTHONHASHSEED 影响，只按 len 取 min 会让同一个种子每次跑出不同对局。
                legal = list(state['legal_actions'].keys())
                plays = [a for a in legal if ID_2_ACTION[a] != 'pass']
                aid = (min(plays, key=lambda a: (len(ID_2_ACTION[a]), ID_2_ACTION[a]))
                       if plays else ACTION_2_ID['pass'])
            else:
                raise SystemExit('unknown opp: ' + opp)
        state, pid = env.step(aid)
        steps += 1
    payoffs = [int(x) for x in env.get_payoffs()]
    return {
        'mine': payoffs[seat],
        'payoffs': payoffs,
        'steps': steps,
        'illegal': illegal,
        'role': 'landlord' if seat == 0 else 'farmer',
        'decisions': decisions,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--games', type=int, default=100)
    ap.add_argument('--seat', type=int, default=0, choices=[0, 1, 2])
    ap.add_argument('--opp', default='random', choices=['random', 'min', 'bridge'])
    ap.add_argument('--opp-tier', default='go', choices=['free', 'go', 'plus', 'pro', 'ultra'])
    ap.add_argument('--tier', default='go', choices=['free', 'go', 'plus', 'pro', 'ultra', 'sota'])
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--port', type=int, default=8791)
    ap.add_argument('--out', default='')
    ap.add_argument('--quiet', action='store_true')
    args = ap.parse_args()

    rng = random.Random(args.seed)
    env = DoudizhuEnv({'seed': args.seed, 'allow_step_back': False})
    results = []
    t0 = time.time()
    for g in range(args.games):
        r = play_one(env, args.seat, args.port, rng, args.opp, args.tier, args.opp_tier)
        r['game'] = g
        results.append(r)
        if not args.quiet and (g + 1) % 20 == 0:
            wins = sum(1 for x in results if x['mine'] > 0)
            print('  已跑 %d 局，胜 %d，非法兜底 %d' % (g + 1, wins, sum(x['illegal'] for x in results)),
                  flush=True)

    wins = sum(1 for x in results if x['mine'] > 0)
    losses = sum(1 for x in results if x['mine'] < 0)
    total_steps = sum(x['steps'] for x in results)
    illegal = sum(x['illegal'] for x in results)
    summary = {
        'games': args.games,
        'seat': args.seat,
        'role': 'landlord' if args.seat == 0 else 'farmer',
        'opponent': args.opp,
        'tier': args.tier,
        'opp_tier': args.opp_tier,
        'wins': wins,
        'losses': losses,
        'win_rate': round(wins / args.games, 4),
        'avg_steps': round(total_steps / args.games, 1),
        'illegal_fallbacks': illegal,
        'seconds': round(time.time() - t0, 1),
        'avg_decision_ms': round(1000.0 * (time.time() - t0) / max(1, total_steps), 2),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f:
            json.dump({'summary': summary, 'games': results}, f, ensure_ascii=False)
        print('写盘：' + args.out)


if __name__ == '__main__':
    main()
