/* 斗地主插件样式：大肥鱼浅色软萌（奶油蓝牌桌）。固定浅色，不跟系统深色翻转。 */
const CSS = String.raw`
.ddz-root {
  --ddz-bg: #F5F8FC;
  --ddz-panel: rgba(255, 255, 255, 0.82);
  --ddz-panel-solid: #FFFFFF;
  --ddz-line: rgba(30, 79, 156, 0.10);
  --ddz-line-strong: rgba(30, 79, 156, 0.18);
  --ddz-text: #1B2A44;
  --ddz-dim: #6B7C99;
  --ddz-accent: #4BA3E3;
  --ddz-accent-weak: rgba(75, 163, 227, 0.14);
  --ddz-good: #3DBF8F;
  --ddz-bad: #F07178;
  --ddz-gold: #D4A84B;
  --ddz-felt: radial-gradient(120% 90% at 50% 0%, #EAF4FC 0%, #F7FBFE 48%, #EEF6FB 100%);
  --ddz-card-bg: linear-gradient(180deg, #FFFFFF 0%, #F3F7FC 100%);
  --ddz-card-ink: #1B2A44;
  --ddz-red: #E25563;
  color-scheme: light;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--ddz-text);
  background-color: var(--ddz-bg);
  background-image:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.12 0 0 0 0 0.36 0 0 0 0 0.62 0 0 0 0.2 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"),
    repeating-linear-gradient(0deg, rgba(255,255,255,.28) 0 1px, transparent 1px 4px),
    repeating-linear-gradient(90deg, rgba(75,163,227,.06) 0 1px, transparent 1px 5px),
    var(--ddz-felt);
  background-size: 128px 128px, auto, auto, auto;
  font: 13px/1.45 "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.ddz-root * { box-sizing: border-box; }
.ddz-scroll { overflow: auto; min-height: 0; position: relative; z-index: 1; }
.ddz-decor { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.ddz-watermark {
  position: absolute; left: 50%; top: 46%;
  width: min(300px, 46%); height: min(300px, 46%);
  transform: translate(-50%, -46%);
  border-radius: 50%; object-fit: cover; opacity: .14;
}
.ddz-stamp {
  position: absolute; width: 58px; height: 58px; border-radius: 50%;
  object-fit: cover; opacity: .28;
  box-shadow: 0 0 0 4px rgba(255,255,255,.35);
}
.ddz-stamp.s1 { left: 12px; bottom: 18px; transform: rotate(-8deg); }
.ddz-stamp.s2 { right: 16px; top: 58px; width: 46px; height: 46px; transform: rotate(10deg); }
.ddz-bubble {
  position: absolute; border-radius: 50%;
  background: radial-gradient(circle at 32% 30%, #fff 0 18%, rgba(126,200,232,.72) 42%, rgba(75,163,227,.08) 68%, transparent 70%);
}
.ddz-bubble.d1 { width: 84px; height: 84px; left: -18px; top: 72px; }
.ddz-bubble.d2 { width: 42px; height: 42px; left: 46px; top: 54px; opacity: .85; }
.ddz-bubble.d3 { width: 96px; height: 96px; right: -24px; bottom: 36px; }
.ddz-bubble.d4 { width: 34px; height: 34px; right: 72px; bottom: 22px; opacity: .9; }
.ddz-whale {
  position: absolute; font-size: 22px; line-height: 1; opacity: .62;
  filter: drop-shadow(0 1px 0 #fff);
}
.ddz-whale.w1 { left: 78px; bottom: 26px; transform: rotate(-14deg); }
.ddz-whale.w2 { right: 22px; top: 112px; font-size: 18px; transform: rotate(12deg); }
.ddz-topbar, .ddz-counterbar, .ddz-table { position: relative; z-index: 1; }

/* ---------- 顶栏 ---------- */
.ddz-topbar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--ddz-line);
  background: linear-gradient(180deg, rgba(255,255,255,.78), rgba(255,255,255,.42));
  backdrop-filter: blur(10px);
}
.ddz-brand {
  width: 28px; height: 28px; border-radius: 50%; flex: 0 0 28px;
  object-fit: cover; background: #fff;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1.5px #7EC8E8, 0 3px 8px rgba(30, 79, 156, .16);
}
.ddz-title { font-size: 14px; font-weight: 700; letter-spacing: .3px; color: #1E4F9C; }
.ddz-title small { color: var(--ddz-dim); font-weight: 450; margin-left: 8px; }
.ddz-topbar .ddz-spacer { flex: 1; }
.ddz-chipbtn {
  height: 28px; padding: 0 11px; border-radius: 999px;
  border: 1px solid var(--ddz-line); background: rgba(255,255,255,.88);
  color: var(--ddz-text); font-size: 12px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  box-shadow: 0 1px 2px rgba(30, 79, 156, .05);
  transition: border-color .15s ease, background .15s ease, transform .06s ease;
}
.ddz-chipbtn:hover { border-color: var(--ddz-accent); }
.ddz-chipbtn:active { transform: translateY(1px); }
.ddz-chipbtn.is-on { background: var(--ddz-accent-weak); border-color: var(--ddz-accent); color: #1E4F9C; font-weight: 650; }

/* ---------- 按钮 / 分段 ---------- */
.ddz-btn {
  height: 40px; padding: 0 16px; border-radius: 12px; cursor: pointer;
  border: 1px solid var(--ddz-line-strong); background: rgba(255,255,255,.9);
  color: var(--ddz-text); font-size: 13px; font-weight: 600;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 1px 2px rgba(30, 79, 156, .05);
  transition: transform .06s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease;
}
.ddz-btn:hover { border-color: var(--ddz-accent); }
.ddz-btn:active { transform: translateY(1px); }
.ddz-btn.primary {
  height: 44px; font-size: 15px;
  background: linear-gradient(180deg, #8FD0F2 0%, #4BA3E3 46%, #1E4F9C 100%);
  border-color: #1E4F9C; color: #fff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 6px 14px rgba(30, 79, 156, .22);
}
.ddz-actions .ddz-btn.primary { height: 48px; min-width: 108px; font-size: 17px; letter-spacing: .6px; padding: 0 22px; }
.ddz-btn.primary:hover { background: linear-gradient(180deg, #a6dcf6 0%, #5eb0ea 46%, #255cae 100%); }
.ddz-btn.ghost { background: transparent; box-shadow: none; }
.ddz-btn.danger {
  color: var(--ddz-bad); background: transparent; box-shadow: none;
  border-color: rgba(240, 113, 120, .55);
}
.ddz-btn.danger:hover { background: rgba(240, 113, 120, .08); border-color: var(--ddz-bad); }
.ddz-btn[disabled] { opacity: .45; cursor: default; box-shadow: none; }
.ddz-seg { display: inline-flex; padding: 2px; gap: 2px; border-radius: 12px; border: 1px solid var(--ddz-line); background: rgba(75, 163, 227, .08); }
.ddz-seg button {
  height: 28px; padding: 0 12px; border-radius: 9px; border: 0; background: transparent;
  color: var(--ddz-dim); font-size: 12px; cursor: pointer;
}
.ddz-seg button.is-on { background: #fff; color: #1E4F9C; font-weight: 700; box-shadow: 0 1px 3px rgba(30, 79, 156, .08); }

/* ---------- 开局页 ---------- */
.ddz-setup { max-width: 720px; margin: 0 auto; padding: 28px 22px 40px; width: 100%; }
.ddz-hero { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
.ddz-hero-avatar {
  width: 72px; height: 72px; border-radius: 50%; flex: 0 0 72px;
  object-fit: cover; background: #fff;
  border: 3px solid #fff;
  box-shadow: 0 0 0 2px #7EC8E8, 0 10px 22px rgba(75, 163, 227, .28);
}
.ddz-setup h1 { margin: 0 0 4px; font-size: 26px; letter-spacing: .4px; color: #1E4F9C; }
.ddz-setup .sub { color: var(--ddz-dim); margin: 0; }
.ddz-field { margin-bottom: 20px; }
.ddz-field > label { display: block; color: var(--ddz-dim); font-size: 12px; margin-bottom: 8px; letter-spacing: .2px; }
.ddz-tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.ddz-tiercard {
  padding: 12px; border: 1px solid var(--ddz-line); border-radius: 16px;
  background: var(--ddz-panel); box-shadow: 0 8px 20px rgba(30, 79, 156, .05);
}
.ddz-tiercard b { display: block; font-size: 12px; font-weight: 700; margin-bottom: 8px; color: #1E4F9C; }
.ddz-tiercard select {
  width: 100%; height: 32px; border-radius: 10px; border: 1px solid var(--ddz-line-strong);
  background: var(--ddz-panel-solid); color: var(--ddz-text); font-size: 12px; padding: 0 8px;
}
.ddz-modecard { display: flex; gap: 8px; }
.ddz-modecard button {
  flex: 1; text-align: left; padding: 12px; border-radius: 16px; cursor: pointer;
  border: 1px solid var(--ddz-line); background: var(--ddz-panel); color: var(--ddz-text);
  box-shadow: 0 8px 20px rgba(30, 79, 156, .04);
  transition: border-color .15s ease, background .15s ease, transform .06s ease;
}
.ddz-modecard button:hover { border-color: rgba(75, 163, 227, .45); }
.ddz-modecard button.is-on { border-color: var(--ddz-accent); background: var(--ddz-accent-weak); }
.ddz-modecard b { display: block; font-size: 13px; margin-bottom: 3px; color: #1E4F9C; }
.ddz-modecard span { color: var(--ddz-dim); font-size: 11.5px; }
.ddz-setup-actions { display: flex; align-items: center; gap: 12px; margin-top: 26px; }
.ddz-kbi { color: var(--ddz-dim); font-size: 11.5px; }
.ddz-statsline { color: var(--ddz-dim); font-size: 12px; margin-top: 18px; }

/* ---------- 牌桌 ---------- */
.ddz-table { position: relative; flex: 1; min-height: 0; display: grid; grid-template-rows: auto 1fr auto; }
.ddz-seatrow { display: flex; justify-content: space-between; align-items: stretch; gap: 8px; padding: 8px 12px 4px; }
.ddz-mid-pill { flex: 1; display: flex; justify-content: center; align-items: center; min-width: 0; }
.ddz-seat {
  min-width: 188px; padding: 10px 14px 10px 10px; border-radius: 18px;
  border: 1px solid var(--ddz-line); background: var(--ddz-panel); backdrop-filter: blur(8px);
  display: flex; align-items: center; gap: 10px;
  box-shadow: 0 8px 18px rgba(30, 79, 156, .05);
  transition: border-color .2s, box-shadow .2s;
}
.ddz-seat.seat-0 { border-color: rgba(75, 163, 227, .38); }
.ddz-seat.seat-1 { border-color: rgba(126, 200, 232, .95); }
.ddz-seat.seat-2 { border-color: rgba(30, 79, 156, .22); }
.ddz-seat.is-me { border-color: rgba(75, 163, 227, .55); }
.ddz-seat.is-landlord { border-color: rgba(212, 168, 75, .72); }
.ddz-seat.is-turn {
  border-color: var(--ddz-accent);
  box-shadow: 0 0 0 2px rgba(75, 163, 227, .22), 0 8px 20px rgba(75, 163, 227, .16);
  animation: ddz-breathe 1.8s ease-in-out infinite;
}
@keyframes ddz-breathe {
  0%, 100% { box-shadow: 0 0 0 2px rgba(75, 163, 227, .20), 0 8px 18px rgba(75, 163, 227, .12); }
  50% { box-shadow: 0 0 0 4px rgba(126, 200, 232, .45), 0 10px 24px rgba(75, 163, 227, .28); }
}
.ddz-avatar {
  width: 52px; height: 52px; border-radius: 50%; flex: 0 0 52px;
  background: #fff; position: relative;
  border: 2px solid #7EC8E8;
  box-shadow: 0 4px 10px rgba(30, 79, 156, .12);
}
.ddz-seat.seat-0 .ddz-avatar { width: 60px; height: 60px; flex-basis: 60px; border-color: #4BA3E3; }
.ddz-seat.seat-1 .ddz-avatar { border-color: #7EC8E8; }
.ddz-seat.seat-2 .ddz-avatar { border-color: #8AA4D4; }
.ddz-seat .ddz-avatar.landlord {
  border-color: var(--ddz-gold);
  box-shadow: 0 0 0 3px rgba(212, 168, 75, .28), 0 4px 10px rgba(212, 168, 75, .2);
}
.ddz-seat.is-turn .ddz-avatar { animation: ddz-avatar-breathe 1.8s ease-in-out infinite; }
@keyframes ddz-avatar-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.045); }
}
.ddz-avatar-img {
  width: 100%; height: 100%; border-radius: 50%;
  object-fit: cover; object-position: center center;
  display: block; pointer-events: none; background: #fff;
}
.ddz-avatar .crown {
  position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
  font-size: 18px; line-height: 1; color: var(--ddz-gold); z-index: 2; pointer-events: none;
  filter: drop-shadow(0 1px 0 #fff) drop-shadow(0 2px 2px rgba(166, 124, 45, .45));
}
.ddz-seat.is-me .ddz-avatar .crown { font-size: 22px; top: -16px; }
.ddz-seat .meta { min-width: 0; }
.ddz-seat .name { font-size: 14px; font-weight: 800; white-space: nowrap; color: #1B2A44; }
.ddz-seat .sub2 { font-size: 12px; color: var(--ddz-dim); white-space: nowrap; margin-top: 2px; }
.ddz-seat .sub2 em { font-style: normal; color: var(--ddz-accent); font-weight: 700; }
.landlord-tag {
  display: inline-flex; align-items: center; margin-left: 4px; padding: 0 6px; height: 16px;
  border-radius: 999px; background: linear-gradient(180deg, #F8E7B8, #F0D48A);
  color: #7A5A16; font-size: 10px; font-weight: 800; letter-spacing: .2px; vertical-align: 1px;
}
.ddz-ring { position: relative; width: 26px; height: 26px; flex: 0 0 26px; margin-left: auto; }
.ddz-ring span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 10.5px; color: var(--ddz-dim); font-weight: 700; }
.ddz-ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
.ddz-ring circle { fill: none; stroke-width: 2.4; }
.ddz-ring .bg { stroke: rgba(30, 79, 156, .12); }
.ddz-ring .fg { stroke: var(--ddz-accent); transition: stroke-dashoffset .5s linear; }

.ddz-mid {
  position: relative; display: flex; min-height: 0; margin: 4px 12px 0;
  border-radius: 22px;
  background:
    radial-gradient(circle at 50% 42%, rgba(255,255,255,.55), rgba(255,255,255,.18) 58%, rgba(126,200,232,.12));
  border: 1px solid rgba(126, 200, 232, .45);
  box-shadow: inset 0 0 0 5px rgba(255,255,255,.28), 0 8px 18px rgba(30, 79, 156, .04);
  overflow: hidden;
}
.ddz-mid .ddz-watermark { width: 240px; height: 240px; opacity: .16; }
.ddz-mid-inner {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  gap: 8px; width: 100%; height: 100%; min-height: 0; padding: 10px 12px 12px;
}
.ddz-infobar { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; width: 100%; }
.ddz-pill {
  display: inline-flex; align-items: center; height: 30px; padding: 0 12px;
  border-radius: 999px; background: rgba(255,255,255,.92);
  border: 1px solid rgba(75, 163, 227, .32);
  color: #1E4F9C; font-size: 12.5px; font-weight: 800;
  box-shadow: 0 3px 8px rgba(30, 79, 156, .06);
}
.ddz-pill.is-phase { background: linear-gradient(180deg, #5eb0ea, #1E4F9C); color: #fff; border-color: #1E4F9C; }
.ddz-pill.is-gold { background: linear-gradient(180deg, #fff8e4, #f3d48a); color: #7A5A16; border-color: rgba(212, 168, 75, .7); }
.ddz-pill.is-mult { background: linear-gradient(180deg, #e7f6ff, #fff); border-color: #4BA3E3; }
.ddz-kitty {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px 6px 12px; border-radius: 16px;
  background: rgba(255,255,255,.82); border: 1px solid rgba(212, 168, 75, .45);
  box-shadow: 0 4px 12px rgba(212, 168, 75, .08);
}
.ddz-kitty .ddz-lastlabel { color: #7A5A16; font-weight: 800; }
.ddz-kitty-cards { display: flex; align-items: flex-end; min-height: 52px; }
.ddz-lastlabel { color: var(--ddz-dim); font-size: 12px; letter-spacing: .4px; font-weight: 700; }
.ddz-played {
  display: flex; gap: 4px; flex: 1; width: min(100%, 760px); min-height: 96px;
  align-items: center; justify-content: center;
  padding: 8px 12px; border-radius: 18px;
  background: rgba(255,255,255,.62);
  border: 1px dashed rgba(75, 163, 227, .45);
  box-shadow: inset 0 0 18px rgba(126, 200, 232, .16);
}
.ddz-played.is-bomb { animation: ddz-bombflash .72s ease 1; }
@keyframes ddz-bombflash {
  0% { background: transparent; box-shadow: none; }
  30% { background: rgba(255, 236, 186, .78); box-shadow: 0 0 0 6px rgba(226, 85, 99, .22), 0 0 24px rgba(212, 168, 75, .62); }
  100% { background: transparent; box-shadow: none; }
}
.ddz-turnpill {
  padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 650;
  background: rgba(255,255,255,.82); border: 1px solid var(--ddz-line);
  box-shadow: 0 4px 12px rgba(30, 79, 156, .06);
  color: #1E4F9C;
}
.ddz-turnpill.is-you { color: var(--ddz-good); border-color: rgba(61, 191, 143, .4); }
.ddz-think {
  display: inline-flex; align-items: center; gap: 7px; color: var(--ddz-dim); font-size: 12px;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(255,255,255,.74); border: 1px solid var(--ddz-line);
}
.ddz-spin {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid rgba(126, 200, 232, .55); border-top-color: var(--ddz-accent);
  animation: ddz-spin .8s linear infinite;
}
@keyframes ddz-spin { to { transform: rotate(360deg); } }
.ddz-pass {
  padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 650;
  color: var(--ddz-dim); background: rgba(255,255,255,.86);
  border: 1px solid var(--ddz-line);
  animation: ddz-pass 1.15s ease forwards;
}
@keyframes ddz-pass {
  0% { opacity: 0; transform: translateY(8px); }
  16% { opacity: 1; transform: translateY(0); }
  68% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-4px); }
}

/* ---------- 底部：手牌区 ---------- */
.ddz-bottom { display: grid; grid-template-columns: minmax(196px, 228px) minmax(0, 1fr) minmax(210px, 268px); gap: 8px; padding: 8px 12px 10px; align-items: end; }
.ddz-meseat { display: flex; align-items: flex-end; min-width: 0; }
.ddz-meseat .ddz-seat { width: 100%; }
.ddz-counterbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  margin: 6px 12px 0; padding: 8px 10px;
  border: 1px solid var(--ddz-line); border-radius: 16px;
  background: rgba(255,255,255,.8);
  box-shadow: 0 6px 16px rgba(30, 79, 156, .05);
}
.ddz-counterbar .ct { font-size: 12px; color: #1E4F9C; font-weight: 800; margin-right: 2px; white-space: nowrap; }
.ddz-count {
  display: inline-flex; align-items: baseline; justify-content: center; gap: 4px;
  min-width: 46px; padding: 6px 8px; border-radius: 11px;
  background: #fff; border: 1px solid rgba(75, 163, 227, .2);
  font-size: 13px; font-weight: 800; line-height: 1.2; color: var(--ddz-text);
  box-shadow: inset 0 1px 0 #fff, 0 2px 4px rgba(30, 79, 156, .04);
}
.ddz-count b { font-size: 13px; color: #1E4F9C; font-weight: 800; }
.ddz-count.is-hot { background: rgba(240, 113, 120, .14); color: var(--ddz-bad); }
.ddz-count.is-hot b { color: var(--ddz-bad); }
.ddz-count.is-zero { opacity: .38; }

.ddz-handwrap { min-width: 0; }
.ddz-hand { display: flex; justify-content: center; align-items: flex-end; min-height: 96px; padding: 20px 4px 0; }
.ddz-card {
  position: relative; width: 48px; height: 70px; margin-left: -20px; flex: 0 0 48px;
  border-radius: 13px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.96) 0%, rgba(255,255,255,.35) 42%, rgba(180, 210, 235, .2) 100%),
    var(--ddz-card-bg);
  color: var(--ddz-card-ink);
  border: 1px solid rgba(30, 79, 156, .14);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.95),
    inset 0 -8px 12px rgba(126, 200, 232, .18),
    0 6px 10px rgba(30, 79, 156, .10),
    0 1px 2px rgba(30, 79, 156, .06);
  cursor: pointer; user-select: none; -webkit-user-select: none; touch-action: none;
  transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease;
  display: flex; flex-direction: column; justify-content: space-between; padding: 5px 6px;
}
.ddz-card:first-child { margin-left: 0; }
.ddz-card:hover { transform: translateY(-6px); }
.ddz-card.is-sel {
  transform: translateY(-16px);
  border-color: var(--ddz-accent);
  box-shadow:
    inset 0 1px 0 #fff,
    0 0 0 2px rgba(75, 163, 227, .9),
    0 14px 18px rgba(75, 163, 227, .28);
}
.ddz-card.is-sel:hover { transform: translateY(-18px); }
.ddz-card .r { font-size: 15px; font-weight: 800; line-height: 1; letter-spacing: -.4px; }
.ddz-card .s { font-size: 15px; line-height: 1; align-self: flex-end; }
.ddz-card.is-red { color: var(--ddz-red); }
.ddz-card.joker .r { font-size: 11px; writing-mode: vertical-rl; letter-spacing: 1px; }
.ddz-card.small { width: 36px; height: 52px; flex-basis: 36px; margin-left: -10px; padding: 3px 4px; border-radius: 11px; }
.ddz-card.small .r, .ddz-card.small .s { font-size: 12px; }
.ddz-card.static { cursor: default; }
.ddz-card.static:hover { transform: none; }
.ddz-played .ddz-card {
  animation: ddz-playin .34s cubic-bezier(.2, .75, .2, 1) both;
}
.ddz-played .ddz-card:nth-child(2) { animation-delay: 28ms; }
.ddz-played .ddz-card:nth-child(3) { animation-delay: 56ms; }
.ddz-played .ddz-card:nth-child(4) { animation-delay: 84ms; }
.ddz-played .ddz-card:nth-child(5) { animation-delay: 112ms; }
.ddz-played .ddz-card:nth-child(6) { animation-delay: 140ms; }
.ddz-played .ddz-card:nth-child(7) { animation-delay: 168ms; }
.ddz-played .ddz-card:nth-child(8) { animation-delay: 196ms; }
.ddz-played .ddz-card:nth-child(9) { animation-delay: 224ms; }
.ddz-played .ddz-card:nth-child(10) { animation-delay: 252ms; }
.ddz-played .ddz-card:nth-child(11) { animation-delay: 280ms; }
.ddz-played .ddz-card:nth-child(12) { animation-delay: 308ms; }
@keyframes ddz-playin {
  from { opacity: 0; transform: translateY(18px) scale(.88); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.ddz-card.back {
  background:
    radial-gradient(circle at 30% 28%, rgba(255,255,255,.55), transparent 42%),
    repeating-linear-gradient(135deg, #8FD0F2 0 6px, #4BA3E3 6px 12px);
  border-color: rgba(30, 79, 156, .18); color: transparent;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 6px 10px rgba(30, 79, 156, .12);
}
.ddz-handinfo { text-align: center; color: var(--ddz-dim); font-size: 11.5px; margin-top: 6px; min-height: 16px; }

.ddz-actions { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.ddz-actions-row { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
.ddz-actions-row .ddz-btn.primary { flex: 1.4; }
.ddz-advice {
  border: 1px solid rgba(126, 200, 232, .55); border-radius: 16px; padding: 9px 11px;
  background: linear-gradient(180deg, rgba(126, 200, 232, .22), rgba(255,255,255,.72));
  font-size: 12px; min-height: 64px;
  box-shadow: 0 8px 16px rgba(75, 163, 227, .06);
}
.ddz-advice .hd { display: flex; align-items: center; gap: 6px; color: #1E4F9C; font-size: 11px; font-weight: 800; margin-bottom: 4px; }
.ddz-advice .hd::before {
  content: ""; width: 8px; height: 8px; border-radius: 50%;
  background: #7EC8E8; box-shadow: 0 0 0 3px rgba(126, 200, 232, .28);
}
.ddz-advice .mv { font-weight: 700; }
.ddz-advice .rs { color: var(--ddz-dim); font-size: 11.5px; margin-top: 2px; line-height: 1.4; }
.ddz-advice .win { color: var(--ddz-good); font-size: 11px; margin-left: auto; font-weight: 700; }

/* ---------- 弹层 ---------- */
.ddz-overlay {
  position: absolute; inset: 0; z-index: 40; display: grid; place-items: center;
  background: rgba(27, 42, 68, .28); backdrop-filter: blur(6px); padding: 20px;
}
.ddz-modal {
  width: min(520px, 100%); max-height: 90%; overflow: auto;
  border: 1px solid rgba(126, 200, 232, .6);
  border-top: 3px solid #7EC8E8;
  border-radius: 22px;
  background: var(--ddz-panel-solid);
  box-shadow: 0 22px 56px rgba(30, 79, 156, .16);
  padding: 20px;
}
.ddz-modal h2 { margin: 0 0 4px; font-size: 18px; color: #1E4F9C; }
.ddz-modal .lead { color: var(--ddz-dim); font-size: 12px; margin-bottom: 16px; }
.ddz-result-big { font-size: 30px; font-weight: 800; margin: 6px 0 2px; letter-spacing: .3px; }
.ddz-result-big.win { color: var(--ddz-good); }
.ddz-result-big.lose { color: var(--ddz-bad); }
.ddz-kv { display: grid; grid-template-columns: 1fr auto; gap: 6px 16px; font-size: 12.5px; margin: 14px 0; }
.ddz-kv .k { color: var(--ddz-dim); }
.ddz-kv .v { text-align: right; font-variant-numeric: tabular-nums; font-weight: 650; }
.ddz-delta { display: flex; gap: 8px; margin: 12px 0 4px; }
.ddz-delta div {
  flex: 1; border: 1px solid var(--ddz-line); border-radius: 12px; padding: 7px 9px; font-size: 12px;
  display: flex; justify-content: space-between; background: rgba(245, 248, 252, .9);
}
.ddz-delta b { font-variant-numeric: tabular-nums; }
.ddz-delta .up { color: var(--ddz-good); }
.ddz-delta .down { color: var(--ddz-bad); }
.ddz-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; flex-wrap: wrap; }
.ddz-help p { margin: 0 0 8px; color: var(--ddz-text); font-size: 12.5px; }
.ddz-help ul { margin: 0 0 10px; padding-left: 18px; color: var(--ddz-dim); font-size: 12px; }
.ddz-help li { margin-bottom: 5px; }
.ddz-tierlist { display: grid; gap: 5px; margin-top: 6px; }
.ddz-tierlist div { display: flex; justify-content: space-between; font-size: 12px; border-bottom: 1px dashed var(--ddz-line); padding-bottom: 4px; }
.ddz-tierlist span:last-child { color: var(--ddz-dim); }

/* 复盘 */
.ddz-replay-seat { display: flex; justify-content: space-between; font-size: 12px; padding: 6px 0; border-bottom: 1px dashed var(--ddz-line); }
.ddz-replay-line { font-size: 12px; color: var(--ddz-dim); padding: 3px 0; }
.ddz-replay-line b { color: var(--ddz-text); font-weight: 650; }
.ddz-toast {
  position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%);
  padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 650; z-index: 60;
  background: rgba(255,255,255,.96); border: 1px solid var(--ddz-line-strong); color: var(--ddz-text);
  box-shadow: 0 10px 28px rgba(30, 79, 156, .16);
  animation: ddz-fade .18s ease;
}
@keyframes ddz-fade { from { opacity: 0; transform: translate(-50%, 6px); } }
.ddz-deal-anim { animation: ddz-deal .45s ease both; }
@keyframes ddz-deal { from { opacity: 0; transform: translateY(18px) scale(.92); } }

/* 飞牌 */
.ddz-fly { position: absolute; z-index: 30; pointer-events: none; transition: transform .26s ease, opacity .26s ease; }

/* More 菜单里那一行 */
.ddz-more-row {
  display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 7px 10px; border: 0; border-radius: 8px; background: transparent;
  color: inherit; font: inherit; font-size: 13px; cursor: pointer; text-align: left;
}
.ddz-more-row:hover { background: rgba(75, 163, 227, .14); }
.ddz-more-row svg { flex: 0 0 16px; }

@media (prefers-reduced-motion: reduce) {
  .ddz-root *,
  .ddz-root *::before,
  .ddz-root *::after {
    animation: none !important;
    transition: none !important;
  }
  .ddz-pass { opacity: 1; }
}

@media (max-width: 900px) {
  .ddz-bottom { grid-template-columns: 1fr; align-items: stretch; }
  .ddz-counter { order: 2; }
  .ddz-hand { min-height: 84px; padding-top: 16px; }
  .ddz-card { width: 40px; height: 58px; flex-basis: 40px; margin-left: -16px; border-radius: 12px; }
  .ddz-seatrow { padding: 8px 10px; }
  .ddz-seat { min-width: 0; padding: 8px 10px; }
  .ddz-seat .sub2 { display: none; }
  .ddz-avatar { width: 44px; height: 44px; flex-basis: 44px; }
  .ddz-seat.seat-0 .ddz-avatar { width: 50px; height: 50px; flex-basis: 50px; }
  .ddz-watermark { width: 180px; height: 180px; }
  .ddz-actions .ddz-btn.primary { width: 100%; }
  .ddz-setup { padding: 18px 14px 30px; }
  .ddz-tiers { grid-template-columns: 1fr; }
  .ddz-hero-avatar { width: 56px; height: 56px; flex-basis: 56px; }
}
`
