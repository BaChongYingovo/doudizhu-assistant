'use strict';
// 在 Node 里跑打包后的页面：真实事件委托 + 真实 app.js 状态机
const { load } = require('./uihost');
const host = load();
const { doc } = host;

const $ = (id) => doc.getElementById(id);
const Q = (s) => doc.querySelector(s);
const ALL = (s) => doc.querySelectorAll(s);
const txt = (id) => { const e = $(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : '<missing ' + id + '>'; };
const res = [];
function ok(name, cond, extra) {
  res.push((cond ? 'PASS ' : 'FAIL ') + name + (extra != null ? ' | ' + String(extra).slice(0, 90) : ''));
}
function click(sel) {
  const e = Q(sel);
  if (!e) { ok('selector ' + sel, false); return false; }
  e.click();
  return true;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try {
    /* ---------- 开局页 ---------- */
    ok('document_title', doc.title === '斗地主军师', doc.title);
    ok('setup_chips_15', ALL('#setupChips .chip').length === 15, ALL('#setupChips .chip').length);
    ok('tabs_3', ALL('#tabs button').length === 3);
    ok('setup_visible', !$('viewSetup').classList.contains('hidden'));

    for (const r of [3, 4, 5, 6]) for (let k = 0; k < 4; k++) click('#setupChips .chip[data-r="' + r + '"]');
    click('#setupChips .chip[data-r="7"]');
    ok('pick_before_lord', txt('pickInfo') === '17/20', txt('pickInfo'));

    click('#lordSeg button[data-v="1"]');
    ok('pick_17', txt('pickInfo') === '17/17', txt('pickInfo'));
    ok('landlord_hint', txt('lordHint').indexOf('17 张') >= 0, txt('lordHint'));

    /* ---------- 开局 ---------- */
    click('#startBtn');
    ok('game_visible', !$('viewGame').classList.contains('hidden'));
    ok('setup_hidden', $('viewSetup').classList.contains('hidden'));
    ok('advice_waits_xiajia', txt('advice').indexOf('等 下家') >= 0, txt('advice'));
    ok('turn_is_xiajia', txt('turnInfo') === '轮到 下家', txt('turnInfo'));
    ok('seats_shows_lord', txt('seats').indexOf('地主') >= 0, txt('seats'));
    ok('chip_remaining_zero', Q('#playChips .chip[data-r="3"] .n').textContent.trim() === '剩 0',
      Q('#playChips .chip[data-r="3"] .n').textContent);

    /* ---------- 记一笔：下家出 8 ---------- */
    click('#playChips .chip[data-r="8"]');
    ok('sel_one', txt('selInfo').indexOf('已选 1 张') >= 0, txt('selInfo'));
    click('#playBtn');
    ok('turn_shangjia', txt('turnInfo') === '轮到 上家', txt('turnInfo'));
    ok('seat_down_to_19', txt('seats').indexOf('下家19 张') >= 0, txt('seats'));
    ok('last_play_text', txt('lastPlay').indexOf('单张 8') >= 0, txt('lastPlay'));

    /* ---------- 上家过 ---------- */
    click('#passBtn');
    ok('turn_me', txt('turnInfo') === '轮到 我', txt('turnInfo'));
    ok('advice_pass', txt('advice').indexOf('建议：过') >= 0, txt('advice'));
    ok('pass_btn_enabled', !$('passBtn').disabled);

    /* ---------- 非法：7 压不过 8 ---------- */
    click('#playChips .chip[data-r="7"]');
    click('#playBtn');
    ok('reject_cannot_beat', txt('toast').indexOf('压不过') >= 0, txt('toast') + ' / turn=' + txt('turnInfo'));
    ok('turn_unchanged', txt('turnInfo') === '轮到 我', txt('turnInfo'));
    click('#playChips .chip[data-r="7"]'); // 清掉选择（cap=1）

    /* ---------- 记录过牌 → 这轮结束 ---------- */
    click('#advice [data-act="pass"]');
    ok('trick_closed', txt('lastPlay').indexOf('桌上没牌') >= 0, txt('lastPlay'));
    ok('back_to_leader', txt('turnInfo') === '轮到 下家', txt('turnInfo'));

    /* ---------- 撤销 ---------- */
    click('#undoBtn');
    ok('undo_1', txt('turnInfo') === '轮到 我', txt('turnInfo'));
    click('#undoBtn');
    click('#undoBtn');
    ok('undo_3', txt('turnInfo') === '轮到 下家' && txt('lastPlay').indexOf('桌上没牌') >= 0,
      txt('turnInfo') + ' | ' + txt('lastPlay'));
    ok('undo_cleared_hand', txt('seats').indexOf('16') < 0, txt('seats'));

    /* ---------- 下家出 3 → 上家过 → 我该用 4 压 ---------- */
    click('#playChips .chip[data-r="3"]');
    click('#playBtn');
    ok('turn_shangjia_2', txt('turnInfo') === '轮到 上家', txt('turnInfo'));
    click('#passBtn');
    ok('advice_keeps_quads', txt('advice').indexOf('建议：单张') >= 0 && txt('advice').indexOf('单张 7') >= 0, txt('advice'));
    ok('advice_has_reason', txt('advice').indexOf('压住') >= 0 || txt('advice').indexOf('领出') >= 0 || txt('advice').indexOf('必须顶') >= 0, txt('advice'));

    /* ---------- 采纳 + 出牌 ---------- */
    click('#advice [data-act="adopt"]');
    ok('adopted_one', txt('selInfo').indexOf('已选 1 张：7') >= 0, txt('selInfo'));
    click('#playBtn');
    ok('me_count_16', txt('seats').indexOf('16') >= 0, txt('seats'));
    ok('turn_after_mine', txt('turnInfo') === '轮到 下家', txt('turnInfo'));
    ok('my_hand_kept_threes', txt('myHand').indexOf('3') >= 0, txt('myHand'));
    ok('chip4_remaining_zero', Q('#playChips .chip[data-r="4"] .n').textContent.trim() === '剩 0',
      Q('#playChips .chip[data-r="4"] .n').textContent);
    ok('chip7_remaining_three', Q('#playChips .chip[data-r="7"] .n').textContent.trim() === '剩 3',
      Q('#playChips .chip[data-r="7"] .n').textContent);

    /* ---------- AI 演示 ---------- */
    click('#tabs button[data-v="demo"]');
    ok('demo_visible', !$('viewDemo').classList.contains('hidden'));
    click('#speedSeg button[data-v="220"]');
    click('#demoStart');
    await sleep(3200);
    const lines = ALL('#demoLog .li').length;
    ok('demo_lines', lines > 5, 'lines=' + lines);
    ok('demo_no_error', txt('demoLog').indexOf('出错') < 0, txt('demoLog').slice(0, 80));
    ok('demo_seats_lord', txt('demoSeats').indexOf('地主') >= 0, txt('demoSeats'));

    /* ---------- 回对局，状态还在 ---------- */
    click('#tabs button[data-v="game"]');
    ok('game_state_kept', txt('turnInfo') === '轮到 下家' && txt('seats').indexOf('16') >= 0,
      txt('turnInfo') + ' | ' + txt('seats'));

    /* ---------- 刷新页面后恢复（模拟关掉再打开） ---------- */
    const again = load({ store: host.store });
    const d2 = again.doc;
    const t2 = (id) => (d2.getElementById(id) || { textContent: '<missing>' }).textContent.replace(/\s+/g, ' ').trim();
    ok('reload_stays_in_game', !d2.getElementById('viewGame').classList.contains('hidden'));
    ok('reload_turn', t2('turnInfo') === '轮到 下家', t2('turnInfo'));
    ok('reload_hand', t2('myHand').indexOf('3') >= 0, t2('myHand'));

    /* ---------- 新开页：粘贴识别手牌 ---------- */
    const page = (p) => {
      const d = p.doc;
      return {
        d,
        q: (s) => d.querySelector(s),
        txt: (id) => { const e = d.getElementById(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : '<missing ' + id + '>'; },
        click: (s) => { const e = d.querySelector(s); if (!e) { ok('missing ' + s, false); return; } e.click(); }
      };
    };

    const A = page(load());
    A.q('#pasteHand').value = '334455789TJQKA2';
    A.click('#pasteApply');
    ok('paste_fills_pick', A.txt('pickInfo') === '15/20', A.txt('pickInfo'));
    ok('paste_toast', A.txt('toast').indexOf('识别到 15 张') >= 0, A.txt('toast'));
    ok('paste_chip_badge', A.q('#setupChips .chip[data-r="3"] .badge').textContent.trim() === '2',
      A.q('#setupChips .chip[data-r="3"] .badge').textContent);

    // 写错了要提示，而不是清空
    A.q('#pasteHand').value = '33333';
    A.click('#pasteApply');
    ok('paste_rejects_five', A.txt('toast').indexOf('超过') >= 0, A.txt('toast'));
    ok('paste_keeps_old', A.txt('pickInfo') === '15/20', A.txt('pickInfo'));

    /* ---------- 新开页：?hand= 链接预填 ---------- */
    const B = page(load({ search: '?hand=334455789TJQKA2&lord=1' }));
    ok('url_prefill_pick', B.txt('pickInfo') === '15/17', B.txt('pickInfo'));
    ok('url_prefill_lord', B.q('#lordSeg button[data-v="1"]').className.indexOf('primary') >= 0,
      B.q('#lordSeg button[data-v="1"]').className);

    /* ---------- 新开页：填底牌 → 建议里念底牌 ---------- */
    const C = page(load());
    ok('bottom_hidden_when_lord', C.d.getElementById('bottomCard').classList.contains('hidden'));
    C.click('#lordSeg button[data-v="1"]');
    ok('bottom_shown', !C.d.getElementById('bottomCard').classList.contains('hidden'));
    C.click('#bottomChips .chip[data-r="3"]');
    C.click('#bottomChips .chip[data-r="4"]');
    C.click('#bottomChips .chip[data-r="5"]');
    ok('bottom_three', C.txt('bottomInfo') === '3/3', C.txt('bottomInfo'));
    C.q('#pasteHand').value = '33445566778899TTJ';
    C.click('#pasteApply');
    ok('paste_17', C.txt('pickInfo') === '17/17', C.txt('pickInfo'));
    C.click('#startBtn');
    ok('game_started', !C.d.getElementById('viewGame').classList.contains('hidden'));
    C.click('#playChips .chip[data-r="8"]');
    C.click('#playBtn');
    C.click('#passBtn');
    ok('bottom_in_notes', C.txt('advice').indexOf('地主底牌：3 4 5') >= 0, C.txt('advice'));
    ok('note_has_control', C.txt('advice').indexOf('外面还有') >= 0, C.txt('advice'));

    // 底牌没填满 3 张不能开局
    const D2 = page(load());
    D2.click('#lordSeg button[data-v="1"]');
    D2.click('#bottomChips .chip[data-r="3"]');
    D2.q('#pasteHand').value = '33445566778899TTJ';
    D2.click('#pasteApply');
    D2.click('#startBtn');
    ok('bottom_partial_blocks', D2.txt('toast').indexOf('填满 3 张') >= 0, D2.txt('toast'));
    ok('still_setup', !D2.d.getElementById('viewSetup').classList.contains('hidden'));
  } catch (e) {
    ok('EXCEPTION', false, e && (e.stack || e.message));
  }

  const fail = res.filter((x) => x.indexOf('FAIL') === 0);
  console.log(res.join('\n'));
  console.log('\n== ' + (res.length - fail.length) + '/' + res.length + ' passed ==');
  process.exit(fail.length ? 1 : 0);
})();
