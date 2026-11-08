/* 斗地主插件样式：鲸鱼娘浅色柔和风（移植自 Kimi 原型） */
const CSS = String.raw`
/* ============================================================
   斗地主插件 · 浅色柔和可爱视觉（移植自 ui-kimi 原型）
   令牌与类名与交接文档一一对应；所有规则均限定在 .ddz-root 内，
   不引入全局重置，避免污染宿主 DSH UI。
   ============================================================ */

/* ---------- 设计令牌（浅色为默认） ---------- */
.ddz-root {
  --ddz-bg: #F5F8FC;
  --ddz-felt: radial-gradient(120% 90% at 50% 0%, #EAF4FC 0%, #F7FBFE 55%, #EEF6FB 100%);
  --ddz-panel: rgba(255, 255, 255, 0.82);
  --ddz-panel-solid: #FFFFFF;
  --ddz-line: rgba(30, 79, 156, 0.10);
  --ddz-line-strong: rgba(30, 79, 156, 0.18);
  --ddz-text: #1B2A44;
  --ddz-dim: #6B7C99;
  --ddz-accent: #4BA3E3;
  --ddz-accent-deep: #1E4F9C;
  --ddz-accent-weak: rgba(75, 163, 227, 0.14);
  --ddz-whale: #7EC8E8;
  --ddz-good: #3DBF8F;
  --ddz-bad: #F07178;
  --ddz-gold: #D4A84B;
  --ddz-card-bg: linear-gradient(165deg, #FFFFFF 0%, #F3F7FC 100%);
  --ddz-card-ink: #1B2A44;
  --ddz-red: #E25563;
  --ddz-radius-panel: 18px;
  --ddz-radius-btn: 12px;
  --ddz-radius-card: 14px;
  --ddz-shadow-soft: 0 8px 20px rgba(30, 79, 156, 0.08);
  --ddz-shadow-panel: 0 12px 32px rgba(30, 79, 156, 0.10);
  --ddz-font: "PingFang SC", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif;

  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--ddz-text);
  background: var(--ddz-bg);
  font-family: var(--ddz-font);
  font-size: 14px;
  user-select: none;
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  .ddz-root {
    --ddz-bg: #101826;
    --ddz-felt: radial-gradient(120% 90% at 50% 0%, #16233A 0%, #101826 60%, #131F33 100%);
    --ddz-panel: rgba(24, 36, 56, 0.86);
    --ddz-panel-solid: #1A2740;
    --ddz-line: rgba(126, 200, 232, 0.12);
    --ddz-line-strong: rgba(126, 200, 232, 0.22);
    --ddz-text: #E8F0FA;
    --ddz-dim: #8FA3C0;
    --ddz-accent: #5FB0EA;
    --ddz-accent-deep: #7EC8E8;
    --ddz-accent-weak: rgba(95, 176, 234, 0.16);
    --ddz-good: #4CD6A4;
    --ddz-bad: #FF8A90;
    --ddz-gold: #E5BE6B;
    --ddz-card-bg: linear-gradient(165deg, #24344F 0%, #1B2940 100%);
    --ddz-card-ink: #EAF2FB;
    --ddz-red: #F27E8A;
  }
}

/* 局部重置：只作用于插件根节点及其内部元素 */
.ddz-root,
.ddz-root * {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}
/* 原型 button 重置；:where() 归零特异性，保证 .ddz-btn / .ddz-chipbtn 等类样式仍能覆盖 */
.ddz-root :where(button) {
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
  color: inherit;
  font-size: inherit;
}
.ddz-root :focus-visible {
  outline: 2px solid var(--ddz-accent);
  outline-offset: 2px;
}

/* ---------- 屏幕切换 ---------- */
.ddz-root > .ddz-screen { position: absolute; inset: 0; display: flex; flex-direction: column; opacity: 0; pointer-events: none; transition: opacity .22s ease-out; }
.ddz-root > .ddz-screen.is-on { opacity: 1; pointer-events: auto; }

/* ---------- 通用按钮 ---------- */
.ddz-btn {
  min-height: 44px; padding: 0 20px; border-radius: var(--ddz-radius-btn);
  font-size: 14px; font-weight: 600; letter-spacing: .02em;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  transition: transform .15s ease-out, box-shadow .15s ease-out, background .15s ease-out, opacity .15s;
}
.ddz-btn:active { transform: scale(.97); }
.ddz-btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
.ddz-btn--primary {
  color: #fff;
  background: linear-gradient(150deg, var(--ddz-accent) 0%, var(--ddz-accent-deep) 100%);
  box-shadow: 0 6px 16px rgba(75, 163, 227, .35);
  min-width: 160px;
}
.ddz-btn--primary:hover:not(:disabled) { box-shadow: 0 8px 22px rgba(75, 163, 227, .45); transform: translateY(-1px); }
.ddz-btn--ghost {
  color: var(--ddz-accent-deep); background: var(--ddz-panel-solid);
  border: 1px solid var(--ddz-line-strong);
}
.ddz-btn--ghost:hover:not(:disabled) { background: var(--ddz-accent-weak); }
.ddz-btn--danger {
  color: var(--ddz-bad); background: var(--ddz-panel-solid);
  border: 1px solid rgba(240, 113, 120, .45);
}
.ddz-btn--danger:hover:not(:disabled) { background: rgba(240, 113, 120, .10); }

/* ============================================================
   开局设置页 .ddz-setup
   ============================================================ */
.ddz-setup {
  background: var(--ddz-felt);
  align-items: center; justify-content: center; padding: 24px; overflow-y: auto;
}
.ddz-setup-card {
  position: relative; width: 100%; max-width: 720px;
  background: var(--ddz-panel); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--ddz-line); border-radius: 22px;
  box-shadow: var(--ddz-shadow-panel);
  padding: 36px 40px 28px; overflow: hidden;
}
.ddz-setup-watermark {
  position: absolute; right: -40px; top: -20px; width: 300px; opacity: .14;
  pointer-events: none; transform: rotate(6deg);
}
.ddz-setup-head { position: relative; display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.ddz-setup-title { font-size: 28px; font-weight: 650; letter-spacing: .04em; display: flex; align-items: center; gap: 10px; }
.ddz-whale-mark { width: 34px; height: 34px; flex: none; }
.ddz-setup-sub { position: relative; color: var(--ddz-dim); font-size: 13px; margin-bottom: 26px; }
.ddz-setup h3 { font-size: 14px; font-weight: 600; color: var(--ddz-dim); margin: 20px 0 10px; letter-spacing: .05em; }

.ddz-modecard { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ddz-mode {
  position: relative; min-height: 72px; border-radius: var(--ddz-radius-panel);
  background: var(--ddz-panel-solid); border: 1.5px solid var(--ddz-line);
  display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 4px;
  padding: 14px 18px; text-align: left; transition: all .18s ease-out;
}
.ddz-mode b { font-size: 16px; font-weight: 650; }
.ddz-mode span { font-size: 12px; color: var(--ddz-dim); }
.ddz-mode:hover { border-color: var(--ddz-line-strong); transform: translateY(-1px); }
.ddz-mode.is-on { border-color: var(--ddz-accent); background: var(--ddz-accent-weak); box-shadow: 0 4px 14px rgba(75,163,227,.18); }

.ddz-tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.ddz-tier {
  background: var(--ddz-panel-solid); border: 1.5px solid var(--ddz-line);
  border-radius: var(--ddz-radius-panel); padding: 14px 14px 12px;
  display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all .18s ease-out;
}
.ddz-tier.is-on { border-color: var(--ddz-accent); box-shadow: 0 4px 14px rgba(75,163,227,.16); }
.ddz-tier .ddz-avatar { width: 40px; height: 40px; }
.ddz-tier-name { font-size: 13px; font-weight: 600; }
.ddz-tier select {
  width: 100%; height: 36px; border-radius: 10px; font-size: 13px;
  border: 1px solid var(--ddz-line-strong); background: var(--ddz-bg); color: var(--ddz-text);
  padding: 0 8px; font-family: inherit;
}

.ddz-setup-actions { position: relative; display: flex; gap: 12px; margin-top: 28px; }
.ddz-statsline {
  position: relative; margin-top: 20px; padding-top: 14px;
  border-top: 1px solid var(--ddz-line);
  font-size: 12px; color: var(--ddz-dim); display: flex; gap: 18px; flex-wrap: wrap;
}
.ddz-statsline b.win { color: var(--ddz-good); font-weight: 650; }
.ddz-statsline b.lose { color: var(--ddz-bad); font-weight: 650; }

/* ---------- 头像 ---------- */
.ddz-avatar {
  width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex: none;
  border: 2px solid #fff; box-shadow: 0 0 0 2px rgba(126, 200, 232, .45), 0 4px 10px rgba(30,79,156,.15);
  background: var(--ddz-panel-solid);
  display: block; overflow: hidden;
}
.ddz-avatar--lg { width: 48px; height: 48px; }
.ddz-crown {
  position: absolute; top: -12px; right: -8px; width: 24px; height: 24px;
  filter: drop-shadow(0 2px 4px rgba(212, 168, 75, .5));
}

/* ============================================================
   牌桌页
   ============================================================ */
.ddz-table { background: var(--ddz-felt); }

.ddz-topbar {
  height: 48px; flex: none; display: flex; align-items: center; gap: 12px;
  padding: 0 16px; background: var(--ddz-panel); backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--ddz-line); z-index: 30;
}
.ddz-title { display: flex; align-items: baseline; gap: 10px; margin-right: auto; }
.ddz-title b { font-size: 17px; font-weight: 650; letter-spacing: .05em; }
.ddz-title small { font-size: 12px; color: var(--ddz-dim); }
.ddz-chips { display: flex; gap: 8px; align-items: center; }
.ddz-chipbtn {
  height: 30px; padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 600;
  background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line-strong);
  color: var(--ddz-dim); display: inline-flex; align-items: center; gap: 5px;
  transition: all .15s ease-out; white-space: nowrap;
}
.ddz-chipbtn:hover { color: var(--ddz-accent-deep); border-color: var(--ddz-accent); }
.ddz-chipbtn.is-on { background: var(--ddz-accent-weak); color: var(--ddz-accent-deep); border-color: var(--ddz-accent); }
.ddz-chipbtn svg { width: 14px; height: 14px; }

/* 记牌器 */
.ddz-counterbar {
  flex: none; overflow: hidden; max-height: 0; transition: max-height .25s ease-out;
  border-bottom: 1px solid transparent;
}
.ddz-counterbar.is-open { max-height: 96px; border-bottom-color: var(--ddz-line); }
.ddz-counterbar-in { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px; }
.ddz-count {
  min-width: 44px; padding: 5px 8px; border-radius: 10px; text-align: center;
  background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line);
  font-size: 12px; line-height: 1.35; transition: all .15s;
}
.ddz-count b { display: block; font-size: 13px; }
.ddz-count .cnt { color: var(--ddz-dim); font-size: 11px; }
.ddz-count.is-hot { border-color: var(--ddz-gold); box-shadow: 0 0 0 1px var(--ddz-gold), 0 2px 8px rgba(212,168,75,.25); }
.ddz-count.is-zero { opacity: .35; }

/* 底牌 + 倍率信息条 */
.ddz-statusbar {
  flex: none; display: flex; align-items: center; justify-content: center; gap: 22px;
  padding: 10px 20px 0; flex-wrap: wrap;
}
.ddz-bottomcards { display: flex; align-items: center; gap: 8px; }
.ddz-root #bottom-cards { display: flex; gap: 6px; }
.ddz-bottomcards .lbl { font-size: 12px; color: var(--ddz-dim); margin-right: 2px; }
.ddz-bottomcards .ddz-card { width: 40px; height: 56px; border-radius: 10px; padding: 4px 5px; }
.ddz-bottomcards .ddz-card .rk { font-size: 14px; }
.ddz-bottomcards .ddz-card .st { font-size: 11px; }
.ddz-bottomcards .ddz-card--joker .rk { font-size: 9px; }
.ddz-mult {
  display: flex; align-items: baseline; gap: 6px;
  background: linear-gradient(135deg, rgba(229,190,107,.22), rgba(212,168,75,.10));
  border: 1px solid rgba(212,168,75,.45); border-radius: 12px; padding: 6px 14px;
}
.ddz-mult .x { font-size: 20px; font-weight: 800; color: var(--ddz-gold); letter-spacing: .02em; }
.ddz-mult .t { font-size: 11px; color: var(--ddz-dim); }
.ddz-statuschips { display: flex; gap: 6px; flex-wrap: wrap; }
.ddz-statuschip {
  font-size: 11px; color: var(--ddz-dim); background: var(--ddz-panel-solid);
  border: 1px solid var(--ddz-line); border-radius: 999px; padding: 4px 10px; white-space: nowrap;
}
.ddz-statuschip b { color: var(--ddz-text); }
.ddz-statuschip.bomb b { color: var(--ddz-bad); }

/* 座位行 */
.ddz-seatrow { flex: none; display: flex; align-items: flex-start; justify-content: space-between; padding: 14px 20px 0; }
.ddz-seat {
  position: relative; display: flex; align-items: center; gap: 10px;
  background: var(--ddz-panel); backdrop-filter: blur(10px);
  border: 1.5px solid var(--ddz-line); border-radius: 16px;
  padding: 8px 14px 8px 8px; box-shadow: var(--ddz-shadow-soft);
  transition: border-color .2s, box-shadow .2s; max-width: 220px;
}
.ddz-seat.is-turn { border-color: var(--ddz-accent); animation: ddz-breathe 2s ease-in-out infinite; }
@keyframes ddz-breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(75,163,227,.35), var(--ddz-shadow-soft); }
  50% { box-shadow: 0 0 0 6px rgba(75,163,227,0), var(--ddz-shadow-soft); }
}
.ddz-seat-av { position: relative; flex: none; }
.ddz-seat-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ddz-seat-name { font-size: 13px; font-weight: 650; display: flex; align-items: center; gap: 6px; }
.ddz-seat-sub { font-size: 11px; color: var(--ddz-dim); }
.ddz-tags { display: flex; gap: 4px; }
.ddz-landlord-tag {
  font-size: 10px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #E5BE6B, var(--ddz-gold));
  padding: 1px 7px; border-radius: 999px;
}
.ddz-open-tag { font-size: 10px; font-weight: 600; color: #fff; background: var(--ddz-whale); padding: 1px 7px; border-radius: 999px; }
.ddz-pass-tag {
  position: absolute; right: -14px; top: -12px; font-size: 12px; font-weight: 700;
  color: var(--ddz-dim); background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line-strong);
  padding: 3px 9px; border-radius: 999px; transform: rotate(-6deg);
  animation: ddz-pass-pop .18s ease-out;
}
@keyframes ddz-pass-pop { from { opacity: 0; transform: rotate(-6deg) scale(.8); } to { opacity: 1; transform: rotate(-6deg) scale(1); } }
.ddz-turnpill {
  align-self: center; background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line);
  border-radius: 999px; padding: 7px 18px; font-size: 13px; font-weight: 600; color: var(--ddz-dim);
  box-shadow: var(--ddz-shadow-soft); white-space: nowrap;
}
.ddz-turnpill b { color: var(--ddz-text); }

/* 中央 */
.ddz-mid { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 8px 16px; position: relative; }
.ddz-mid::before {
  content: ''; position: absolute; left: 50%; top: 50%; width: min(720px, 88%); height: 88%;
  transform: translate(-50%,-50%); border-radius: 50%;
  border: 1.5px solid rgba(75,163,227,.16);
  background: radial-gradient(closest-side, rgba(255,255,255,.5), rgba(255,255,255,0) 78%);
  box-shadow: inset 0 0 60px rgba(126,200,232,.10);
  pointer-events: none;
}
.ddz-mid-whale {
  position: absolute; left: 50%; top: 50%; width: 150px; height: 150px;
  transform: translate(-50%,-50%); opacity: .055; pointer-events: none;
}
.ddz-mid-grid {
  position: relative; display: grid; grid-template-columns: 1fr auto 1fr;
  align-items: center; gap: 24px; width: 100%; max-width: 900px;
}
.ddz-mid-center { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.ddz-sideplay { display: flex; flex-direction: column; align-items: center; gap: 8px; min-height: 96px; justify-content: center; }
.ddz-sideplay .who { font-size: 12px; color: var(--ddz-dim); }
.ddz-sideplay .ddz-played { min-height: 0; }
.ddz-sideplay .ddz-played .ddz-card { animation: none; }
.ddz-sidepass {
  font-size: 14px; font-weight: 700; color: var(--ddz-dim);
  background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line-strong);
  border-radius: 999px; padding: 6px 16px; transform: rotate(-5deg);
  box-shadow: var(--ddz-shadow-soft); animation: ddz-pass-pop .18s ease-out;
}
.ddz-lastlabel { font-size: 12px; color: var(--ddz-dim); letter-spacing: .04em; }
.ddz-played { display: flex; min-height: 84px; align-items: center; }
.ddz-played .ddz-card { margin-left: -18px; animation: ddz-fly-in .22s ease-out backwards; }
.ddz-played .ddz-card:first-child { margin-left: 0; }
.ddz-played .ddz-card:nth-child(1) { animation-delay: .00s; }
.ddz-played .ddz-card:nth-child(2) { animation-delay: .05s; }
.ddz-played .ddz-card:nth-child(3) { animation-delay: .10s; }
.ddz-played .ddz-card:nth-child(4) { animation-delay: .15s; }
.ddz-played .ddz-card:nth-child(5) { animation-delay: .20s; }
.ddz-played .ddz-card:nth-child(6) { animation-delay: .25s; }
@keyframes ddz-fly-in { from { opacity: 0; transform: translateY(26px) scale(.92); } to { opacity: 1; transform: translateY(0) scale(1); } }
.ddz-played.is-bomb .ddz-card { animation: ddz-bomb .32s ease-out; }
@keyframes ddz-bomb {
  0% { transform: scale(1); filter: brightness(1); }
  40% { transform: scale(1.06); filter: brightness(1.35) drop-shadow(0 0 10px rgba(212,168,75,.8)); }
  100% { transform: scale(1); filter: brightness(1); }
}
.ddz-think { display: flex; align-items: center; gap: 8px; color: var(--ddz-dim); font-size: 13px; }
.ddz-spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--ddz-accent-weak); border-top-color: var(--ddz-accent); animation: ddz-spin .8s linear infinite; }
@keyframes ddz-spin { to { transform: rotate(360deg); } }
.ddz-mid-empty { color: var(--ddz-dim); font-size: 13px; }

/* 手牌 */
.ddz-handwrap { flex: none; padding: 12px 0 4px; }
.ddz-hand { display: flex; justify-content: center; align-items: flex-end; min-height: 136px; padding: 0 12px; }
.ddz-hand .ddz-card { margin-left: -36px; transition: transform .15s ease-out, box-shadow .15s ease-out; }
.ddz-hand .ddz-card:first-child { margin-left: 0; }
.ddz-hand .ddz-card:hover { transform: translateY(-10px); }
.ddz-hand .ddz-card.is-sel { transform: translateY(-18px); box-shadow: 0 0 0 2px var(--ddz-accent), 0 14px 22px rgba(75,163,227,.30); }
.ddz-hand.is-disabled { opacity: .5; pointer-events: none; }

/* 扑克牌面 */
.ddz-card {
  width: 80px; height: 112px; border-radius: var(--ddz-radius-card);
  background: var(--ddz-card-bg); border: 1px solid var(--ddz-line);
  box-shadow: 0 6px 14px rgba(30,79,156,.15), inset 0 1px 0 rgba(255,255,255,.7);
  display: flex; flex-direction: column; justify-content: space-between; padding: 8px 10px;
  font-weight: 700; position: relative; flex: none;
}
@media (prefers-color-scheme: dark) { .ddz-card { box-shadow: 0 3px 8px rgba(0,0,0,.35); } }
.ddz-card .rk { font-size: 25px; line-height: 1.1; }
.ddz-card .st { font-size: 20px; line-height: 1; }
.ddz-card .rk.red, .ddz-card .st.red { color: var(--ddz-red); }
.ddz-card .rk.ink, .ddz-card .st.ink { color: var(--ddz-card-ink); }
.ddz-card--small { width: 56px; height: 80px; border-radius: 12px; padding: 6px 7px; }
.ddz-card--small .rk { font-size: 19px; }
.ddz-card--small .st { font-size: 14px; }
.ddz-card--joker .rk { font-size: 15px; letter-spacing: 0; }
.ddz-card--joker.ddz-card--small .rk { font-size: 11px; }

/* 牌背 */
.ddz-back {
  width: 34px; height: 48px; border-radius: 9px; flex: none;
  background: linear-gradient(150deg, #8FCEF0 0%, var(--ddz-accent) 60%, var(--ddz-accent-deep) 130%);
  border: 2px solid #fff; box-shadow: 0 3px 8px rgba(30,79,156,.18);
  position: relative; overflow: hidden;
}
.ddz-back::before {
  content: ''; position: absolute; inset: 3px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.55);
  background: repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 4px, transparent 4px 8px);
}
.ddz-back::after {
  content: ''; position: absolute; left: 50%; top: 50%; width: 14px; height: 10px;
  transform: translate(-50%,-50%); border-radius: 50% 50% 45% 45%;
  background: rgba(255,255,255,.85);
  clip-path: polygon(0 40%, 15% 0, 45% 20%, 60% 0, 75% 35%, 100% 20%, 85% 70%, 60% 100%, 25% 90%);
}
.ddz-cardstack { position: relative; width: 44px; height: 52px; flex: none; }
.ddz-cardstack .ddz-back { position: absolute; width: 30px; height: 42px; }
.ddz-cardstack .ddz-back:nth-child(1) { left: 0; top: 6px; transform: rotate(-8deg); opacity: .75; }
.ddz-cardstack .ddz-back:nth-child(2) { left: 7px; top: 3px; transform: rotate(-2deg); opacity: .9; }
.ddz-cardstack .ddz-back:nth-child(3) { left: 14px; top: 0; transform: rotate(5deg); }
.ddz-cardstack .n {
  position: absolute; right: -8px; bottom: -4px; z-index: 2;
  background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line-strong);
  color: var(--ddz-accent-deep); font-size: 11px; font-weight: 700;
  border-radius: 999px; padding: 1px 7px; box-shadow: var(--ddz-shadow-soft);
}

/* 底部信息 + 操作 */
.ddz-bottom { flex: none; padding: 4px 16px calc(12px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 10px; }
.ddz-myseat { display: flex; align-items: center; justify-content: center; gap: 10px; }
.ddz-myseat .ddz-seat { padding: 6px 16px 6px 6px; }
.ddz-ring { position: absolute; inset: -5px; width: calc(100% + 10px); height: calc(100% + 10px); pointer-events: none; }
.ddz-ring circle { fill: none; stroke: var(--ddz-accent); stroke-width: 3; stroke-linecap: round; transform: rotate(-90deg); transform-origin: center; transition: stroke-dashoffset 1s linear, stroke .2s; }
.ddz-ring circle.hot { stroke: var(--ddz-bad); }
.ddz-info { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--ddz-dim); padding: 0 8px; min-height: 18px; }
.ddz-info .sel-n { color: var(--ddz-accent-deep); font-weight: 600; }
.ddz-actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
.ddz-actions .ddz-btn { min-height: 40px; padding: 0 18px; font-size: 13px; min-width: 0; }

/* 建议卡 */
.ddz-advice {
  position: absolute; right: 18px; bottom: 130px; width: 250px;
  background: var(--ddz-panel-solid); border: 1px solid var(--ddz-line);
  border-radius: 16px; box-shadow: var(--ddz-shadow-panel); padding: 14px 16px; z-index: 25;
  animation: ddz-advice-in .2s ease-out;
}
@keyframes ddz-advice-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.ddz-advice-head { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 650; margin-bottom: 8px; }
.ddz-advice-head svg { width: 18px; height: 18px; }
.ddz-advice-move { font-size: 14px; font-weight: 650; color: var(--ddz-accent-deep); margin-bottom: 4px; }
.ddz-advice-why { font-size: 12px; color: var(--ddz-dim); line-height: 1.5; margin-bottom: 8px; }
.ddz-advice-rate { font-size: 12px; color: var(--ddz-good); font-weight: 600; margin-bottom: 10px; }
.ddz-advice .ddz-btn { width: 100%; min-height: 36px; font-size: 13px; }

/* ============================================================
   弹层
   ============================================================ */
.ddz-overlay {
  position: absolute; inset: 0; background: rgba(27, 42, 68, .28);
  display: flex; align-items: center; justify-content: center; z-index: 50;
  opacity: 0; pointer-events: none; transition: opacity .2s ease-out; padding: 20px;
}
.ddz-overlay.is-on { opacity: 1; pointer-events: auto; }
.ddz-dialog {
  width: 100%; max-width: 460px; background: var(--ddz-panel-solid);
  border-radius: 20px; box-shadow: 0 24px 60px rgba(30,79,156,.25);
  padding: 26px 26px 22px; position: relative; overflow: hidden;
  transform: scale(.95); transition: transform .2s ease-out;
}
.ddz-overlay.is-on .ddz-dialog { transform: scale(1); }
.ddz-dialog-strip { position: absolute; inset: 0 0 auto 0; height: 5px; }
.ddz-dialog-strip.win { background: linear-gradient(90deg, rgba(61,191,143,.7), rgba(61,191,143,.15)); }
.ddz-dialog-strip.lose { background: linear-gradient(90deg, rgba(240,113,120,.6), rgba(240,113,120,.12)); }
.ddz-dialog-strip.info { background: linear-gradient(90deg, var(--ddz-accent), rgba(75,163,227,.15)); }
.ddz-dialog h2 { font-size: 20px; font-weight: 650; margin-bottom: 6px; }
.ddz-dialog h2.win { color: var(--ddz-good); }
.ddz-dialog h2.lose { color: var(--ddz-bad); }
.ddz-dialog p.sub { font-size: 13px; color: var(--ddz-dim); margin-bottom: 16px; line-height: 1.5; }
.ddz-bid-opts { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
.ddz-bid-opts .ddz-btn { flex: 1; min-width: 84px; }
.ddz-props { margin-bottom: 16px; }
.ddz-props-row { display: flex; justify-content: space-between; font-size: 13px; padding: 7px 2px; border-bottom: 1px solid var(--ddz-line); }
.ddz-props-row:last-child { border-bottom: none; }
.ddz-props-row .k { color: var(--ddz-dim); }
.ddz-props-row .v { font-weight: 600; }
.ddz-props-row .v.gold { color: var(--ddz-gold); }
.ddz-score-row { display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-bottom: 1px solid var(--ddz-line); }
.ddz-score-row:last-child { border-bottom: none; }
.ddz-score-row .nm { font-size: 13px; font-weight: 600; flex: 1; }
.ddz-score-row .sc { font-size: 15px; font-weight: 700; }
.ddz-score-row .sc.plus { color: var(--ddz-good); }
.ddz-score-row .sc.minus { color: var(--ddz-bad); }
.ddz-score-row .ddz-seat-av { position: relative; }
.ddz-dialog-actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
.ddz-dialog-actions .ddz-btn { flex: 1; min-width: 110px; }
.ddz-dialog .dim-note { font-size: 12px; color: var(--ddz-dim); text-align: center; margin-top: 12px; }

/* toast */
.ddz-toast {
  position: absolute; right: 18px; bottom: 24px; z-index: 80;
  background: var(--ddz-panel-solid); color: var(--ddz-text);
  border: 1px solid var(--ddz-line-strong); border-left: 3px solid var(--ddz-accent);
  border-radius: 12px; padding: 11px 16px; font-size: 13px; box-shadow: var(--ddz-shadow-panel);
  animation: ddz-toast-in .18s ease-out; max-width: 300px;
}
.ddz-toast.bad { border-left-color: var(--ddz-bad); }

/* 复盘步骤 */
.ddz-replay-step { background: var(--ddz-accent-weak); border-radius: 12px; padding: 12px 14px; font-size: 13px; margin-bottom: 12px; min-height: 64px; line-height: 1.6; }
.ddz-replay-step b { color: var(--ddz-accent-deep); }

/* 帮助弹层 */
.ddz-help-list { font-size: 13px; line-height: 1.8; color: var(--ddz-text); }
.ddz-help-list li { margin-left: 18px; margin-bottom: 4px; }
.ddz-help-list kbd { background: var(--ddz-accent-weak); border-radius: 6px; padding: 1px 7px; font-size: 12px; font-family: inherit; }

@media (max-width: 720px) {
  .ddz-topbar { height: auto; min-height: 48px; flex-wrap: wrap; padding: 6px 12px; row-gap: 4px; }
  .ddz-chips { overflow-x: auto; max-width: 100%; scrollbar-width: none; }
  .ddz-chips::-webkit-scrollbar { display: none; }
  .ddz-toast { top: 104px; bottom: auto; right: 12px; }
  .ddz-tiers { grid-template-columns: 1fr; }
  .ddz-tiers .ddz-tier { flex-direction: row; justify-content: flex-start; }
  .ddz-tiers .ddz-tier select { max-width: 180px; }
  .ddz-setup-card { padding: 26px 22px 22px; }
  .ddz-title small { display: none; }
  .ddz-seat { max-width: 46vw; }
  .ddz-seat-sub { display: none; }
  .ddz-advice { right: 12px; left: 12px; width: auto; bottom: 150px; }
  .ddz-card { width: 56px; height: 80px; padding: 5px 6px; border-radius: 11px; }
  .ddz-card .rk { font-size: 18px; }
  .ddz-card .st { font-size: 13px; }
  .ddz-card--joker .rk { font-size: 11px; }
  .ddz-card--small { width: 44px; height: 62px; padding: 4px 5px; }
  .ddz-card--small .rk { font-size: 15px; }
  .ddz-card--small .st { font-size: 11px; }
  .ddz-card--joker.ddz-card--small .rk { font-size: 9px; }
  .ddz-hand { min-height: 96px; }
  .ddz-hand .ddz-card { margin-left: -38px; }
  .ddz-hand .ddz-card.is-sel { transform: translateY(-12px); }
  .ddz-statusbar { gap: 10px; padding: 8px 12px 0; }
  .ddz-mult .x { font-size: 16px; }
  .ddz-mid-grid { grid-template-columns: 1fr auto 1fr; gap: 8px; }
  .ddz-sideplay .ddz-played .ddz-card { margin-left: -26px; }
  .ddz-mid::before { width: 96%; height: 92%; }
  .ddz-seatrow { flex-wrap: wrap; row-gap: 8px; padding: 10px 14px 0; }
  .ddz-turnpill { order: -1; width: 100%; text-align: center; padding: 5px 12px; font-size: 12px; }
  .ddz-seat { gap: 6px; max-width: 47vw; }
  .ddz-seat-name { font-size: 12px; }
  .ddz-cardstack { width: 36px; height: 46px; }
  .ddz-cardstack .ddz-back { width: 24px; height: 34px; }
  .ddz-chipbtn .lbl { display: none; }
  .ddz-chipbtn { padding: 0 9px; }
}
@media (prefers-reduced-motion: reduce) {
  .ddz-root .ddz-played .ddz-card, .ddz-root .ddz-seat.is-turn, .ddz-root .ddz-pass-tag { animation: none !important; }
  .ddz-root, .ddz-root * { transition-duration: .01ms !important; }
}
/* 「更多」菜单里的一行（宿主菜单区域内，样式保持克制） */
.ddz-more-row {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 6px 10px; border-radius: 8px;
  font-size: 13px; color: inherit; cursor: pointer;
  background: none; border: none; font-family: inherit;
}
.ddz-more-row:hover { background: rgba(127, 127, 127, .12); }
.ddz-btn.is-on { border-color: var(--ddz-accent); background: var(--ddz-accent-weak); color: var(--ddz-accent-deep); }
`
