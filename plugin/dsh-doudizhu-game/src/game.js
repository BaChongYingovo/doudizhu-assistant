/*!
 * 斗地主 · 对局规则核心（纯逻辑，不碰 DOM）
 *
 * 规则要点（按用户确认的口径）：
 *  - 叫地主两种玩法：叫分（0/1/2/3）或抢地主（叫/不叫、抢/不抢），随机一人先叫
 *  - 定地主后三人同时选加倍：1（不加倍）/2（加倍）/4（超级加倍）
 *  - 明牌：亮了就 ×2，并让对手手牌可见
 *  - 底分 1；炸弹 ×2；王炸 ×2；春天 ×2；反春 ×2
 *  - 顺子 ≥5 张；连对 ≥3 对；2 和王不进顺子/连对
 *  - 三带一可以带单王；四带两单/四带两对；飞机带单/带对
 *
 * 座位：0 = 我，1 = 下家（我右边），2 = 上家（我左边）；出牌顺序 0 → 1 → 2 → 0
 */
function GameCore(DDZ) {
  'use strict'

  const N = 15
  const { total, minus, countsOf, cardsOf } = DDZ

  function zero() { return new Array(N).fill(0) }
  function clone(c) { return c.slice() }
  function nextSeat(s) { return (s + 1) % 3 }
  function prevSeat(s) { return (s + 2) % 3 }

  function makeDeck() {
    const deck = []
    for (let r = 3; r <= 15; r++) for (let k = 0; k < 4; k++) deck.push(r)
    deck.push(16, 17)
    return deck
  }

  function shuffledDeck(rng) {
    const a = makeDeck()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor((rng || Math.random)() * (i + 1))
      const t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
  }

  /* ------------------------------------------------------------------ *
   * 新的一局
   * ------------------------------------------------------------------ */

  function createGame(opts) {
    opts = opts || {}
    const mode = opts.mode === 'rob' ? 'rob' : 'score'
    const rng = opts.rng || Math.random
    const tiers = (opts.tiers || ['go', 'go', 'go']).map(t => DDZ.tierOf(t))
    const deck = shuffledDeck(rng)
    const hands = [countsOf(deck.slice(0, 17)), countsOf(deck.slice(17, 34)), countsOf(deck.slice(34, 51))]
    const bottom = countsOf(deck.slice(51))
    const first = Math.floor(rng() * 3)

    const st = {
      mode,
      tiers,
      hands,
      bottom,
      landlord: -1,
      phase: 'bid',            // bid → double → play → over | redeal
      bidOrder: [first, nextSeat(first), prevSeat(first)],
      bidIdx: 0,
      bidHigh: 0,
      bidHighSeat: -1,
      bidLog: [],
      doubleChosen: [false, false, false],
      doubling: [1, 1, 1],
      open: [false, false, false],
      bombs: 0,
      turn: first,
      last: null,              // { seat, move }
      lastLeader: -1,
      passes: 0,
      played: zero(),
      playCounts: [0, 0, 0],
      recent: {},              // seat -> { type:'play', cards } | { type:'pass' }，只存本轮，供牌桌两侧显示
      replay: [],
      winners: null,           // 'landlord' | 'farmers'
      result: null,
      startedAt: Date.now(),
      endedAt: 0,
      base: 1
    }
    st.replay.push({ type: 'deal', hands: hands.map(h => h.slice()), bottom: bottom.slice(), first, mode })
    return st
  }

  /* ------------------------------------------------------------------ *
   * 叫地主
   * ------------------------------------------------------------------ */

  function bidSeat(st) { return st.bidOrder[st.bidIdx] }

  function bidOptions(st) {
    if (st.phase !== 'bid') return []
    if (st.mode === 'score') {
      const opts = [0]
      for (let v = 1; v <= 3; v++) if (v > st.bidHigh) opts.push(v)
      return opts
    }
    return st.bidHighSeat < 0 ? ['call', 0] : ['rob', 0]
  }

  /* ------------------------------------------------------------------ *
   * 手牌强度：结构化评分（叫分 / 加倍共用同一把尺子）
   *
   * 拆成三块，每块都能单独解释、单独验证：
   *   control 控制牌：大王 / 小王 / 2 / A / K 的张数 × 具名权重
   *   power   爆发力：炸弹（四张同点）、王炸
   *   shape   手数：约几手能出完，越少越好（基准 10 手）
   * score = min(10, 三块之和)，对外仍是一个 0..10 的数。
   * 权重全部是 0.05 的整数倍，末了按 2 位小数取整，阈值边界不会被浮点误差抹掉。
   * ------------------------------------------------------------------ */

  const STRENGTH_WEIGHTS = Object.freeze({
    cap: 10,
    control: Object.freeze({ bigJoker: 4.5, smallJoker: 2.4, two: 1.5, ace: 0.8, king: 0.3 }),
    power: Object.freeze({ bomb: 4.2, rocket: 3.5 }),
    shape: Object.freeze({ baseline: 10, perPlan: 0.55 })
  })

  // 叫分 / 抢地主 / 加倍的判定线，全部提为具名常量，不再在分支里散落魔数
  const BID_THRESHOLDS = Object.freeze({ three: 7.4, two: 5.6, one: 4.0, call: 4.6, rob: 5.8 })
  const DOUBLE_THRESHOLDS = Object.freeze({ superDouble: 7.2, double: 5.0 })

  const round2 = x => Math.round(x * 100) / 100

  function strengthBreakdown(st, seat) {
    const raw = st.hands && st.hands[seat]
    const h = (raw && raw.length === N) ? raw : zero()
    const w = STRENGTH_WEIGHTS.control
    const control = {
      bigJoker: h[14] * w.bigJoker,
      smallJoker: h[13] * w.smallJoker,
      two: h[12] * w.two,
      ace: h[11] * w.ace,
      king: h[10] * w.king
    }
    control.total = round2(control.bigJoker + control.smallJoker + control.two + control.ace + control.king)

    let bombs = 0
    for (let i = 0; i < N; i++) if (h[i] === 4) bombs++
    const hasRocket = h[13] > 0 && h[14] > 0
    const power = {
      bombs,
      rocket: hasRocket,
      bombScore: round2(bombs * STRENGTH_WEIGHTS.power.bomb),
      rocketScore: hasRocket ? STRENGTH_WEIGHTS.power.rocket : 0
    }
    power.total = round2(power.bombScore + power.rocketScore)

    const plans = DDZ.planCount(h)
    const saved = Math.max(0, STRENGTH_WEIGHTS.shape.baseline - plans)
    const shape = {
      plans,
      saved,
      perPlan: STRENGTH_WEIGHTS.shape.perPlan,
      total: round2(saved * STRENGTH_WEIGHTS.shape.perPlan)
    }

    const total = round2(control.total + power.total + shape.total)
    return { control, power, shape, raw: total, score: Math.min(STRENGTH_WEIGHTS.cap, total) }
  }

  // 对外行为不变：一个 0..10 的数
  function strength(st, seat) { return strengthBreakdown(st, seat).score }

  // 可解释：把分数拆给人看
  function explainStrength(st, seat) {
    const d = strengthBreakdown(st, seat)
    return `控制牌 ${d.control.total} + 炸弹/王炸 ${d.power.total} + 手数(${d.shape.plans}手/省${d.shape.saved}手) ${d.shape.total} = ${d.score}`
  }

  function aiBid(st, seat) {
    const s = strength(st, seat)
    if (st.mode === 'score') {
      let v = 0
      if (s >= BID_THRESHOLDS.three) v = 3
      else if (s >= BID_THRESHOLDS.two) v = 2
      else if (s >= BID_THRESHOLDS.one) v = 1
      // 已经有人叫得比这高了就叫不了，只能过
      return v > st.bidHigh ? v : 0
    }
    if (st.bidHighSeat < 0) return s >= BID_THRESHOLDS.call ? 'call' : 0
    return s >= BID_THRESHOLDS.rob ? 'rob' : 0
  }

  function applyBid(st, seat, value) {
    if (st.phase !== 'bid' || seat !== bidSeat(st)) throw new Error('还没轮到这家叫')
    const opts = bidOptions(st)
    if (opts.indexOf(value) < 0) throw new Error('这个叫法不合法')
    if (st.mode === 'score') {
      if (value > 0) { st.bidHigh = value; st.bidHighSeat = seat }
      st.bidLog.push({ seat, value })
    } else {
      if (value === 'call' || value === 'rob') st.bidHighSeat = seat
      st.bidLog.push({ seat, value: value === 0 ? 0 : value })
    }
    st.replay.push({ type: 'bid', seat, value })
    st.bidIdx++
    if (st.bidIdx >= 3) {
      if (st.bidHighSeat < 0) {
        st.phase = 'redeal'
        return st
      }
      st.landlord = st.bidHighSeat
      st.hands[st.landlord] = DDZ.addCards(st.hands[st.landlord], cardsOf(st.bottom))
      st.phase = 'double'
    } else {
      st.turn = bidSeat(st)
    }
    return st
  }

  /* ------------------------------------------------------------------ *
   * 加倍
   * ------------------------------------------------------------------ */

  function aiDouble(st, seat) {
    const s = strength(st, seat)
    if (s >= DOUBLE_THRESHOLDS.superDouble) return 4
    if (s >= DOUBLE_THRESHOLDS.double) return 2
    return 1
  }

  function applyDouble(st, seat, value) {
    if (st.phase !== 'double') throw new Error('现在不是加倍阶段')
    if ([1, 2, 4].indexOf(value) < 0) throw new Error('加倍只能选 1/2/4')
    st.doubling[seat] = value
    st.doubleChosen[seat] = true
    st.replay.push({ type: 'double', seat, value })
    if (st.doubleChosen.every(Boolean)) {
      st.phase = 'play'
      st.turn = st.landlord
      st.last = null
      st.passes = 0
    }
    return st
  }

  function applyOpen(st, seat) {
    if (st.phase !== 'play' && st.phase !== 'double') return st
    if (st.open[seat]) return st
    st.open[seat] = true
    st.replay.push({ type: 'open', seat })
    return st
  }

  /* ------------------------------------------------------------------ *
   * 出牌
   * ------------------------------------------------------------------ */

  function legalMoves(st, seat) {
    if (st.phase !== 'play' || st.turn !== seat) return { moves: [], canPass: false }
    const follows = !!(st.last && st.last.seat !== seat)
    const followMove = follows ? st.last.move : null
    let moves = DDZ.generateMoves(st.hands[seat], followMove)
    const seen = Object.create(null)
    moves = moves.filter(m => {
      const k = m.cards.join(',')
      if (seen[k]) return false
      seen[k] = 1
      return true
    })
    // 跟牌时必须真的压过（generateMoves 已保证，这里再兜一次底）
    if (followMove) moves = moves.filter(m => DDZ.beats(m, followMove))
    return { moves, canPass: follows }
  }

  function applyPlay(st, seat, cards) {
    if (st.phase !== 'play' || st.turn !== seat) throw new Error('还没轮到这家出牌')
    const hand = st.hands[seat]
    const c = countsOf(cards)
    for (let i = 0; i < N; i++) if (c[i] > hand[i]) throw new Error('手里没这么多张')
    const move = DDZ.classify(cards)
    if (!move) throw new Error('这手牌不成牌型')
    if (st.last && st.last.seat !== seat && !DDZ.beats(move, st.last.move)) throw new Error('压不过桌上这手牌')

    st.hands[seat] = minus(hand, cards)
    st.played = DDZ.addCards(st.played, cards)
    // 新的一轮：清掉上一轮各家的动作标记
    if (!st.last || st.last.seat === seat) st.recent = {}
    st.last = { seat, move }
    st.recent[seat] = { type: 'play', cards: cards.slice() }
    st.lastLeader = seat
    st.passes = 0
    st.playCounts[seat]++
    if (move.type === 'bomb' || move.type === 'rocket') st.bombs++
    st.replay.push({ type: 'play', seat, cards: cards.slice(), moveType: move.type, rank: move.rank })

    if (total(st.hands[seat]) === 0) {
      st.phase = 'over'
      st.winners = seat === st.landlord ? 'landlord' : 'farmers'
      st.endedAt = Date.now()
      st.result = computeResult(st)
    } else {
      st.turn = nextSeat(seat)
    }
    return st
  }

  function applyPass(st, seat) {
    if (st.phase !== 'play' || st.turn !== seat) throw new Error('还没轮到这家过牌')
    if (!st.last || st.last.seat === seat) throw new Error('你是领出的人，不能过')
    st.passes++
    st.recent[seat] = { type: 'pass' }
    st.replay.push({ type: 'pass', seat })
    if (st.passes >= 2) {
      st.turn = st.lastLeader
      st.last = null
      st.passes = 0
      st.recent = {}
    } else {
      st.turn = nextSeat(seat)
    }
    return st
  }

  /* ------------------------------------------------------------------ *
   * 结算
   * ------------------------------------------------------------------ */

  function computeResult(st) {
    const landlordWon = st.winners === 'landlord'
    const farmersPlayed = [0, 1, 2].filter(s => s !== st.landlord).reduce((a, s) => a + st.playCounts[s], 0)
    const isSpring = landlordWon && farmersPlayed === 0
    const isAnti = !landlordWon && st.playCounts[st.landlord] <= 1

    // 叫分玩法：叫到的分就是底分倍数；抢地主玩法固定按 1 倍底分
    const bidMult = st.mode === 'score' && st.bidHigh > 0 ? st.bidHigh : 1
    let mult = st.base * bidMult
    for (let s = 0; s < 3; s++) mult *= st.doubling[s]
    for (let s = 0; s < 3; s++) if (st.open[s]) mult *= 2
    for (let i = 0; i < st.bombs; i++) mult *= 2
    if (isSpring) mult *= 2
    if (isAnti) mult *= 2

    const delta = [0, 0, 0]
    if (landlordWon) {
      delta[st.landlord] = 2 * mult
      for (let s = 0; s < 3; s++) if (s !== st.landlord) delta[s] = -mult
    } else {
      delta[st.landlord] = -2 * mult
      for (let s = 0; s < 3; s++) if (s !== st.landlord) delta[s] = mult
    }
    return {
      landlordWon,
      spring: isSpring,
      antiSpring: isAnti,
      multiplier: mult,
      base: st.base,
      bid: bidMult,
      delta,
      bombs: st.bombs,
      seconds: Math.max(1, Math.round(((st.endedAt || Date.now()) - st.startedAt) / 1000)),
      doublings: st.doubling.slice(),
      open: st.open.slice()
    }
  }

  /* ------------------------------------------------------------------ *
   * AI：出牌 / 提示
   * ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ *
   * 引擎信息通道
   *
   * 新增两个字段（都是「加字段」，不改旧字段语义）：
   *   open       [bool,bool,bool] 三家是否明牌（亮了牌的那家手牌公开）
   *   knownHands [counts|null ×3] 已知手牌：自己恒可见，明牌的对手也可见，
   *              其余为 null（未知，交给引擎去采样分配）
   *
   * 向后兼容：
   *   - 老调用 adviseState(st, seat) 完全可用；st.open 不存在时按全暗牌处理。
   *   - 第三个可选参数 info 可注入 { open, knownHands }（给 L2 / 记牌器用），
   *     不传就只从 st 推导，不会改写任何对局状态。
   *   - 传给 DDZ.advise 的 state 带上这两个字段；引擎若不认识它们，行为与之前一致。
   * ------------------------------------------------------------------ */

  function countsOrNull(c) {
    return (c && c.length === N) ? c.slice() : null
  }

  function adviseState(st, seat, info) {
    const lastOk = st.last && st.last.seat !== seat ? { seat: st.last.seat, move: st.last.move } : null
    const stOpen = (st.open && st.open.length === 3) ? st.open : [false, false, false]
    const played = (st.played && st.played.length === N) ? st.played : zero()
    // open：允许上层逐座覆盖；没给就用对局里的明牌标记
    const open = [0, 1, 2].map(s => {
      const v = info && info.open && info.open[s] !== undefined ? info.open[s] : stOpen[s]
      return !!v
    })
    // knownHands：自己必知，明牌的座位也公开；其余 null
    const knownHands = [null, null, null]
    for (let s = 0; s < 3; s++) {
      if (s === seat || open[s]) knownHands[s] = countsOrNull(st.hands[s])
    }
    // 上层可逐座覆盖（传 null = 强制置为未知），数组里没给的座位保持推导值
    if (info && info.knownHands) {
      for (let s = 0; s < 3; s++) {
        const v = info.knownHands[s]
        if (v !== undefined) knownHands[s] = countsOrNull(v)
      }
    }
    return {
      hand: st.hands[seat],
      me: seat,
      landlord: st.landlord,
      seatCounts: [total(st.hands[0]), total(st.hands[1]), total(st.hands[2])],
      played,
      last: lastOk,
      bottom: st.bottom,
      open,
      knownHands
    }
  }

  /* ------------------------------------------------------------------ *
   * 兜底出牌：三条硬约束
   *   ① 不得拆炸弹：把四张同点拆成 1~3 张的候选一律剔除；
   *      跟牌时若只剩这类候选，宁可过牌也不拆（炸弹整出不算拆）。
   *   ② 不得把牌权白送：领出时按「外面同牌型能压住这手的张数」打分，
   *      优先谁都压不住的一手（如最大单张/炸弹），别默认甩一张最小单牌
   *      让下家顺手接管；不把「可能存在炸弹」当成所有牌都失控。
   *   ③ 领出永不返回 null：canPass=false 且合法候选非空时必须给出一手牌。
   * ------------------------------------------------------------------ */

  // 数「外面能压住这手的牌」有几个（只算同牌型/同长度、更大点数；炸弹另算）。
  // 这是给领出排序用的粗粒度代价，越小越能保住牌权。
  function leadBeatCost(counts, m) {
    if (m.type === 'rocket') return 0
    let need
    if (m.type === 'pair' || m.type === 'pairseq') need = 2
    else if (m.type === 'trio' || m.type === 'trio1' || m.type === 'trio2' ||
      m.type === 'plane' || m.type === 'plane1' || m.type === 'plane2') need = 3
    else if (m.type === 'bomb' || m.type === 'four2' || m.type === 'four2pair') need = 4
    else need = 1                                  // single / straight
    const len = m.len || 1
    const isSeq = m.type === 'straight' || m.type === 'pairseq' ||
      m.type === 'plane' || m.type === 'plane1' || m.type === 'plane2'
    let n = 0
    if (isSeq) {
      // 顺子/连对/飞机：2 和王不进，起点上限 14
      for (let s = m.rank + 1; s + len - 1 <= 14; s++) {
        let ok = true
        for (let r = s; r < s + len; r++) if (counts[r - 3] < need) { ok = false; break }
        if (ok) n++
      }
    } else {
      for (let i = m.rank - 2; i < N; i++) if (counts[i] >= need) n++
    }
    // 王炸能压一切非炸弹牌（不作为「全都失控」处理，只加 1 点代价）
    if (m.type !== 'bomb' && m.type !== 'rocket' && counts[13] > 0 && counts[14] > 0) n++
    return n
  }

  function fallbackMove(st, seat) {
    const { moves, canPass } = legalMoves(st, seat)
    if (!moves.length) return { move: null }
    const hand = st.hands[seat]
    const played = (st.played && st.played.length === N) ? st.played : zero()
    const rest = DDZ.unseen(hand, played)
    const restPlan = m => DDZ.planCount(DDZ.minus(hand, m.cards))

    // ① 剔掉拆炸弹的候选
    let pool = moves.filter(m => !DDZ.breaksBomb(hand, m))
    if (!pool.length) {
      // 跟牌：能压的牌都要拆炸弹 → 宁可过，也不拆
      if (canPass) return { move: null }
      // 领出绝不返回 null；优先整出炸弹（不拆），最后才退回全量候选
      const whole = moves.filter(m => m.type === 'bomb' || m.type === 'rocket')
      pool = whole.length ? whole : moves
    }

    // ② 领出：一手走完最优先；否则按「被压代价」从小到大，保住牌权
    const sorted = pool.slice().sort((a, b) => {
      if (!canPass) {
        const winA = DDZ.total(DDZ.minus(hand, a.cards)) === 0 ? -1000 : 0
        const winB = DDZ.total(DDZ.minus(hand, b.cards)) === 0 ? -1000 : 0
        const costA = winA || leadBeatCost(rest, a) + (a.type === 'bomb' || a.type === 'rocket' ? 100 : 0)
        const costB = winB || leadBeatCost(rest, b) + (b.type === 'bomb' || b.type === 'rocket' ? 100 : 0)
        if (costA !== costB) return costA - costB
        const pa = restPlan(a), pb = restPlan(b)
        if (pa !== pb) return pa - pb
        // 同等代价优先多出牌、再优先小点数
        return (b.cards.length - a.cards.length) || (a.rank - b.rank)
      }
      // 跟牌：出代价最小的（张数少、点数小）
      return (a.cards.length - b.cards.length) || (a.rank - b.rank)
    })
    return { move: sorted[0] }
  }

  // 建议合法性：牌面完全一致（各自排序后比对）才算落在合法候选里
  function moveKey(m) {
    return m && Array.isArray(m.cards) ? m.cards.slice().sort((a, b) => a - b).join(',') : ''
  }

  function aiMove(st, seat, info) {
    const t0 = Date.now()
    const { moves, canPass } = legalMoves(st, seat)
    if (!moves.length) return { move: null, reason: '', ms: 0 }
    let res = null
    try {
      res = DDZ.advise(adviseState(st, seat, info), { tier: st.tiers[seat] })
    } catch (e) {
      res = null
    }
    // 引擎判定「不划算、先过」时，AI 也要真的过；否则之前会退成出最小一手，等于从不放牌。
    // 但「领出要过」是非法建议（领出不能过），必须落到兜底领出一手，不能把牌权白送。
    if (res && res.pass && canPass) return { move: null, reason: res.reason || '', win: res.win, ms: Date.now() - t0 }

    const legalSet = new Set(moves.map(moveKey))
    const key = res && !res.pass ? moveKey(res.move) : ''
    // 非法建议（牌面不在合法候选里）不落地；合法但拆炸弹的建议同样不落地
    const valid = !!key && legalSet.has(key) && !DDZ.breaksBomb(st.hands[seat], res.move)
    if (valid) return { move: res.move, reason: res.reason || '', win: res.win, ms: Date.now() - t0 }

    // 非法建议不落地：领出必须走兜底出牌（永不返回 null）；跟牌可以过。
    const fb = fallbackMove(st, seat)
    const reason = (res && res.pass)
      ? '引擎建议过牌，但领出不能过，兜底领出一手'
      : (key ? '引擎建议不合法或会拆炸弹，已走兜底' : '')
    return { move: fb.move, reason, ms: Date.now() - t0 }
  }

  // 提示：所有能出的牌（按大小/张数排好）+ 不出（跟牌时）
  function hintList(st, seat) {
    const { moves, canPass } = legalMoves(st, seat)
    const sorted = moves.slice().sort((a, b) => (a.cards.length - b.cards.length) || (a.rank - b.rank))
    return { moves: sorted, canPass }
  }

  function seatCounts(st) { return [total(st.hands[0]), total(st.hands[1]), total(st.hands[2])] }

  function cloneState(st) {
    return JSON.parse(JSON.stringify(st))
  }

  return {
    createGame, cloneState, strength, strengthBreakdown, explainStrength,
    STRENGTH_WEIGHTS, BID_THRESHOLDS, DOUBLE_THRESHOLDS,
    bidSeat, bidOptions, applyBid, aiBid,
    aiDouble, applyDouble, applyOpen,
    legalMoves, applyPlay, applyPass,
    computeResult, adviseState, aiMove, fallbackMove, hintList,
    seatCounts, nextSeat, prevSeat
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { GameCore }
