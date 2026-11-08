/* 斗地主 · Web 页面（React，无 JSX） */
const PANEL_ID = 'doudizhu'
const TIERS = DDZ.TIERS
const RANK_TEXT = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '小王', '大王']
const SUITS = ['♠', '♥', '♣', '♦']
const RED_SUITS = { '♥': 1, '♦': 1 }
const SEAT_NAME_KEY = ['you', 'downTier', 'upTier']

/* ---------------- 小工具 ---------------- */

function cardsFromCounts(counts) {
  const out = []
  for (let i = 0; i < 15; i++) {
    const n = counts[i] || 0
    for (let k = 0; k < n; k++) {
      const rank = i + 3
      const suit = rank >= 16 ? '★' : SUITS[k % 4]
      out.push({
        rank,
        suit,
        id: rank + ':' + k,
        red: rank >= 16 ? rank === 17 : !!RED_SUITS[suit],
        label: RANK_TEXT[i],
      })
    }
  }
  out.sort((a, b) => a.rank - b.rank || (a.suit < b.suit ? -1 : 1))
  return out
}

function cardsKey(cards) { return cards.slice().sort((a, b) => a - b).join(',') }

function fmt(tpl, vars) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : m))
}

function tierLabel(tier, T) { return (T.tierNames && T.tierNames[tier]) || tier }

function liveMult(st) {
  if (st.result && typeof st.result.multiplier === 'number') return st.result.multiplier
  let mult = st.base || 1
  const doubling = st.doubling || [1, 1, 1]
  for (let s = 0; s < 3; s++) mult *= doubling[s] || 1
  const open = st.open || []
  for (let s = 0; s < 3; s++) if (open[s]) mult *= 2
  for (let i = 0; i < (st.bombs || 0); i++) mult *= 2
  return mult
}

function Decor() {
  return h('div', { className: 'ddz-decor', 'aria-hidden': 'true' },
    h('span', { className: 'ddz-bubble d1' }),
    h('span', { className: 'ddz-bubble d2' }),
    h('span', { className: 'ddz-bubble d3' }),
    h('span', { className: 'ddz-bubble d4' }),
    h('img', { className: 'ddz-stamp s1', src: DAFEIYU_AVATAR, alt: '', draggable: false }),
    h('img', { className: 'ddz-stamp s2', src: DAFEIYU_AVATAR, alt: '', draggable: false }),
    h('span', { className: 'ddz-whale w1' }, '🐳'),
    h('span', { className: 'ddz-whale w2' }, '🐋'))
}

/* ---------------- 牌 ---------------- */

function Card(props) {
  const { card, selected, small, static: isStatic, back, onClick, onPointerDown, onPointerEnter } = props
  const cls = ['ddz-card']
  if (card && card.red) cls.push('is-red')
  if (card && card.rank >= 16) cls.push('joker')
  if (selected) cls.push('is-sel')
  if (small) cls.push('small')
  if (isStatic) cls.push('static')
  if (back) cls.push('back')
  return h('div', {
    className: cls.join(' '),
    onPointerDown: onPointerDown,
    onPointerEnter: onPointerEnter,
    onClick: onClick,
    role: onPointerDown ? 'button' : undefined,
    tabIndex: onPointerDown ? 0 : undefined,
  }, card ? [
    h('span', { className: 'r', key: 'r' }, card.label),
    h('span', { className: 's', key: 's' }, card.suit === '★' ? '★' : card.suit),
  ] : null)
}

/* ---------------- 手牌（按住滑动多选） ---------------- */

