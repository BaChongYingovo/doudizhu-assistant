/* 斗地主 · 插件界面（React，无 JSX；视觉：鲸鱼娘浅色柔和风，结构照 Kimi 原型） */
const PANEL_ID = 'doudizhu'
const TIERS = DDZ.TIERS
const RANK_TEXT = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '小王', '大王']
const SUITS = ['♠', '♥', '♣', '♦']
const RED_SUITS = { '♥': 1, '♦': 1 }

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
  out.sort((a, b) => b.rank - a.rank || (a.suit < b.suit ? -1 : 1))
  return out
}

function fmt(tpl, vars) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : m))
}

function tierLabel(tier, T) { return (T.tierNames && T.tierNames[tier]) || tier }

function whoName(seat, T) { return seat === 0 ? T.you : seat === 1 ? T.downTier : T.upTier }

function mmss(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

/* 当前倍数：底分 × 叫分 × 各家加倍 × 明牌 × 炸弹 */
function currentMult(st) {
  if (!st) return 1
  let m = st.base || 1
  if (st.mode === 'score' && st.bidHigh > 0) m *= st.bidHigh
  for (let s = 0; s < 3; s++) m *= st.doubling[s] || 1
  for (let s = 0; s < 3; s++) if (st.open[s]) m *= 2
  for (let i = 0; i < (st.bombs || 0); i++) m *= 2
  return m
}

/* ---------------- 图标 ---------------- */

function WhaleSvg(props) {
  const cls = (props && props.cls) || ''
  return h('svg', { className: cls || undefined, viewBox: '0 0 48 48', fill: 'none', 'aria-hidden': 'true' },
    h('path', {
      d: 'M6 28c0-9 8-16 18-16 9 0 16 5 17 12l3-4c1.6 4-1 8-4 9 0 5-4 9-10 9H14c-5 0-8-4-8-11z',
      fill: 'var(--ddz-accent)', opacity: '.9',
    }),
    h('circle', { cx: 16, cy: 22, r: 2.2, fill: '#fff' }),
    h('path', { d: 'M30 26c2 2 5 2 7 0', stroke: '#fff', strokeWidth: 1.8, strokeLinecap: 'round' }),
    h('path', { d: 'M38 30c3 0 5 2 5 5-3 0-5-2-5-5z', fill: 'var(--ddz-accent-deep)', opacity: '.55' }))
}

function Avatar(props) {
  const seat = (props && props.seat) || 0
  const lg = props && props.lg
  const tone = seat === 0 ? '#4BA3E3' : seat === 1 ? '#6FA8CF' : '#8CB9D6'
  return h('svg', { className: 'ddz-avatar' + (lg ? ' ddz-avatar--lg' : ''), viewBox: '0 0 48 48', 'aria-hidden': 'true' },
    h('circle', { cx: 24, cy: 24, r: 24, fill: 'var(--ddz-avatar-bg, #EAF3FB)' }),
    h('path', {
      d: 'M9 28c0-7 6.5-13 15-13 7 0 13 4.5 14.5 10.5l2.5-3c1.3 3.2-.8 6.5-3.2 7.3 0 4-3.3 7.2-8.2 7.2H16c-4 0-7-3.3-7-9z',
      fill: tone,
    }),
    h('circle', { cx: 18.5, cy: 25, r: 1.9, fill: '#fff' }),
    h('path', { d: 'M27.5 28c1.7 1.7 4.3 1.7 6 0', stroke: '#fff', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round' }),
    h('path', { d: 'M15 33c3 2 7 2 10 0', stroke: '#fff', strokeWidth: 1.4, fill: 'none', strokeLinecap: 'round', opacity: '.85' }))
}

function Crown() {
  return h('svg', { className: 'ddz-crown', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    h('path', { d: 'M3 17 5 8l4.5 4L12 5l2.5 7L19 8l2 9z', fill: '#E5BE6B', stroke: '#D4A84B', strokeWidth: 1 }),
    h('rect', { x: 4, y: 17, width: 16, height: 3, rx: 1.2, fill: '#E5BE6B' }))
}

/* ---------------- 牌 ---------------- */

function Card(props) {
  const { card, selected, small, onClick, onPointerDown, onPointerEnter } = props
  if (!card) return null
  const cls = ['ddz-card']
  if (small) cls.push('ddz-card--small')
  if (card.rank >= 16) cls.push('ddz-card--joker')
  if (selected) cls.push('is-sel')
  cls.push(card.red ? 'red' : 'ink')
  return h('div', {
    className: cls.join(' '),
    onPointerDown: onPointerDown,
    onPointerEnter: onPointerEnter,
    onClick: onClick,
    role: onPointerDown ? 'button' : undefined,
    tabIndex: onPointerDown ? 0 : undefined,
  },
    h('span', { className: 'rk', key: 'rk' }, card.rank === 17 ? '大王' : card.rank === 16 ? '小王' : card.label),
    h('span', { className: 'st', key: 'st' }, card.rank >= 16 ? '★' : card.suit))
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
    if (e && e.preventDefault) e.preventDefault()
    const add = !selected[card.id]
    drag.current = { add }
    onSelect(card.id, add)
  }
  const enter = (card) => () => {
    if (disabled || !drag.current) return
    onSelect(card.id, drag.current.add)
  }
  if (!cards.length) {
    return h('div', { className: 'ddz-hand' + (disabled ? ' is-disabled' : '') }, h('span', { className: 'ddz-mid-empty' }, T.noCards))
  }
  return h('div', { className: 'ddz-hand' + (disabled ? ' is-disabled' : '') },
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
  const { st, seat, T, remain, me } = props
  const name = whoName(seat, T)
  const isLandlord = st.landlord === seat
  const counts = G.seatCounts(st)
  const left = counts[seat]
  const isTurn = (st.phase === 'play' && st.turn === seat) ||
    (st.phase === 'bid' && G.bidSeat(st) === seat) ||
    (st.phase === 'double' && !st.doubleChosen[seat])
  const hasTimer = me && typeof remain === 'number' && isFinite(remain)
  const pct = hasTimer ? Math.max(0, Math.min(1, remain / 30)) : 0
  const circ = 295.3
  const tier = st.tiers && st.tiers[seat]

  const sub = [
    fmt(T.lands, { n: left }),
    tier ? tierLabel(tier, T) : '',
  ].filter(Boolean).join(' · ')

  return h('div', { className: 'ddz-seat' + (isTurn ? ' is-turn' : '') },
    h('div', { className: 'ddz-seat-av' },
      hasTimer ? h('svg', { className: 'ddz-ring', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
        h('circle', {
          cx: 50, cy: 50, r: 47,
          strokeDasharray: circ,
          strokeDashoffset: circ * (1 - pct),
          className: remain < 8 ? 'hot' : undefined,
        })) : null,
      h(Avatar, { seat: seat, lg: me }),
      isLandlord ? h(Crown) : null),
    h('div', { className: 'ddz-seat-info' },
      h('div', { className: 'ddz-seat-name' }, name,
        h('span', { className: 'ddz-tags' },
          isLandlord ? h('span', { className: 'ddz-landlord-tag' }, T.landlordTag) : null,
          st.open[seat] ? h('span', { className: 'ddz-open-tag' }, T.openShort) : null)),
      h('div', { className: 'ddz-seat-sub' }, sub)),
    me ? null : h('div', { className: 'ddz-cardstack', 'aria-label': fmt(T.lands, { n: left }) },
      h('div', { className: 'ddz-back' }), h('div', { className: 'ddz-back' }), h('div', { className: 'ddz-back' }),
      h('span', { className: 'n' }, left)))
}

/* ---------------- 记牌器 ---------------- */

function counterBar(st, T, open) {
  const mine = st.hands[0]
  const out = []
  for (let i = 14; i >= 0; i--) {
    const rank = i + 3
    const totalCards = rank >= 16 ? 1 : 4
    const rest = totalCards - (mine[i] || 0) - (st.played[i] || 0)
    out.push(h('div', {
      key: rank,
      className: 'ddz-count' + (rest <= 0 ? ' is-zero' : '') + (rank >= 16 && rest > 0 ? ' is-hot' : ''),
      title: RANK_TEXT[i],
    }, h('b', null, RANK_TEXT[i]), h('span', { className: 'cnt' }, rest)))
  }
  return h('div', { className: 'ddz-counterbar' + (open ? ' is-open' : '') },
    h('div', { className: 'ddz-counterbar-in' }, out))
}

function CounterBar(props) {
  return counterBar(props.st, props.T, props.open)
}

/* ---------------- 结算 ---------------- */

function Result(props) {
  const { st, T, onAgain, onReTier, onReplay, onClose } = props
  const r = st.result
  const iWin = (st.winners === 'landlord') === (st.landlord === 0)
  const d = r.delta
  const props2 = []
  props2.push({ k: T.baseLabel, v: r.base })
  if (st.mode === 'score') props2.push({ k: T.bidLabel, v: r.bid > 0 ? r.bid : 1 })
  props2.push({ k: T.multiplier.replace('×{n}', '').replace('{n}', ''), v: '×' + r.multiplier })
  props2.push({ k: T.bombs.replace('{n}', '').trim(), v: '×' + r.bombs })
  if (r.spring) props2.push({ k: T.spring.replace(' ×2', ''), v: '×2' })
  if (r.antiSpring) props2.push({ k: T.antiSpring.replace(' ×2', ''), v: '×2' })
  return h('div', { className: 'ddz-overlay is-on' },
    h('div', { className: 'ddz-dialog', style: { maxWidth: 480 } },
      h('div', { className: 'ddz-dialog-strip ' + (iWin ? 'win' : 'lose') }),
      h('h2', { className: iWin ? 'win' : 'lose' }, st.winners === 'landlord' ? T.winLandlord : T.winFarmer),
      h('p', { className: 'sub' }, fmt(T.scoreLine, { n: (d[0] > 0 ? '+' : '') + d[0] }) + (iWin ? ' · ' + T.resultSubWin : ' · ' + T.resultSubLose)),
      h('div', { className: 'ddz-props' },
        props2.map((p, i) => h('div', { className: 'ddz-props-row', key: i },
          h('span', { className: 'k' }, p.k),
          h('span', { className: 'v' + (p.v === '×2' ? ' gold' : '') }, p.v)))),
      h('div', null, [0, 1, 2].map(s => h('div', { className: 'ddz-score-row', key: s },
        h('span', { className: 'nm' }, whoName(s, T)),
        h('span', { className: 'sc ' + (d[s] > 0 ? 'plus' : d[s] < 0 ? 'minus' : '') }, (d[s] > 0 ? '+' : '') + d[s])))),
      h('p', { className: 'dim-note' }, fmt(T.timeUsedLine, { t: mmss(r.seconds) })),
      h('div', { className: 'ddz-dialog-actions' },
        h('button', { className: 'ddz-btn ddz-btn--primary', onClick: onAgain }, T.again),
        h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: onReTier }, T.reTier),
        h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: onReplay }, T.replay),
        h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: onClose }, T.close))))
}

