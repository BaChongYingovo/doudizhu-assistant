/* 斗地主插件样式：DSH 深色玻璃风，自动跟随系统深浅色 */
const CSS = String.raw`
.ddz-root {
  --ddz-bg: #0f1116;
  --ddz-panel: rgba(24, 27, 34, 0.72);
  --ddz-panel-solid: #191c23;
  --ddz-line: rgba(255, 255, 255, 0.09);
  --ddz-line-strong: rgba(255, 255, 255, 0.18);
  --ddz-text: #e8ecf3;
  --ddz-dim: #98a2b3;
  --ddz-accent: #6ea8fe;
  --ddz-accent-weak: rgba(110, 168, 254, 0.16);
  --ddz-good: #4ade80;
  --ddz-bad: #fb7185;
  --ddz-gold: #f5c451;
  --ddz-felt: radial-gradient(120% 90% at 50% -10%, #1d2430 0%, #13161c 55%, #0d0f14 100%);
  --ddz-card-bg: linear-gradient(180deg, #fbfcfe 0%, #e9edf4 100%);
  --ddz-card-ink: #15181e;
  --ddz-red: #d0283c;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--ddz-text);
  background: var(--ddz-felt);
  font: 13px/1.45 "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: light) {
  .ddz-root {
    --ddz-bg: #f4f5f8;
    --ddz-panel: rgba(255, 255, 255, 0.78);
    --ddz-panel-solid: #ffffff;
    --ddz-line: rgba(15, 20, 30, 0.1);
    --ddz-line-strong: rgba(15, 20, 30, 0.2);
    --ddz-text: #1a1f2a;
    --ddz-dim: #5d6779;
    --ddz-accent: #2f6fdd;
    --ddz-accent-weak: rgba(47, 111, 221, 0.12);
    --ddz-felt: radial-gradient(120% 90% at 50% -10%, #e7ebf3 0%, #eef0f5 55%, #f6f7fa 100%);
    --ddz-card-bg: linear-gradient(180deg, #ffffff 0%, #eef1f7 100%);
    --ddz-card-ink: #15181e;
    --ddz-red: #c31f34;
  }
}
.ddz-root * { box-sizing: border-box; }
.ddz-scroll { overflow: auto; min-height: 0; }

/* ---------- 顶栏 ---------- */
.ddz-topbar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--ddz-line);
  background: linear-gradient(180deg, rgba(255,255,255,0.03), transparent);
}
.ddz-title { font-size: 14px; font-weight: 650; letter-spacing: .3px; }
.ddz-title small { color: var(--ddz-dim); font-weight: 450; margin-left: 8px; }
.ddz-topbar .ddz-spacer { flex: 1; }
.ddz-chipbtn {
  height: 26px; padding: 0 10px; border-radius: 7px;
  border: 1px solid var(--ddz-line); background: var(--ddz-panel);
  color: var(--ddz-text); font-size: 12px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
}
.ddz-chipbtn:hover { border-color: var(--ddz-line-strong); }
.ddz-chipbtn.is-on { background: var(--ddz-accent-weak); border-color: var(--ddz-accent); color: var(--ddz-accent); }

/* ---------- 按钮 / 分段 ---------- */
.ddz-btn {
  height: 34px; padding: 0 16px; border-radius: 9px; cursor: pointer;
  border: 1px solid var(--ddz-line-strong); background: var(--ddz-panel);
  color: var(--ddz-text); font-size: 13px; font-weight: 550;
  transition: transform .06s ease, background .15s ease, border-color .15s ease;
}
.ddz-btn:hover { border-color: var(--ddz-accent); }
.ddz-btn:active { transform: translateY(1px); }
.ddz-btn.primary { background: linear-gradient(180deg, #3f7fe0, #2f63c4); border-color: #2f63c4; color: #fff; }
.ddz-btn.primary:hover { background: linear-gradient(180deg, #4b8bf0, #3670d6); }
.ddz-btn.ghost { background: transparent; }
.ddz-btn.danger { color: var(--ddz-bad); border-color: rgba(251,113,133,.4); }
.ddz-btn[disabled] { opacity: .45; cursor: default; }
.ddz-seg { display: inline-flex; padding: 2px; gap: 2px; border-radius: 9px; border: 1px solid var(--ddz-line); background: rgba(0,0,0,.18); }
.ddz-seg button {
  height: 28px; padding: 0 12px; border-radius: 7px; border: 0; background: transparent;
  color: var(--ddz-dim); font-size: 12px; cursor: pointer;
}
.ddz-seg button.is-on { background: var(--ddz-accent-weak); color: var(--ddz-accent); font-weight: 600; }

/* ---------- 开局页 ---------- */
.ddz-setup { max-width: 720px; margin: 0 auto; padding: 28px 22px 40px; width: 100%; }
.ddz-setup h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: .5px; }
.ddz-setup .sub { color: var(--ddz-dim); margin-bottom: 26px; }
.ddz-field { margin-bottom: 20px; }
.ddz-field > label { display: block; color: var(--ddz-dim); font-size: 12px; margin-bottom: 8px; }
.ddz-tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.ddz-tiercard { padding: 12px; border: 1px solid var(--ddz-line); border-radius: 11px; background: var(--ddz-panel); }
.ddz-tiercard b { display: block; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
.ddz-tiercard select {
  width: 100%; height: 30px; border-radius: 7px; border: 1px solid var(--ddz-line-strong);
  background: var(--ddz-panel-solid); color: var(--ddz-text); font-size: 12px; padding: 0 8px;
}
.ddz-modecard { display: flex; gap: 8px; }
.ddz-modecard button {
  flex: 1; text-align: left; padding: 11px 12px; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--ddz-line); background: var(--ddz-panel); color: var(--ddz-text);
}
.ddz-modecard button.is-on { border-color: var(--ddz-accent); background: var(--ddz-accent-weak); }
.ddz-modecard b { display: block; font-size: 13px; margin-bottom: 3px; }
.ddz-modecard span { color: var(--ddz-dim); font-size: 11.5px; }
.ddz-setup-actions { display: flex; align-items: center; gap: 12px; margin-top: 26px; }
.ddz-kbi { color: var(--ddz-dim); font-size: 11.5px; }
.ddz-statsline { color: var(--ddz-dim); font-size: 12px; margin-top: 18px; }

/* ---------- 牌桌 ---------- */
.ddz-table { position: relative; flex: 1; min-height: 0; display: grid; grid-template-rows: auto 1fr auto; }
.ddz-seatrow { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 12px 16px; }
.ddz-seat {
  min-width: 132px; padding: 9px 12px; border-radius: 12px;
  border: 1px solid var(--ddz-line); background: var(--ddz-panel); backdrop-filter: blur(8px);
  display: flex; align-items: center; gap: 10px; transition: border-color .2s, box-shadow .2s;
}
.ddz-seat.is-turn { border-color: var(--ddz-accent); box-shadow: 0 0 0 1px var(--ddz-accent), 0 6px 22px rgba(110,168,254,.18); }
.ddz-seat.is-me { border-color: var(--ddz-line-strong); }
.ddz-avatar {
  width: 34px; height: 34px; border-radius: 50%; flex: 0 0 34px;
  display: grid; place-items: center; font-size: 12px; font-weight: 700;
  background: linear-gradient(160deg, #39404f, #232833); color: #cfd7e6; position: relative;
}
.ddz-avatar.landlord { background: linear-gradient(160deg, #6b4c12, #3a2a08); color: var(--ddz-gold); }
.ddz-avatar .crown { position: absolute; top: -8px; font-size: 12px; }
.ddz-seat .meta { min-width: 0; }
.ddz-seat .name { font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.ddz-seat .sub2 { font-size: 11px; color: var(--ddz-dim); white-space: nowrap; }
.ddz-seat .sub2 em { font-style: normal; color: var(--ddz-accent); }
.ddz-ring { position: relative; width: 26px; height: 26px; flex: 0 0 26px; margin-left: auto; }
.ddz-ring span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 10.5px; color: var(--ddz-dim); }
.ddz-ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
.ddz-ring circle { fill: none; stroke-width: 2.4; }
.ddz-ring .bg { stroke: rgba(255,255,255,.1); }
.ddz-ring .fg { stroke: var(--ddz-accent); transition: stroke-dashoffset .5s linear; }

.ddz-mid { position: relative; display: grid; place-items: center; min-height: 0; }
.ddz-mid-inner { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.ddz-lastlabel { color: var(--ddz-dim); font-size: 11.5px; letter-spacing: .4px; }
.ddz-played { display: flex; gap: 4px; min-height: 64px; align-items: center; }
.ddz-turnpill {
  padding: 5px 12px; border-radius: 999px; font-size: 12px;
  background: var(--ddz-panel); border: 1px solid var(--ddz-line);
}
.ddz-turnpill.is-you { color: var(--ddz-good); border-color: rgba(74,222,128,.35); }
.ddz-think { display: inline-flex; align-items: center; gap: 7px; color: var(--ddz-dim); font-size: 12px; }
.ddz-spin { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--ddz-line-strong); border-top-color: var(--ddz-accent); animation: ddz-spin .8s linear infinite; }
@keyframes ddz-spin { to { transform: rotate(360deg); } }

/* ---------- 底部：手牌区 ---------- */
.ddz-bottom { display: grid; grid-template-columns: 210px 1fr 250px; gap: 12px; padding: 10px 16px 14px; align-items: end; }
.ddz-counterbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
  margin: 6px 16px 0; padding: 5px 8px;
  border: 1px solid var(--ddz-line); border-radius: 10px; background: var(--ddz-panel);
}
.ddz-counterbar .ct { font-size: 11px; color: var(--ddz-dim); margin-right: 4px; white-space: nowrap; }
.ddz-count {
  display: inline-flex; align-items: baseline; justify-content: center; gap: 3px;
  min-width: 32px; padding: 2px 6px; border-radius: 6px; background: rgba(255,255,255,.05);
  font-size: 12px; line-height: 1.25; color: var(--ddz-text);
}
.ddz-count b { font-size: 11px; color: var(--ddz-dim); font-weight: 500; }
.ddz-count.is-hot { background: rgba(251,113,133,.16); color: var(--ddz-bad); }
.ddz-count.is-hot b { color: var(--ddz-bad); }
.ddz-count.is-zero { opacity: .35; }

.ddz-handwrap { min-width: 0; }
.ddz-hand { display: flex; justify-content: center; align-items: flex-end; min-height: 78px; padding: 0 4px; }
.ddz-card {
  position: relative; width: 46px; height: 66px; margin-left: -14px; flex: 0 0 46px;
  border-radius: 7px; background: var(--ddz-card-bg); color: var(--ddz-card-ink);
  border: 1px solid rgba(0,0,0,.28); box-shadow: 0 3px 8px rgba(0,0,0,.35);
  cursor: pointer; user-select: none; -webkit-user-select: none; touch-action: none;
  transition: transform .12s ease, box-shadow .12s ease;
  display: flex; flex-direction: column; justify-content: space-between; padding: 4px 5px;
}
.ddz-card:first-child { margin-left: 0; }
.ddz-card:hover { transform: translateY(-4px); }
.ddz-card.is-sel { transform: translateY(-14px); box-shadow: 0 0 0 2px var(--ddz-accent), 0 8px 16px rgba(0,0,0,.45); }
.ddz-card .r { font-size: 15px; font-weight: 700; line-height: 1; letter-spacing: -.4px; }
.ddz-card .s { font-size: 15px; line-height: 1; align-self: flex-end; }
.ddz-card.is-red { color: var(--ddz-red); }
.ddz-card.joker .r { font-size: 11px; writing-mode: vertical-rl; letter-spacing: 1px; }
.ddz-card.small { width: 34px; height: 48px; flex-basis: 34px; margin-left: -12px; padding: 3px; }
.ddz-card.small .r, .ddz-card.small .s { font-size: 11px; }
.ddz-card.static { cursor: default; }
.ddz-card.static:hover { transform: none; }
.ddz-card.back {
  background: repeating-linear-gradient(135deg, #2a3550 0 6px, #223048 6px 12px);
  border-color: rgba(255,255,255,.12); color: transparent;
}
.ddz-handinfo { text-align: center; color: var(--ddz-dim); font-size: 11.5px; margin-top: 6px; min-height: 16px; }

.ddz-actions { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
.ddz-actions-row { display: flex; gap: 8px; justify-content: flex-end; }
.ddz-advice {
  border: 1px solid var(--ddz-line); border-radius: 12px; padding: 9px 11px;
  background: linear-gradient(180deg, rgba(110,168,254,.12), rgba(110,168,254,.03));
  font-size: 12px; min-height: 64px;
}
.ddz-advice .hd { display: flex; align-items: center; gap: 6px; color: var(--ddz-accent); font-size: 11px; margin-bottom: 4px; }
.ddz-advice .mv { font-weight: 600; }
.ddz-advice .rs { color: var(--ddz-dim); font-size: 11.5px; margin-top: 2px; line-height: 1.4; }
.ddz-advice .win { color: var(--ddz-good); font-size: 11px; margin-left: auto; }

/* ---------- 弹层 ---------- */
.ddz-overlay {
  position: absolute; inset: 0; z-index: 40; display: grid; place-items: center;
  background: rgba(6, 8, 12, .62); backdrop-filter: blur(3px); padding: 20px;
}
.ddz-modal {
  width: min(520px, 100%); max-height: 90%; overflow: auto;
  border: 1px solid var(--ddz-line-strong); border-radius: 16px;
  background: var(--ddz-panel-solid); box-shadow: 0 24px 70px rgba(0,0,0,.5);
  padding: 20px;
}
.ddz-modal h2 { margin: 0 0 4px; font-size: 18px; }
.ddz-modal .lead { color: var(--ddz-dim); font-size: 12px; margin-bottom: 16px; }
.ddz-result-big { font-size: 30px; font-weight: 700; margin: 6px 0 2px; }
.ddz-result-big.win { color: var(--ddz-good); }
.ddz-result-big.lose { color: var(--ddz-bad); }
.ddz-kv { display: grid; grid-template-columns: 1fr auto; gap: 6px 16px; font-size: 12.5px; margin: 14px 0; }
.ddz-kv .k { color: var(--ddz-dim); }
.ddz-kv .v { text-align: right; font-variant-numeric: tabular-nums; }
.ddz-delta { display: flex; gap: 8px; margin: 12px 0 4px; }
.ddz-delta div { flex: 1; border: 1px solid var(--ddz-line); border-radius: 9px; padding: 7px 9px; font-size: 12px; display: flex; justify-content: space-between; }
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
.ddz-replay-line b { color: var(--ddz-text); font-weight: 550; }
.ddz-toast {
  position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%);
  padding: 7px 14px; border-radius: 9px; font-size: 12px; z-index: 60;
  background: rgba(20,24,32,.92); border: 1px solid var(--ddz-line-strong); color: var(--ddz-text);
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
.ddz-more-row:hover { background: rgba(127, 160, 220, .14); }
.ddz-more-row svg { flex: 0 0 16px; }

@media (max-width: 900px) {
  .ddz-bottom { grid-template-columns: 1fr; align-items: stretch; }
  .ddz-counter { order: 2; }
  .ddz-hand { min-height: 70px; }
  .ddz-card { width: 40px; height: 58px; flex-basis: 40px; margin-left: -16px; }
  .ddz-seatrow { padding: 8px 10px; }
  .ddz-seat { min-width: 0; padding: 7px 9px; }
  .ddz-seat .sub2 { display: none; }
  .ddz-setup { padding: 18px 14px 30px; }
  .ddz-tiers { grid-template-columns: 1fr; }
}
`