function Hand(props) {
  const { cards, selected, onSelect, disabled, T } = props
  const drag = useRef(null)
  useEffect(() => {
    function up() { drag.current = null }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [])
  const down = (card) => (e) => {
    if (disabled) return
    e.preventDefault()
    const add = !selected[card.id]
    drag.current = { add }
    onSelect(card.id, add)
  }
  const enter = (card) => () => {
    if (disabled || !drag.current) return
    onSelect(card.id, drag.current.add)
  }
  if (!cards.length) {
    return h('div', { className: 'ddz-hand' }, h('span', { className: 'kbi' }, T.noCards))
  }
  return h('div', { className: 'ddz-hand' },
    cards.map((c, i) => h(Card, {
      key: c.id,
      card: c,
      selected: !!selected[c.id],
      onPointerDown: down(c),
      onPointerEnter: enter(c),
    })))
}

/* ---------------- 座位 ---------------- */

function Seat(props) {
  const { st, seat, T, remain, lang, isTurn } = props
  const name = seat === 0 ? T.you : (seat === 1 ? T.downTier : T.upTier)
  const isLandlord = st.landlord === seat
  const left = G.seatCounts(st)[seat]
  const ringR = 11
  const circ = 2 * Math.PI * ringR
  const pct = Math.max(0, Math.min(1, remain / 30))
  const bid = st.bidLog.filter(b => b.seat === seat).slice(-1)[0]
  const bidText = bid ? (bid.value === 0 ? '—' : (typeof bid.value === 'number' ? bid.value + '分' : (bid.value === 'call' ? T.call : T.rob))) : ''
  const dbl = st.doubling[seat]
  return h('div', { className: 'ddz-seat seat-' + seat + (isLandlord ? ' is-landlord' : '') + (isTurn ? ' is-turn' : '') + (seat === 0 ? ' is-me' : '') },
    h('div', { className: 'ddz-avatar' + (isLandlord ? ' landlord' : '') },
      h('img', { className: 'ddz-avatar-img', src: DAFEIYU_AVATAR, alt: '', draggable: false }),
      isLandlord ? h('span', { className: 'crown', 'aria-hidden': 'true' }, '♛') : null),
    h('div', { className: 'meta' },
      h('div', { className: 'name' }, name, isLandlord ? h('span', { className: 'tag landlord-tag' }, T.landlordTag) : null),
      h('div', { className: 'sub2' },
        fmt(T.lands, { n: left }),
        bidText ? ' · ' + bidText : '',
        dbl > 1 ? h('em', null, ' · ×' + dbl) : null)),
    isTurn ? h('div', { className: 'ddz-ring' },
      h('svg', { viewBox: '0 0 26 26' },
        h('circle', { className: 'bg', cx: 13, cy: 13, r: ringR }),
        h('circle', {
          className: 'fg', cx: 13, cy: 13, r: ringR,
          strokeDasharray: circ, strokeDashoffset: circ * (1 - pct),
        })),
      h('span', null, Math.ceil(remain))) : null)
}

/* ---------------- 记牌器 ---------------- */

function Counter(props) {
  const { st, T, open, onToggle } = props
  const mine = myHandCounts(st)
  const rows = []
  for (let i = 0; i < 15; i++) {
    const rank = i + 3
    const totalCards = rank >= 16 ? 1 : 4
    const rest = totalCards - (mine[i] || 0) - (st.played[i] || 0)
    rows.push({ rank, label: RANK_TEXT[i], rest, hot: rank >= 16 && rest > 0 })
  }
  if (!open) return null
  return h('div', { className: 'ddz-counterbar' },
    rows.map(r => h('div', {
      key: r.rank,
      className: 'ddz-count' + (r.hot ? ' is-hot' : '') + (r.rest <= 0 ? ' is-zero' : ''),
      title: r.label,
    }, h('span', null, r.label), h('b', null, r.rest))))
}

/* ---------------- 结算 ---------------- */

function Result(props) {
  const { st, T, onAgain, onReTier, onReplay, onClose } = props
  const r = st.result
  const iWin = (st.winners === 'landlord') === (st.landlord === 0)
  const d = r.delta
  return h('div', { className: 'ddz-overlay' },
    h('div', { className: 'ddz-modal' },
      h('h2', null, st.winners === 'landlord' ? T.winLandlord : T.winFarmer),
      h('div', { className: 'ddz-result-big ' + (iWin ? 'win' : 'lose') }, fmt(T.scoreLine, { n: (d[0] > 0 ? '+' : '') + d[0] })),
      h('div', { className: 'ddz-delta' },
        [0, 1, 2].map(s => h('div', { key: s },
          h('span', null, s === 0 ? T.you : (s === 1 ? T.downTier : T.upTier)),
          h('b', { className: d[s] > 0 ? 'up' : 'down' }, (d[s] > 0 ? '+' : '') + d[s])))),
      h('div', { className: 'ddz-kv' },
        h('span', { className: 'k' }, T.multiplier.replace('{n}', '')),
        h('span', { className: 'v' }, '×' + r.multiplier),
        r.spring ? h('span', { className: 'k' }, T.spring) : null,
        r.spring ? h('span', { className: 'v' }, '×2') : null,
        r.antiSpring ? h('span', { className: 'k' }, T.antiSpring) : null,
        r.antiSpring ? h('span', { className: 'v' }, '×2') : null,
        h('span', { className: 'k' }, T.bombs.replace('{n}', r.bombs).replace(/ \d+ 个| \d+ bomb.*/, '')),
        h('span', { className: 'v' }, r.bombs),
        h('span', { className: 'k' }, T.timeUsed.replace('{n}', '')),
        h('span', { className: 'v' }, fmt(T.timeUsed, { n: r.seconds }))),
      h('div', { className: 'ddz-modal-actions' },
        h('button', { className: 'ddz-btn ghost', onClick: onClose }, T.close),
        h('button', { className: 'ddz-btn ghost', onClick: onReplay }, T.replay),
        h('button', { className: 'ddz-btn ghost', onClick: onReTier }, T.reTier),
        h('button', { className: 'ddz-btn primary', onClick: onAgain }, T.again))))
}

/* ---------------- 复盘 ---------------- */

function Replay(props) {
  const { st, T, onClose } = props
  const [idx, setIdx] = useState(0)
  const lines = []
  const ev = st.replay || []
  function who(seat) { return seat === 0 ? T.you : (seat === 1 ? T.downTier : T.upTier) }
  ev.forEach((e, i) => {
    if (e.type === 'deal') lines.push({ i, text: T.mode + ': ' + (e.mode === 'rob' ? T.modeRob : T.modeScore) })
    else if (e.type === 'bid') lines.push({ i, text: who(e.seat) + ' · ' + (e.value === 0 ? T.pass : (typeof e.value === 'number' ? e.value + '分' : (e.value === 'call' ? T.call : T.rob))) })
    else if (e.type === 'double') lines.push({ i, text: who(e.seat) + ' · ' + (e.value === 1 ? T.doubleNone : e.value === 2 ? T.doubleX2 : T.doubleX4) })
    else if (e.type === 'open') lines.push({ i, text: who(e.seat) + ' · ' + T.open })
    else if (e.type === 'play') lines.push({ i, text: who(e.seat) + ' · ' + DDZ.cardsText(e.cards) })
    else if (e.type === 'pass') lines.push({ i, text: who(e.seat) + ' · ' + T.passAction })
  })
  const step = Math.min(idx, lines.length - 1)
  return h('div', { className: 'ddz-overlay' },
    h('div', { className: 'ddz-modal' },
      h('h2', null, T.replayTitle),
      h('div', { className: 'lead' }, fmt(T.stepInfo, { i: step + 1, n: lines.length })),
      h('div', { style: { maxHeight: 320, overflow: 'auto', marginBottom: 12 } },
        lines.map((l, i) => h('div', {
          key: l.i,
          className: 'ddz-replay-line',
          style: i === step ? { color: 'var(--ddz-accent)', fontWeight: 600 } : null,
        }, l.text))),
      h('div', { className: 'ddz-modal-actions' },
        h('button', { className: 'ddz-btn', onClick: () => setIdx(Math.max(0, step - 1)), disabled: step <= 0 }, T.stepPrev),
        h('button', { className: 'ddz-btn', onClick: () => setIdx(Math.min(lines.length - 1, step + 1)), disabled: step >= lines.length - 1 }, T.stepNext),
        h('button', { className: 'ddz-btn primary', onClick: onClose }, T.close))))
}

/* ---------------- 帮助 ---------------- */

function Help(props) {
  const { T, onClose } = props
  return h('div', { className: 'ddz-overlay' },
    h('div', { className: 'ddz-modal ddz-help' },
      h('h2', null, T.rulesTitle),
      h('div', { className: 'lead' }, T.tierHint),
      h('ul', null, T.rulesBody.map((s, i) => h('li', { key: i }, s))),
      h('div', { className: 'ddz-tierlist' },
        TIERS.map(t => h('div', { key: t },
          h('span', null, T.tierNames[t] || t),
          h('span', null, t === 'free' ? '≤5ms' : t === 'go' ? '≤5ms' : t === 'plus' ? '≈25ms' : t === 'pro100' ? '≈150ms' : t === 'pro200' ? '≈300ms' : t === 'pro500' ? '≈800ms' : '≤4s')))),
      h('div', { className: 'ddz-modal-actions' },
        h('button', { className: 'ddz-btn primary', onClick: onClose }, T.close))))
}

/* ---------------- 主页面 ---------------- */

function PanelView() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('ddz-lang') === 'en' ? 'en' : 'zh' } catch { return 'zh' }
  })
  const T = I18N[lang]
  const [, bump] = useState(0)
  const touch = useCallback(() => bump(v => v + 1), [])
  const stRef = useRef(null)
  const [view, setView] = useState('setup')   // setup | table
  const [mode, setMode] = useState('score')
  const [tiers, setTiers] = useState(() => {
    try {
      const raw = localStorage.getItem('ddz-tiers')
      if (raw) { const v = JSON.parse(raw); if (Array.isArray(v) && v.length === 3) return v }
    } catch { /* ignore */ }
    return ['go', 'go', 'go']
  })
  const [auto, setAuto] = useState(false)
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('ddz-sound') !== '0' } catch { return true } })
  const [counterOpen, setCounterOpen] = useState(true)
  const [sel, setSel] = useState({})            // id -> true
  const [hintIdx, setHintIdx] = useState(0)
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(null)      // 'help' | 'result' | 'replay' | 'surrender'
  const [advice, setAdvice] = useState(null)
  const [thinking, setThinking] = useState('')
  const [remain, setRemain] = useState(30)
  const [stats, setStats] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem('ddz-stats') || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
  })
  const turnStart = useRef(Date.now())
  const toastTimer = useRef(null)
  const adviceKeyRef = useRef('')
  const adviceTimerRef = useRef(null)
  const st = stRef.current

  function toastMsg(msg) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1600)
  }

  function beep(kind) {
    if (!sound) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      if (!beep.ctx) beep.ctx = new AC()
      const ctx = beep.ctx
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      const f = kind === 'bomb' ? 180 : kind === 'win' ? 660 : kind === 'lose' ? 220 : 420
      o.frequency.value = f
      o.type = kind === 'bomb' ? 'sawtooth' : 'sine'
      g.gain.setValueAtTime(0.0001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
      o.start(); o.stop(ctx.currentTime + 0.2)
    } catch { /* 没有音频环境就算了 */ }
  }

  function saveStats(next) {
    setStats(next)
    try { localStorage.setItem('ddz-stats', JSON.stringify(next)) } catch { /* ignore */ }
  }

  /* -------- 开局 -------- */
  function startGame(nextMode, nextTiers) {
    const m = nextMode || mode
    const t = nextTiers || tiers
    stRef.current = G.createGame({ mode: m, tiers: t })
    setSel({})
    setHintIdx(0)
    setAdvice(null)
    setThinking('')
    setModal(null)
    setView('table')
    turnStart.current = Date.now()
    setRemain(30)
    touch()
    try { localStorage.setItem('ddz-tiers', JSON.stringify(t)) } catch { /* ignore */ }
  }

  /* -------- 行动 -------- */
  function afterAction() {
    turnStart.current = Date.now()
    setRemain(30)
    setSel({})
    setHintIdx(0)
    setAdvice(null)
    touch()
  }

  function userBid(v) {
    const s = stRef.current
    if (!s) return
    try { G.applyBid(s, G.bidSeat(s), v) } catch (e) { toastMsg(e.message); return }
    afterAction()
  }

  function userDouble(v) {
    const s = stRef.current
    if (!s) return
    try { G.applyDouble(s, 0, v) } catch (e) { toastMsg(e.message); return }
    beep(v > 1 ? 'bomb' : 'play')
    afterAction()
  }

  function userOpen() {
    const s = stRef.current
    if (!s) return
    G.applyOpen(s, 0)
    toastMsg(T.openOn)
    touch()
  }

  function userPlay() {
    const s = stRef.current
    if (!s) return
    const cards = selectedRanks()
    if (!cards.length) { toastMsg(T.noCards); return }
    try {
      G.applyPlay(s, 0, cards)
    } catch (e) {
      toastMsg(e && /压不过/.test(e.message) ? T.beatFail : T.invalid)
      return
    }
    beep(DDZ.classify(cards).type === 'bomb' || DDZ.classify(cards).type === 'rocket' ? 'bomb' : 'play')
    afterAction()
    maybeFinish(s)
  }

  function userPass() {
    const s = stRef.current
    if (!s) return
    try { G.applyPass(s, 0) } catch (e) { toastMsg(e.message); return }
    beep('play')
    afterAction()
  }

  function selectedRanks() {
    const s = stRef.current
    if (!s) return []
    const cards = cardsFromCounts(s.hands[0])
    return cards.filter(c => sel[c.id]).map(c => c.rank)
  }

  function userHint() {
    const s = stRef.current
    if (!s || s.phase !== 'play' || s.turn !== 0) return
    const { moves, canPass } = G.hintList(s, 0)
    const pool = moves.slice()
    if (!pool.length) { toastMsg(T.noCards); return }
    const idx = hintIdx % pool.length
    const m = pool[idx]
    const next = {}
    const cards = cardsFromCounts(s.hands[0])
    const want = m.cards.slice()
    cards.forEach(c => {
      const k = want.indexOf(c.rank)
      if (k >= 0) { next[c.id] = true; want.splice(k, 1) }
    })
    setSel(next)
    setHintIdx(idx + 1)
    setSel(next)
  }

  function askAdvice() {
    const s = stRef.current
    if (!s || s.phase !== 'play' || s.turn !== 0) return
    setThinking(T.adviceTitle + '…')
    setTimeout(() => {
      const r = G.aiMove(s, 0)
      setAdvice(r)
      setThinking('')
      touch()
    }, 30)
  }

  function maybeFinish(s) {
    if (s.phase !== 'over' || !s.result) return
    const iWin = (s.winners === 'landlord') === (s.landlord === 0)
    beep(iWin ? 'win' : 'lose')
    const key = 'total'
    const prev = stats[key] || { games: 0, wins: 0 }
    const byTier = stats.byTier || {}
    const tkey = s.tiers[0] || 'go'
    byTier[tkey] = byTier[tkey] || { games: 0, wins: 0 }
    byTier[tkey].games++
    if (iWin) byTier[tkey].wins++
    saveStats({ ...stats, [key]: { games: prev.games + 1, wins: prev.wins + (iWin ? 1 : 0) }, byTier })
    setModal('result')
  }

  function userSurrender() {
    const s = stRef.current
    if (!s || s.phase !== 'play') return
    s.phase = 'over'
    s.winners = s.landlord === 0 ? 'farmers' : 'landlord'
    s.endedAt = Date.now()
    s.result = G.computeResult(s)
    setModal('result')
    beep('lose')
    touch()
  }

  /* -------- AI 推进 -------- */
  useEffect(() => {
    const s = stRef.current
    if (!s || view !== 'table') return
    if (s.phase === 'over' || s.phase === 'redeal') return
    let who = null
    let kind = null
    if (s.phase === 'bid') { who = G.bidSeat(s); kind = 'bid' }
    else if (s.phase === 'double') {
      who = [0, 1, 2].find(x => !s.doubleChosen[x])
      kind = 'double'
    } else if (s.phase === 'play') { who = s.turn; kind = 'play' }
    if (who === null) return
    const isAuto = who !== 0 || auto
    if (!isAuto) return
    const tier = (s.tiers && s.tiers[who]) || 'go'
    const delay = kind === 'bid' ? 700 : kind === 'double' ? 800 : (tier === 'free' ? 450 : tier === 'go' ? 550 : 700)
    const timer = setTimeout(() => {
      const g = stRef.current
      if (!g) return
      try {
        if (kind === 'bid') {
          const seat = G.bidSeat(g)
          G.applyBid(g, seat, G.aiBid(g, seat))
        } else if (kind === 'double') {
          const seat = [0, 1, 2].find(x => !g.doubleChosen[x])
          G.applyDouble(g, seat, G.aiDouble(g, seat))
        } else {
          const seat = g.turn
          setThinking(fmt(T.thinking, { tier: tierLabel(tier, T) }))
          const r = G.aiMove(g, seat)
          setThinking('')
          if (r.move) {
            const mv = DDZ.classify(r.move.cards)
            if (mv && (mv.type === 'bomb' || mv.type === 'rocket')) beep('bomb'); else beep('play')
            G.applyPlay(g, seat, r.move.cards)
          } else {
            G.applyPass(g, seat)
          }
          if (g.phase === 'over') {
            const iWin = (g.winners === 'landlord') === (g.landlord === 0)
            beep(iWin ? 'win' : 'lose')
            if (iWin || !iWin) maybeFinish(g)
          }
        }
      } catch (e) {
        console.warn('[doudizhu] AI 行动失败', e)
      }
      turnStart.current = Date.now()
      setRemain(30)
      setAdvice(null)
      touch()
    }, delay)
    return () => clearTimeout(timer)
  })

  /* 重新发牌：等用户点一下 */
  useEffect(() => {
    const s = stRef.current
    if (!s || s.phase !== 'redeal' || view !== 'table') return
    const t = setTimeout(() => { startGame() }, 900)
    return () => clearTimeout(t)
  })

  /* 倒计时：只管我自己 */
  useEffect(() => {
    if (view !== 'table') return
    const id = setInterval(() => {
      const s = stRef.current
      if (!s || s.phase !== 'play' || s.turn !== 0 || auto) return
      const left = 30 - Math.floor((Date.now() - turnStart.current) / 1000)
      setRemain(Math.max(0, left))
      if (left <= 0) {
        turnStart.current = Date.now()
        try {
          if (s.last && s.last.seat !== 0) G.applyPass(s, 0)
          else {
            const h = G.hintList(s, 0)
            if (h.moves.length) G.applyPlay(s, 0, h.moves[0].cards)
          }
        } catch { /* 超时兜底失败就停在这 */ }
        setRemain(30)
        setSel({})
        touch()
        maybeFinish(s)
      }
    }, 500)
    return () => clearInterval(id)
  }, [view, auto, touch])

  /* 轮到我时自动给建议（用我的档位；托管中不算，避免和 AI 推进互相打架） */
  useEffect(() => {
    const s = stRef.current
    if (auto) return
    if (!s || view !== 'table' || s.phase !== 'play' || s.turn !== 0) return
    const lm = s.last && s.last.move
    const key = JSON.stringify([s.hands[0].join('|'), s.last ? s.last.seat : '', lm ? lm.cards.join(',') : ''])
    if (adviceKeyRef.current === key) return
    adviceKeyRef.current = key
    if (adviceTimerRef.current) clearTimeout(adviceTimerRef.current)
    adviceTimerRef.current = setTimeout(() => {
      try { setAdvice(G.aiMove(s, 0)) } catch { /* ignore */ }
    }, 120)
  })

  /* -------- 渲染 -------- */
  const setupView = () => h('div', { className: 'ddz-root' },
    h(Decor),
    topbar(),
    h('div', { className: 'ddz-scroll' },
      h('div', { className: 'ddz-setup' },
        h('div', { className: 'ddz-hero' },
          h('img', { className: 'ddz-hero-avatar', src: DAFEIYU_AVATAR, alt: '', draggable: false }),
          h('div', null,
            h('h1', null, T.appName),
            h('div', { className: 'sub' }, T.tagline))),
        h('div', { className: 'ddz-field' },
          h('label', null, T.mode),
          h('div', { className: 'ddz-modecard' },
            h('button', { className: mode === 'score' ? 'is-on' : '', onClick: () => setMode('score') },
              h('b', null, T.modeScore), h('span', null, T.modeDescScore)),
            h('button', { className: mode === 'rob' ? 'is-on' : '', onClick: () => setMode('rob') },
              h('b', null, T.modeRob), h('span', null, T.modeDescRob)))),
        h('div', { className: 'ddz-field' },
          h('label', null, T.myTier + ' / ' + T.downTier + ' / ' + T.upTier),
          h('div', { className: 'ddz-tiers' },
            [0, 1, 2].map(seat => h('div', { className: 'ddz-tiercard', key: seat },
              h('b', null, seat === 0 ? T.myTier : seat === 1 ? T.downTier : T.upTier),
              h('select', {
                value: tiers[seat],
                onChange: e => {
                  const next = tiers.slice()
                  next[seat] = e.target.value
                  setTiers(next)
                },
              }, TIERS.map(t => h('option', { key: t, value: t }, T.tierNames[t] || t))))))),
        h('div', { className: 'ddz-setup-actions' },
          h('button', { className: 'ddz-btn primary', onClick: () => startGame() }, T.start),
          h('button', { className: 'ddz-btn ghost', onClick: () => setModal('help') }, T.help)),
        h('div', { className: 'ddz-statsline' },
          fmt(T.playedGames, { n: (stats.total && stats.total.games) || 0 }) + ' · ' +
          fmt(T.winRate, { n: stats.total && stats.total.games ? Math.round(stats.total.wins / stats.total.games * 100) : 0 }))),
      ),
    toastEl(),
    modal === 'help' ? h(Help, { T, onClose: () => setModal(null) }) : null)

  const table = () => {
    if (!st) return null
    const counts = G.seatCounts(st)
    const handCards = cardsFromCounts(st.hands[0])
    const myTurn = st.phase === 'play' && st.turn === 0
    const lastCards = st.last ? cardsFromCounts(DDZ.countsOf(st.last.move.cards)) : null
    const replay = st.replay || []
    const lastEv = replay.length ? replay[replay.length - 1] : null
    const passSeat = lastEv && lastEv.type === 'pass' ? lastEv.seat : -1
    const playedBomb = !!(st.last && st.last.move && (st.last.move.type === 'bomb' || st.last.move.type === 'rocket'))
    const playSerial = st.playCounts ? st.playCounts[0] + st.playCounts[1] + st.playCounts[2] : 0
    const playKey = st.last ? playSerial + '-' + st.last.seat : 'empty'
    const bidders = st.phase === 'bid' ? G.bidSeat(st) : -1
    const whoName = (seat) => seat === 0 ? T.you : seat === 1 ? T.downTier : T.upTier
    let phaseText = T.playing
    if (st.phase === 'bid') phaseText = fmt(T.bidTurn, { who: whoName(bidders) })
    else if (st.phase === 'double') phaseText = T.doubleTurn
    else if (st.phase === 'play') phaseText = myTurn ? (auto ? T.autoOn : T.yourTurn) : fmt(T.thinking, { tier: tierLabel((st.tiers && st.tiers[st.turn]) || 'go', T) })
    else if (st.phase === 'redeal') phaseText = T.bidAllPass
    else if (st.phase === 'over') phaseText = st.winners === 'landlord' ? T.winLandlord : T.winFarmer
    const kittyFace = st.landlord >= 0 && st.phase !== 'bid' && st.phase !== 'redeal'
    const kittyCards = kittyFace ? cardsFromCounts(st.bottom || []) : []
    const openN = (st.open || []).filter(Boolean).length
    return h('div', { className: 'ddz-root' },
      h(Decor),
      topbar(),
      counterOpen ? counterBar() : null,
      h('div', { className: 'ddz-table' },
        h('div', { className: 'ddz-seatrow' },
          h(Seat, { st, seat: 2, T, lang, remain, isTurn: st.phase === 'play' && st.turn === 2 || bidders === 2 }),
          h(Seat, { st, seat: 1, T, lang, remain, isTurn: st.phase === 'play' && st.turn === 1 || bidders === 1 })),
        h('div', { className: 'ddz-mid' },
          h('img', { className: 'ddz-watermark', src: DAFEIYU_AVATAR, alt: '', draggable: false }),
          h('div', { className: 'ddz-mid-inner' },
            h('div', { className: 'ddz-infobar' },
              h('span', { className: 'ddz-pill is-phase' }, phaseText),
              st.landlord >= 0 ? h('span', { className: 'ddz-pill is-gold' }, fmt(T.landlordIs, { who: whoName(st.landlord) })) : null,
              st.mode === 'score' && st.bidHigh > 0 ? h('span', { className: 'ddz-pill' }, st.bidHigh + '分') : null,
              st.mode === 'rob' && st.landlord >= 0 ? h('span', { className: 'ddz-pill' }, T.modeRob) : null,
              h('span', { className: 'ddz-pill is-mult' }, fmt(T.multiplier, { n: liveMult(st) })),
              h('span', { className: 'ddz-pill' }, fmt(T.bombs, { n: st.bombs || 0 })),
              openN ? h('span', { className: 'ddz-pill' }, T.openOn + (openN > 1 ? ' ×' + openN : '')) : null),
            h('div', { className: 'ddz-kitty' },
              h('span', { className: 'ddz-lastlabel' }, T.bottomCards),
              h('div', { className: 'ddz-kitty-cards' },
                kittyFace && kittyCards.length
                  ? kittyCards.map(c => h(Card, { key: 'k' + c.id, card: c, small: true, static: true }))
                  : [0, 1, 2].map(i => h(Card, { key: 'kb' + i, back: true, small: true, static: true })))),
            h('div', { className: 'ddz-lastlabel' }, st.last ? T.lastPlay : T.noPlay),
            h('div', {
              key: 'played-' + playKey,
              className: 'ddz-played' + (playedBomb ? ' is-bomb' : ''),
            }, lastCards ? lastCards.map(c => h(Card, { key: c.id, card: c, small: true, static: true })) : null),
            passSeat >= 0 ? h('div', {
              key: 'pass-' + replay.length,
              className: 'ddz-pass',
            }, (passSeat === 0 ? T.you : passSeat === 1 ? T.downTier : T.upTier) + ' · ' + T.passAction) : null,
            thinking ? h('div', { className: 'ddz-think' }, h('span', { className: 'ddz-spin' }), thinking) : null)),
        st.phase === 'bid' ? bidPanel() : null,
        st.phase === 'double' ? doublePanel() : null,
        h('div', { className: 'ddz-bottom' },
          h('div', { className: 'ddz-meseat' }, h(Seat, { st, seat: 0, T, lang, remain, isTurn: (st.phase === 'play' && st.turn === 0) || bidders === 0 })),
          h('div', { className: 'ddz-handwrap' },
            h(Hand, { cards: handCards, selected: sel, onSelect: (id, on) => setSel(prev => { const n = { ...prev }; if (on) n[id] = true; else delete n[id]; return n }), disabled: !myTurn || auto, T }),
            h('div', { className: 'ddz-handinfo' },
              myTurn ? (auto ? T.autoOn : T.yourTurn) : (st.phase === 'play' ? fmt(T.thinking, { tier: tierLabel(tiers[st.turn] || 'go', T) }) : ''),
              ' · ' + fmt(T.selectToast, { n: Object.keys(sel).length }))),
          h('div', { className: 'ddz-actions' },
            h('div', { className: 'ddz-actions-row' },
              h('button', { className: 'ddz-btn ghost', onClick: () => { setSel({}); } }, T.cancel),
              h('button', { className: 'ddz-btn ghost', onClick: userPass, disabled: !myTurn || auto || !(st.last && st.last.seat !== 0) }, T.passAction),
              h('button', { className: 'ddz-btn primary', onClick: userPlay, disabled: !myTurn || auto }, T.playAction)),
            h('div', { className: 'ddz-actions-row' },
              h('button', { className: 'ddz-btn', onClick: userHint, disabled: !myTurn || auto }, T.hint),
              h('button', { className: 'ddz-btn', onClick: askAdvice, disabled: !myTurn || auto }, T.advice),
              h('button', { className: 'ddz-btn', onClick: () => { setAuto(v => !v); toastMsg(!auto ? T.autoOn : T.auto) }, }, auto ? T.autoOn : T.auto),
              h('button', { className: 'ddz-btn danger', onClick: () => setModal('surrender'), disabled: st.phase !== 'play' }, T.surrender)),
            adviceCard()))),
      toastEl(),
      modal === 'result' && st.result ? h(Result, {
        st, T,
        onAgain: () => startGame(),
        onReTier: () => { setView('setup'); setModal(null); stRef.current = null },
        onReplay: () => setModal('replay'),
        onClose: () => setModal(null),
      }) : null,
      modal === 'replay' ? h(Replay, { st, T, onClose: () => setModal(null) }) : null,
      modal === 'surrender' ? h('div', { className: 'ddz-overlay' },
        h('div', { className: 'ddz-modal' },
          h('h2', null, T.surrender),
          h('div', { className: 'lead' }, T.surrenderAsk),
          h('div', { className: 'ddz-modal-actions' },
            h('button', { className: 'ddz-btn ghost', onClick: () => setModal(null) }, T.cancel),
            h('button', { className: 'ddz-btn danger', onClick: () => { setModal(null); userSurrender() } }, T.confirm)))) : null,
      modal === 'help' ? h(Help, { T, onClose: () => setModal(null) }) : null)
  }

  function topbar() {
    return h('div', { className: 'ddz-topbar' },
      h('img', { className: 'ddz-brand', src: DAFEIYU_AVATAR, alt: '', draggable: false }),
      h('div', { className: 'ddz-title' }, T.appName,
        h('small', null, st ? (st.phase === 'over' ? '' : (st.mode === 'rob' ? T.modeRob : T.modeScore) + ' · ' + tierLabel(tiers[0], T)) : T.tagline)),
      h('div', { className: 'ddz-spacer' }),
      view === 'table' ? h('button', { className: 'ddz-chipbtn', onClick: () => setCounterOpen(v => !v) }, '🂠 ' + T.counter) : null,
      view === 'table' ? h('button', { className: 'ddz-chipbtn' + (auto ? ' is-on' : ''), onClick: () => setAuto(v => !v) }, T.auto) : null,
      h('button', { className: 'ddz-chipbtn' + (sound ? ' is-on' : ''), onClick: () => { setSound(v => { try { localStorage.setItem('ddz-sound', v ? '0' : '1') } catch { /* ignore */ } ; return !v }) } }, '♪'),
      h('button', { className: 'ddz-chipbtn', onClick: () => { const next = lang === 'zh' ? 'en' : 'zh'; setLang(next); try { localStorage.setItem('ddz-lang', next) } catch { /* ignore */ } } }, T.lang),
      h('button', { className: 'ddz-chipbtn', onClick: () => setModal('help') }, '?'),
      view === 'table' ? h('button', { className: 'ddz-chipbtn', onClick: () => { setView('setup'); stRef.current = null } }, T.back) : null)
  }

  function counterBar() {
    return h('div', { className: 'ddz-counterbar' },
      h('span', { className: 'ct' }, T.counter),
      st ? (function () {
        const mine = st.hands[0]
        const out = []
        for (let i = 0; i < 15; i++) {
          const rank = i + 3
          const totalCards = rank >= 16 ? 1 : 4
          const rest = totalCards - (mine[i] || 0) - (st.played[i] || 0)
          out.push(h('div', {
            key: rank,
            className: 'ddz-count' + (rest <= 0 ? ' is-zero' : '') + (rank >= 16 && rest > 0 ? ' is-hot' : ''),
          }, h('span', null, RANK_TEXT[i]), h('b', null, rest)))
        }
        return out
      })() : null)
  }

  function bidText(v) {
    if (v === 0) return T.pass
    if (st.mode === 'rob') return v === 'call' ? T.call : v === 'rob' ? T.rob : String(v)
    return v + '分'
  }

  function bidPanel() {
    const seat = st.phase === 'bid' ? G.bidSeat(st) : -1
    const opts = seat === 0 ? G.bidOptions(st) : []
    const actions = seat === 0
      ? h('div', { className: 'ddz-modal-actions' },
        opts.map(v => h('button',
          {
            key: String(v),
            className: 'ddz-btn ' + (v === 0 ? 'ghost' : 'primary'),
            onClick: () => userBid(v),
          },
          bidText(v),
        )),
      )
      : h('div', { className: 'ddz-think' }, h('span', { className: 'ddz-spin' }), '…')
    return h('div', { className: 'ddz-overlay' },
      h('div', { className: 'ddz-modal' },
        h('h2', null, fmt(T.bidTurn, { who: seat === 0 ? T.you : seat === 1 ? T.downTier : T.upTier })),
        h('div', { className: 'lead' }, st.mode === 'rob' ? T.modeDescRob : T.modeDescScore),
        actions,
      ),
    )
  }

  function doublePanel() {
    const done = st.doubleChosen
    return h('div', { className: 'ddz-overlay' },
      h('div', { className: 'ddz-modal' },
        h('h2', null, T.doubleTurn),
        h('div', { className: 'lead' }, fmt(T.landlordIs, { who: st.landlord === 0 ? T.you : st.landlord === 1 ? T.downTier : T.upTier })),
        h('div', { className: 'ddz-delta' },
          [0, 1, 2].map(s => h('div', { key: s },
            h('span', null, s === 0 ? T.you : (s === 1 ? T.downTier : T.upTier)),
            h('b', null, done[s] ? (st.doubling[s] === 1 ? T.doubleNone : st.doubling[s] === 2 ? T.doubleX2 : T.doubleX4) : '…')))),
        done[0] ? null : h('div', { className: 'ddz-modal-actions' },
          h('button', { className: 'ddz-btn ghost', onClick: () => userDouble(1) }, T.doubleNone),
          h('button', { className: 'ddz-btn', onClick: () => userDouble(2) }, T.doubleX2),
          h('button', { className: 'ddz-btn primary', onClick: () => userDouble(4) }, T.doubleX4)),
        h('div', { className: 'ddz-modal-actions' },
          st.open[0] ? null : h('button', { className: 'ddz-btn ghost', onClick: userOpen }, T.open))))
  }

  function adviceCard() {
    return h('div', { className: 'ddz-advice' },
      h('div', { className: 'hd' }, T.adviceTitle,
        advice && typeof advice.win === 'number' ? h('span', { className: 'win' }, fmt(T.adviceWin, { n: Math.round(advice.win) })) : null),
      advice
        ? [h('div', { className: 'mv', key: 'm' }, advice.move ? DDZ.cardsText(advice.move.cards) : T.passAction),
          advice.reason ? h('div', { className: 'rs', key: 'r' }, advice.reason) : null]
        : h('div', { className: 'rs' }, T.advisorEmpty))
  }

  function toastEl() {
    return toast ? h('div', { className: 'ddz-toast' }, toast) : null
  }

  return view === 'table' ? table() : setupView()
}

/* ---------------- 侧栏图标 / 更多菜单行 ---------------- */

function SidebarIcon(props) {
  const size = props && typeof props.size === 'number' ? props.size : 16
  return h('svg', {
    viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true', focusable: 'false',
  },
    h('rect', { x: 2.2, y: 3.6, width: 8, height: 10.2, rx: 1.6 }),
    h('path', { d: 'M5.4 1.4h7.2c.7 0 1.2.5 1.2 1.2v9.6' }),
    h('path', { d: 'M4.6 6.6h3.2M4.6 9.2h3.2M4.6 11.4h1.8' }))
}

function MoreMenuRow(props) {
  const onOpen = props && props.onOpen
  return h('button', {
    className: 'ddz-more-row',
    onClick: () => { if (typeof onOpen === 'function') onOpen(PANEL_ID) },
  }, h(SidebarIcon, { size: 16 }), h('span', null, '斗地主'))
}