/* ---------------- 复盘 ---------------- */

function Replay(props) {
  const { st, T, onClose } = props
  const [idx, setIdx] = useState(0)
  const lines = []
  const ev = st.replay || []
  ev.forEach((e, i) => {
    if (e.type === 'deal') lines.push({ i, text: (e.mode === 'rob' ? T.modeRob : T.modeScore) })
    else if (e.type === 'bid') lines.push({ i, text: whoName(e.seat, T) + ' · ' + (e.value === 0 ? T.pass : (typeof e.value === 'number' ? e.value + '分' : (e.value === 'call' ? T.call : T.rob))) })
    else if (e.type === 'double') lines.push({ i, text: whoName(e.seat, T) + ' · ' + (e.value === 1 ? T.doubleNone : e.value === 2 ? T.doubleX2 : T.doubleX4) })
    else if (e.type === 'open') lines.push({ i, text: whoName(e.seat, T) + ' · ' + T.openShort })
    else if (e.type === 'play') lines.push({ i, text: whoName(e.seat, T) + ' · ' + DDZ.cardsText(e.cards) })
    else if (e.type === 'pass') lines.push({ i, text: whoName(e.seat, T) + ' · ' + T.passAction })
  })
  const step = Math.min(idx, Math.max(0, lines.length - 1))
  const line = lines[step]
  return h('div', { className: 'ddz-overlay is-on' },
    h('div', { className: 'ddz-dialog', style: { maxWidth: 440 } },
      h('div', { className: 'ddz-dialog-strip info' }),
      h('h2', null, T.replayTitle),
      h('div', { className: 'ddz-replay-step' },
        h('b', null, fmt(T.stepShort, { i: step + 1, n: lines.length })),
        h('br', null),
        line ? line.text : ''),
      h('div', { className: 'ddz-dialog-actions' },
        h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => setIdx(Math.max(0, step - 1)), disabled: step <= 0 }, T.stepPrev),
        h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => setIdx(Math.min(lines.length - 1, step + 1)), disabled: step >= lines.length - 1 }, T.stepNext),
        h('button', { className: 'ddz-btn ddz-btn--primary', onClick: onClose }, T.close))))
}

/* ---------------- 帮助 ---------------- */

function Help(props) {
  const { T, onClose } = props
  return h('div', { className: 'ddz-overlay is-on' },
    h('div', { className: 'ddz-dialog', style: { maxWidth: 460 } },
      h('div', { className: 'ddz-dialog-strip info' }),
      h('h2', null, T.helpTitle),
      h('ul', { className: 'ddz-help-list', style: { marginTop: 8 } },
        T.helpList.map((s, i) => h('li', { key: i }, s))),
      h('div', { className: 'ddz-dialog-actions' },
        h('button', { className: 'ddz-btn ddz-btn--primary', onClick: onClose }, T.close))))
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
  const [modal, setModal] = useState(null)      // 'help' | 'result' | 'replay' | 'surrender' | 'open'
  const [advice, setAdvice] = useState(null)
  const [thinking, setThinking] = useState('')
  const [remain, setRemain] = useState(30)
  const [nowTick, setNowTick] = useState(Date.now())
  const [stats, setStats] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem('ddz-stats') || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
  })
  const turnStart = useRef(Date.now())
  const toastTimer = useRef(null)
  const adviceKeyRef = useRef('')
  const adviceTimerRef = useRef(null)
  const st = stRef.current

  /* -------- sota 档：DouZero 权重 -------- */
  const [sota, setSota] = useState(() => (typeof SOTA !== 'undefined' ? SOTA.status() : { status: 'idle', progress: 0, error: '' }))

  useEffect(() => {
    if (typeof SOTA === 'undefined') return undefined
    const off = SOTA.onStatus((s) => {
      setSota(s)
      if (s.status === 'ready') DDZ.setSotaRank(SOTA.rank)
    })
    if (SOTA.ready()) DDZ.setSotaRank(SOTA.rank)
    return off
  }, [])

  // 选了 sota 档才去下权重；下载中/已就绪不重复触发
  useEffect(() => {
    if (typeof SOTA === 'undefined') return
    if (tiers.indexOf('sota') < 0) return
    if (SOTA.ready()) { DDZ.setSotaRank(SOTA.rank); return }
    if (sota.status === 'downloading' || sota.status === 'ready') return
    SOTA.load().catch(() => { /* 状态已经通过 onStatus 落到界面 */ })
  }, [tiers, sota.status])

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
    setNowTick(Date.now())
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
    if (!window.confirm) { G.applyOpen(s, 0); toastMsg(T.openOn); touch(); return }
    setModal('open')
  }

  function confirmOpen() {
    const s = stRef.current
    if (!s) return
    G.applyOpen(s, 0)
    setModal(null)
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
    const { moves } = G.hintList(s, 0)
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
  }

  function adoptAdvice() {
    const s = stRef.current
    if (!s || !advice || !advice.move) { toastMsg(T.noCards); return }
    const next = {}
    const cards = cardsFromCounts(s.hands[0])
    const want = advice.move.cards.slice()
    cards.forEach(c => {
      const k = want.indexOf(c.rank)
      if (k >= 0) { next[c.id] = true; want.splice(k, 1) }
    })
    setSel(next)
    toastMsg(fmt(T.selectToast, { n: Object.keys(next).length }))
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

  /* 快捷键：空格提示 / 回车出牌 / Esc 取消（在输入框里打字时不拦） */
  useEffect(() => {
    if (view !== 'table') return
    function onKey(e) {
      const tag = (e.target && e.target.tagName) || ''
      if (/^(INPUT|TEXTAREA|SELECT)$/i.test(tag) || e.isComposing) return
      if (modal) return
      if (auto) return
      const s = stRef.current
      if (!s || s.phase !== 'play' || s.turn !== 0) return
      if (e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space') {
        e.preventDefault()
        userHint()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        userPlay()
      } else if (e.key === 'Escape') {
        setSel({})
        setAdvice(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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
    const best = iWin ? Math.min(stats.best || 1e9, s.result.seconds) : stats.best
    saveStats({
      ...stats,
      [key]: { games: prev.games + 1, wins: prev.wins + (iWin ? 1 : 0) },
      best: best === 1e9 ? undefined : best,
      byTier,
    })
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
    if (who === null || who === undefined) return
    const isAuto = who !== 0 || auto
    if (!isAuto) return
    const tier = (s.tiers && s.tiers[who]) || 'go'
    const delay = kind === 'bid' ? 700 : kind === 'double' ? 800 : (tier === 'free' ? 450 : tier === 'go' ? 550 : 700)
    const timer = setTimeout(() => {
      const g = stRef.current
      if (!g || g.phase === 'over') return
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
          // 托管时把我这一手的 AI 判断留在建议卡里，让用户看得到理由
          if (seat === 0) setAdvice({ move: r.move, reason: r.reason, win: r.win })
          setThinking('')
          if (r.move) {
            const mv = DDZ.classify(r.move.cards)
            if (mv && (mv.type === 'bomb' || mv.type === 'rocket')) beep('bomb'); else beep('play')
            G.applyPlay(g, seat, r.move.cards)
          } else {
            G.applyPass(g, seat)
          }
          if (g.phase === 'over') maybeFinish(g)
        }
      } catch (e) {
        console.warn('[doudizhu] AI 行动失败', e)
      }
      turnStart.current = Date.now()
      setRemain(30)
      if (!(kind === 'play' && who === 0 && auto)) setAdvice(null)
      touch()
    }, delay)
    return () => clearTimeout(timer)
  })

  /* 重新发牌：等一会儿自动开新局 */
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

  /* 本局计时：每秒推一下 */
  useEffect(() => {
    if (view !== 'table') return
    const id = setInterval(() => {
      const s = stRef.current
      if (!s || s.phase === 'over') return
      setNowTick(Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [view])

  /* 轮到我时自动给建议（托管中不算，避免和 AI 推进互相打架） */
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
  const setupScreen = () => {
    const total = (stats.total && stats.total.games) || 0
    const wins = (stats.total && stats.total.wins) || 0
    const losses = Math.max(0, total - wins)
    const rate = total ? Math.round(wins / total * 100) : 0
    const wantSota = tiers.indexOf('sota') >= 0
    const sotaRow = () => {
      const p = Math.round((sota.progress || 0) * 100)
      const text = sota.status === 'ready' ? T.sotaReady
        : sota.status === 'downloading' ? fmt(T.sotaLoading, { p: p })
          : sota.status === 'error' ? fmt(T.sotaError, { msg: sota.error || '?' })
            : T.sotaIdle
      return h('div', { className: 'ddz-statsline ddz-sota-row' },
        h('span', null, T.sotaTitle + ' · ', h('b', { className: sota.status === 'ready' ? 'win' : (sota.status === 'error' ? 'lose' : '') }, text)),
        sota.status === 'error'
          ? h('button', {
            className: 'ddz-btn ddz-btn--ghost',
            onClick: () => { SOTA.reset(); SOTA.load().catch(() => { /* 状态回界面 */ }) }
          }, T.sotaRetry)
          : null,
        sota.status === 'idle'
          ? h('button', {
            className: 'ddz-btn ddz-btn--ghost',
            onClick: () => { SOTA.load().catch(() => { /* 状态回界面 */ }) }
          }, T.sotaDownload)
          : null)
    }
    return h('section', { className: 'ddz-screen ddz-setup' + (view === 'setup' ? ' is-on' : '') },
      h('div', { className: 'ddz-setup-card' },
        h(WhaleSvg, { cls: 'ddz-setup-watermark' }),
        h('header', { className: 'ddz-setup-head' },
          h('h1', { className: 'ddz-setup-title' }, h(WhaleSvg, { cls: 'ddz-whale-mark' }), T.appName)),
        h('p', { className: 'ddz-setup-sub' }, T.tagline),
        h('h3', null, T.modeTitle),
        h('div', { className: 'ddz-modecard' },
          h('button', { className: 'ddz-mode' + (mode === 'score' ? ' is-on' : ''), onClick: () => setMode('score') },
            h('b', null, T.modeScore), h('span', null, T.modeDescScore)),
          h('button', { className: 'ddz-mode' + (mode === 'rob' ? ' is-on' : ''), onClick: () => setMode('rob') },
            h('b', null, T.modeRob), h('span', null, T.modeDescRob))),
        h('h3', null, T.tiersTitle),
        h('div', { className: 'ddz-tiers' },
          [0, 1, 2].map(seat => h('div', { className: 'ddz-tier' + (seat === 0 ? ' is-on' : ''), key: seat },
            h(Avatar, { seat: seat }),
            h('span', { className: 'ddz-tier-name' }, whoName(seat, T)),
            h('select', {
              'aria-label': whoName(seat, T),
              value: tiers[seat],
              onChange: e => {
                const next = tiers.slice()
                next[seat] = e.target.value
                setTiers(next)
              },
            }, TIERS.map(t => h('option', { key: t, value: t }, T.tierNames[t] || t)))))),
        wantSota ? sotaRow() : null,
        h('div', { className: 'ddz-setup-actions' },
          h('button', { className: 'ddz-btn ddz-btn--primary', onClick: () => startGame() }, T.start),
          h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => setModal('help') }, T.help)),
        h('div', { className: 'ddz-statsline' },
          h('span', null, fmt(T.statsTotal, { n: total }), ' ', h('b', null, total)),
          h('span', null, fmt(T.statsWin, { n: wins }), ' ', h('b', { className: 'win' }, wins)),
          h('span', null, fmt(T.statsLose, { n: losses }), ' ', h('b', { className: 'lose' }, losses)),
          h('span', null, fmt(T.statsRate, { n: rate }), ' ', h('b', { className: 'win' }, rate + '%')),
          h('span', null, fmt(T.statsBest, { t: stats.best ? mmss(stats.best) : '—' })))))
  }

  const tableScreen = () => {
    if (!st) return null
    const handCards = cardsFromCounts(st.hands[0])
    const myTurn = st.phase === 'play' && st.turn === 0
    const counts = G.seatCounts(st)
    const bidders = st.phase === 'bid' ? G.bidSeat(st) : -1
    const elapsed = ((st.endedAt || nowTick) - st.startedAt) / 1000

    return h('section', { className: 'ddz-screen ddz-table' + (view === 'table' ? ' is-on' : '') },
      topbar(),
      counterBar(st, T, counterOpen),
      h('div', { className: 'ddz-statusbar' },
        h('div', { className: 'ddz-bottomcards' },
          h('span', { className: 'lbl' }, T.bottomCards),
          h('span', null, cardsFromCounts(st.bottom).map(c => h(Card, { key: c.id, card: c, small: true })))),
        h('div', { className: 'ddz-mult' },
          h('span', { className: 'x' }, '×' + currentMult(st)),
          h('span', { className: 't' }, T.multLabel)),
        h('div', { className: 'ddz-statuschips' },
          h('span', { className: 'ddz-statuschip' }, fmt(T.baseBidChip, { base: st.base || 1, bid: st.mode === 'score' ? (st.bidHigh || 0) : 1 })),
          h('span', { className: 'ddz-statuschip bomb' }, h('b', null, '×' + (st.bombs || 0)), ' ' + T.bombChip),
          h('span', { className: 'ddz-statuschip' }, fmt(T.clockChip, { t: mmss(elapsed) })))),
      h('div', { className: 'ddz-seatrow' },
        h(Seat, { st, seat: 2, T }),
        h('div', { className: 'ddz-turnpill' }, turnPill(bidders)),
        h(Seat, { st, seat: 1, T })),
      midSection(),
      h('div', { className: 'ddz-bottom' },
        h('div', { className: 'ddz-myseat' },
          h(Seat, { st, seat: 0, T, remain: remain, me: true })),
        h('div', { className: 'ddz-handwrap' },
          h(Hand, {
            cards: handCards,
            selected: sel,
            onSelect: (id, on) => setSel(prev => { const n = { ...prev }; if (on) n[id] = true; else delete n[id]; return n }),
            disabled: !myTurn || auto,
            T,
          })),
        h('div', { className: 'ddz-info' },
          h('span', null, infoTurn()),
          h('span', { className: 'sel-n' }, fmt(T.selectToast, { n: Object.keys(sel).length }))),
        h('div', { className: 'ddz-actions' },
          h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => { setSel({}); setAdvice(null) } }, T.cancel),
          h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: userPass, disabled: !myTurn || auto || !(st.last && st.last.seat !== 0) }, T.passAction),
          h('button', { className: 'ddz-btn ddz-btn--primary', onClick: userPlay, disabled: !myTurn || auto }, T.playAction),
          h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: userHint, disabled: !myTurn || auto }, T.hint),
          h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: askAdvice, disabled: !myTurn || auto }, T.advice),
          h('button', { className: 'ddz-btn ddz-btn--ghost' + (auto ? ' is-on' : ''), onClick: () => { setAuto(v => !v); toastMsg(!auto ? T.autoOn : T.auto) } }, auto ? T.autoOn : T.auto),
          h('button', { className: 'ddz-btn ddz-btn--danger', onClick: () => setModal('surrender'), disabled: st.phase !== 'play' }, T.surrender))),
      adviceCard())
  }

  function topbar() {
    return h('div', { className: 'ddz-topbar' },
      h('div', { className: 'ddz-title' },
        h('b', null, T.appName),
        h('small', null, st ? (st.phase === 'over' ? '' : (st.mode === 'rob' ? T.modeRob : T.modeScore) + ' · ' + tierLabel(tiers[0], T)) : T.tagline)),
      h('div', { className: 'ddz-chips' },
        h('button', { className: 'ddz-chipbtn' + (counterOpen ? ' is-on' : ''), title: T.counter, onClick: () => setCounterOpen(v => !v) },
          h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': 'true' },
            h('rect', { x: 4, y: 3, width: 16, height: 18, rx: 2 }), h('path', { d: 'M8 8h8M8 12h8M8 16h5' })),
          h('span', { className: 'lbl' }, T.counter)),
        h('button', { className: 'ddz-chipbtn' + (auto ? ' is-on' : ''), onClick: () => setAuto(v => !v) }, h('span', { className: 'lbl' }, auto ? T.autoOn : T.auto)),
        st && (st.phase === 'play' || st.phase === 'double') && !st.open[0]
          ? h('button', { className: 'ddz-chipbtn', onClick: userOpen, title: T.openOn }, h('span', { className: 'lbl' }, T.openShort))
          : null,
        h('button', { className: 'ddz-chipbtn' + (sound ? ' is-on' : ''), onClick: () => { setSound(v => { try { localStorage.setItem('ddz-sound', v ? '0' : '1') } catch { /* ignore */ } ; return !v }) } },
          h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': 'true' },
            h('path', { d: 'M11 5 6 9H3v6h3l5 4z' }), h('path', { d: 'M15.5 8.5a5 5 0 0 1 0 7' })),
          h('span', { className: 'lbl' }, T.sound)),
        h('button', { className: 'ddz-chipbtn', onClick: () => { const next = lang === 'zh' ? 'en' : 'zh'; setLang(next); try { localStorage.setItem('ddz-lang', next) } catch { /* ignore */ } } }, h('span', { className: 'lbl' }, T.lang)),
        h('button', { className: 'ddz-chipbtn', onClick: () => setModal('help') }, '?'),
        h('button', { className: 'ddz-chipbtn', onClick: () => { setView('setup'); stRef.current = null; setModal(null) } }, h('span', { className: 'lbl' }, T.back))))
  }

  function turnPill(bidders) {
    if (st.phase === 'bid') return fmt(T.turnBid, { who: whoName(bidders, T) })
    if (st.phase === 'double') return T.doubleTurn
    if (st.phase === 'play') return fmt(T.turnPlay, { who: whoName(st.turn, T) })
    return T.landlordIs ? fmt(T.landlordIs, { who: whoName(st.landlord, T) }) : ''
  }

  function infoTurn() {
    if (!st) return ''
    if (st.phase === 'play' && st.turn === 0) return auto ? T.autoOn : T.yourTurn
    if (st.phase === 'play') return fmt(T.thinking, { tier: tierLabel(tiers[st.turn] || 'go', T) })
    if (st.phase === 'over') return ''
    return fmt(T.nowPhase, { phase: st.phase === 'bid' ? T.modeScore : T.doubleTurn })
  }

  function midSection() {
    const lastCards = st.last ? cardsFromCounts(DDZ.countsOf(st.last.move.cards)) : null
    const isBomb = st.last && st.last.move && (st.last.move.type === 'bomb' || st.last.move.type === 'rocket')
    const recent = st.recent || {}
    const side = (seat) => {
      const a = recent[seat]
      return h('div', { className: 'ddz-sideplay' },
        h('span', { className: 'who' }, whoName(seat, T)),
        a && a.type === 'pass' ? h('span', { className: 'ddz-sidepass' }, T.passAction) : null,
        a && a.type === 'play'
          ? h('div', { className: 'ddz-played' }, cardsFromCounts(DDZ.countsOf(a.cards)).map(c => h(Card, { key: c.id, card: c, small: true })))
          : null)
    }
    return h('div', { className: 'ddz-mid' },
      h(WhaleSvg, { cls: 'ddz-mid-whale' }),
      h('div', { className: 'ddz-mid-grid' },
        side(2),
        h('div', { className: 'ddz-mid-center' },
          h('div', { className: 'ddz-lastlabel' }, st.last ? T.lastPlay : T.noPlay),
          st.last ? h('div', { className: 'ddz-played' + (isBomb ? ' is-bomb' : '') },
            lastCards.map(c => h(Card, { key: c.id, card: c, small: true }))) : null,
          thinking ? h('div', { className: 'ddz-think' }, h('span', { className: 'ddz-spinner' }), h('span', null, thinking)) : null,
          !st.last && !thinking ? h('div', { className: 'ddz-mid-empty' }, T.noPlay) : null),
        side(1)),
      phaseOverlay())
  }

  function phaseOverlay() {
    if (st.phase === 'bid') {
      const seat = G.bidSeat(st)
      const opts = seat === 0 ? G.bidOptions(st) : []
      return h('div', { className: 'ddz-overlay is-on', style: { position: 'absolute', background: 'transparent' } },
        h('div', { className: 'ddz-dialog', style: { maxWidth: 400 } },
          h('div', { className: 'ddz-dialog-strip info' }),
          h('h2', null, fmt(T.turnBid, { who: whoName(seat, T) })),
          h('p', { className: 'sub' }, st.mode === 'rob' ? T.modeDescRob : T.modeDescScore),
          seat === 0
            ? h('div', { className: 'ddz-bid-opts' },
              opts.map(v => h('button', {
                key: String(v),
                className: 'ddz-btn ' + (v === 0 ? 'ddz-btn--ghost' : 'ddz-btn--primary'),
                onClick: () => userBid(v),
              }, bidText(v))))
            : h('div', { className: 'ddz-think' }, h('span', { className: 'ddz-spinner' }), '…')))
    }
    if (st.phase === 'double') {
      const done = st.doubleChosen
      return h('div', { className: 'ddz-overlay is-on', style: { position: 'absolute', background: 'transparent' } },
        h('div', { className: 'ddz-dialog', style: { maxWidth: 400 } },
          h('div', { className: 'ddz-dialog-strip info' }),
          h('h2', null, T.doubleTurn),
          h('p', { className: 'sub' }, fmt(T.landlordIs, { who: whoName(st.landlord, T) })),
          h('div', { className: 'ddz-props' },
            [0, 1, 2].map(s => h('div', { className: 'ddz-props-row', key: s },
              h('span', { className: 'k' }, whoName(s, T)),
              h('span', { className: 'v' }, done[s] ? (st.doubling[s] === 1 ? T.doubleNone : st.doubling[s] === 2 ? T.doubleX2 : T.doubleX4) : '…')))),
          done[0] ? null : h('div', { className: 'ddz-bid-opts' },
            h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => userDouble(1) }, T.doubleNone),
            h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => userDouble(2) }, T.doubleX2),
            h('button', { className: 'ddz-btn ddz-btn--primary', onClick: () => userDouble(4) }, T.doubleX4)),
          st.open[0] ? null : h('div', { className: 'ddz-bid-opts' },
            h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: userOpen }, T.openShort))))
    }
    return null
  }

  function bidText(v) {
    if (v === 0) return T.pass
    if (st.mode === 'rob') return v === 'call' ? T.call : v === 'rob' ? T.rob : String(v)
    return v + '分'
  }

  function adviceCard() {
    if (!advice) return null
    return h('div', { className: 'ddz-advice' },
      h('div', { className: 'ddz-advice-head' }, h(WhaleSvg, null), T.adviceTitle),
      h('div', { className: 'ddz-advice-move' }, advice.move ? DDZ.cardsText(advice.move.cards) : T.passAction),
      advice.reason ? h('div', { className: 'ddz-advice-why' }, advice.reason) : null,
      typeof advice.win === 'number' ? h('div', { className: 'ddz-advice-rate' }, fmt(T.adviceWin, { n: Math.round(advice.win) })) : null,
      h('button', { className: 'ddz-btn ddz-btn--primary', onClick: adoptAdvice }, T.adopt))
  }

  function toastEl() {
    return toast ? h('div', { className: 'ddz-toast' }, toast) : null
  }

  function modalEl() {
    if (modal === 'help') return h(Help, { T, onClose: () => setModal(null) })
    if (modal === 'result' && st && st.result) {
      return h(Result, {
        st, T,
        onAgain: () => startGame(),
        onReTier: () => { setView('setup'); setModal(null); stRef.current = null },
        onReplay: () => setModal('replay'),
        onClose: () => setModal(null),
      })
    }
    if (modal === 'replay' && st) return h(Replay, { st, T, onClose: () => setModal(null) })
    if (modal === 'surrender') {
      return h('div', { className: 'ddz-overlay is-on' },
        h('div', { className: 'ddz-dialog', style: { maxWidth: 380 } },
          h('div', { className: 'ddz-dialog-strip', style: { background: 'linear-gradient(90deg,var(--ddz-bad),transparent)' } }),
          h('h2', null, T.surrenderTitle),
          h('p', { className: 'sub' }, T.surrenderAsk),
          h('div', { className: 'ddz-dialog-actions' },
            h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => setModal(null) }, T.cancel),
            h('button', { className: 'ddz-btn ddz-btn--danger', onClick: () => { setModal(null); userSurrender() } }, T.confirm))))
    }
    if (modal === 'open') {
      return h('div', { className: 'ddz-overlay is-on' },
        h('div', { className: 'ddz-dialog', style: { maxWidth: 380 } },
          h('div', { className: 'ddz-dialog-strip info' }),
          h('h2', null, T.openShort + '？'),
          h('p', { className: 'sub' }, T.openAsk),
          h('div', { className: 'ddz-dialog-actions' },
            h('button', { className: 'ddz-btn ddz-btn--ghost', onClick: () => setModal(null) }, T.cancel),
            h('button', { className: 'ddz-btn ddz-btn--primary', onClick: confirmOpen }, T.confirm))))
    }
    return null
  }

  return h('div', { className: 'ddz-root' },
    setupScreen(),
    tableScreen(),
    toastEl(),
    modalEl())
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
