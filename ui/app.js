(function () {
  'use strict';
  var D = window.DDZ;
  var $ = function (id) { return document.getElementById(id); };
  var LS = 'ddz-assistant-v1';
  var SEAT = ['我', '下家', '上家'];
  var capOf = function (r) { return r >= 16 ? 1 : 4; };

  var S = {
    view: 'setup',
    started: false,
    landlord: 0,
    pick: D.zero(),
    bottom: D.zero(),
    myHand: D.zero(),
    played: D.zero(),
    seatCounts: [17, 17, 17],
    last: null,
    lastLeader: 0,
    passes: 0,
    turn: 0,
    sel: D.zero(),
    log: [],
    over: null,
    history: []
  };

  var adviceCache = null;
  var demo = null;
  var demoTimer = null;
  var demoSpeed = 620;
  var toastTimer = null;

  /* ---------------- 小工具 ---------------- */
  function seatName(s) { return SEAT[s]; }
  function roleName(s, lord) { return s === (lord == null ? S.landlord : lord) ? '地主' : '农民'; }
  function seatCount(s) { return S.seatCounts[s]; }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 1700);
  }

  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify({
        view: S.view, started: S.started, landlord: S.landlord, pick: S.pick, bottom: S.bottom,
        myHand: S.myHand, played: S.played, seatCounts: S.seatCounts, last: S.last,
        lastLeader: S.lastLeader, passes: S.passes, turn: S.turn, log: S.log, over: S.over
      }));
    } catch (e) { /* 隐私模式下存不了，不影响用 */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (!o) return;
      Object.keys(o).forEach(function (k) { if (k in S) S[k] = o[k]; });
      S.sel = D.zero();
      S.history = [];
      if (S.view === 'demo') S.view = 'setup';
      if (!S.started) S.view = 'setup';
    } catch (e) { /* 忽略坏数据 */ }
  }

  function render() {
    $('viewSetup').classList.toggle('hidden', S.view !== 'setup');
    $('viewGame').classList.toggle('hidden', S.view !== 'game');
    $('viewDemo').classList.toggle('hidden', S.view !== 'demo');
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.classList.toggle('on', b.dataset.v === S.view);
    });
    if (S.view === 'setup') renderSetup();
    else if (S.view === 'game') renderGame();
    else renderDemo();
    save();
  }

  /* ---------------- 开局 ---------------- */
  function needCards() { return S.landlord === 0 ? 20 : 17; }

  function renderSetup() {
    var box = $('setupChips');
    box.innerHTML = '';
    for (var i = 0; i < 15; i++) {
      var r = i + 3, cur = S.pick[i], left = capOf(r) - cur;
      var b = document.createElement('button');
      b.className = 'chip' + (cur ? ' sel' : '') + (left <= 0 ? ' zero' : '') + (r >= 16 ? ' joker' : '');
      b.dataset.r = r;
      b.innerHTML = '<div class="r">' + D.rankName(r) + '</div>' +
        '<div class="n">' + (left > 0 ? '还能选 ' + left : '已满') + '</div>' +
        (cur ? '<span class="badge">' + cur + '</span>' : '');
      box.appendChild(b);
    }
    $('pickInfo').textContent = D.total(S.pick) + '/' + needCards();
    Array.prototype.forEach.call($('lordSeg').children, function (b) {
      b.className = 'btn' + (Number(b.dataset.v) === S.landlord ? ' primary' : '');
    });
    $('lordHint').textContent = S.landlord === 0
      ? '你是地主：手牌共 20 张（17 张 + 3 张底牌）。'
      : '地主是' + seatName(S.landlord) + '（20 张），你和另一家各 17 张。';
    renderBottom();
  }

  function renderBottom() {
    $('bottomCard').classList.toggle('hidden', S.landlord === 0);
    $('bottomInfo').textContent = D.total(S.bottom) + '/3';
    var box = $('bottomChips');
    box.innerHTML = '';
    for (var i = 0; i < 15; i++) {
      var r = i + 3, cur = S.bottom[i];
      var b = document.createElement('button');
      b.className = 'chip' + (cur ? ' sel' : '') + (r >= 16 ? ' joker' : '');
      b.dataset.r = r;
      b.innerHTML = '<div class="r">' + D.rankName(r) + '</div>' + (cur ? '<span class="badge">' + cur + '</span>' : '');
      box.appendChild(b);
    }
  }

  function tapBottom(rank) {
    var i = rank - 3;
    if (S.bottom[i] < capOf(rank) && D.total(S.bottom) < 3) S.bottom[i]++;
    else S.bottom[i] = 0;
    renderSetup();
    save();
  }

  function applyPaste() {
    var el = $('pasteHand');
    var txt = (el && el.value || '').trim();
    if (!txt) return toast('先把牌面粘进来，比如 334455789TJQKA2');
    var c;
    try { c = D.parseCards(txt); } catch (e) { return toast(e.message); }
    var n = D.total(c);
    if (!n) return toast('没认出牌：可以写 3 4 5 … T J Q K A 2、小王、大王');
    var need = needCards();
    if (n > need) return toast('这是 ' + n + ' 张，' + need + ' 张的位置放不下');
    S.pick = c;
    render();
    toast('识别到 ' + n + ' 张：' + D.cardsText(D.cardsOf(c)));
  }

  function tapPick(rank) {
    var i = rank - 3, cap = capOf(rank);
    var next = (S.pick[i] + 1) % (cap + 1);
    var old = S.pick[i];
    S.pick[i] = next;
    var need = needCards();
    if (D.total(S.pick) > need) {
      S.pick[i] = old;
      toast('手牌只要 ' + need + ' 张，别多选');
    }
    renderSetup();
    save();
  }

  function startGame() {
    var need = needCards(), n = D.total(S.pick);
    if (n !== need) return toast('手牌应该是 ' + need + ' 张，你现在选了 ' + n + ' 张');
    var bn = D.total(S.bottom);
    if (S.landlord !== 0 && bn !== 0 && bn !== 3) return toast('底牌要么不填，要填就填满 3 张');
    if (S.landlord !== 0) {
      for (var bi = 0; bi < 15; bi++) {
        if (S.bottom[bi] + S.pick[bi] > capOf(bi + 3)) {
          return toast('底牌和手牌加起来超过 4 张 ' + D.rankName(bi + 3) + ' 了，检查一下');
        }
      }
    }
    S.started = true;
    S.myHand = S.pick.slice();
    if (S.landlord === 0) S.bottom = D.zero(); // 自己就是地主，底牌已经在手里
    S.played = D.zero();
    S.sel = D.zero();
    S.seatCounts = [17, 17, 17];
    S.seatCounts[S.landlord] = 20;
    S.last = null;
    S.passes = 0;
    S.turn = S.landlord;
    S.lastLeader = S.landlord;
    S.log = [];
    S.over = null;
    S.history = [];
    S.view = 'game';
    render();
  }

  /* ---------------- 对局 ---------------- */
  function renderGame() {
    var empty = $('gameEmpty'), body = $('gameBody');
    if (!S.started) {
      empty.classList.remove('hidden');
      body.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    body.classList.remove('hidden');
    renderSeats();
    renderAdvice();
    renderTable();
    renderMyHand();
    renderInput();
  }

  function renderSeats() {
    var html = '';
    for (var s = 0; s < 3; s++) {
      html += '<div class="seat' + (S.turn === s && S.over === null ? ' turn' : '') + (s === 0 ? ' me' : '') + '">' +
        '<div class="who">' + seatName(s) + '</div>' +
        '<div class="cnt">' + seatCount(s) + '<span style="font-size:11px;color:var(--dim)"> 张</span></div>' +
        '<div class="role' + (s === S.landlord ? ' lord' : '') + '">' + roleName(s) + '</div>' +
        '</div>';
    }
    $('seats').innerHTML = html;
  }

  function renderAdvice() {
    var el = $('advice');
    if (S.over !== null) {
      adviceCache = null;
      var win = S.over === 0 ? '你赢了 🎉' : (S.over === S.landlord ? '地主赢了' : '农民赢了');
      el.className = 'advice';
      el.innerHTML = '<div class="tip">本局结束</div>' +
        '<div class="big">' + win + '</div>' +
        '<div class="why">' + (S.over === 0 ? '打得漂亮，再来一把？' : '复盘一下：哪一手可以把牌拆得更省？') + '</div>' +
        '<div class="ops"><button class="btn gold" data-act="restart">再来一局</button></div>';
      return;
    }
    if (S.turn !== 0) {
      adviceCache = null;
      el.className = 'advice wait';
      el.innerHTML = '<div class="tip">等 ' + seatName(S.turn) + ' 出牌</div>' +
        '<div class="big" style="color:var(--text);font-size:17px">把 ' + seatName(S.turn) + ' 出的牌记下来</div>' +
        '<div class="why">在下面点数出牌，点「出这手」；如果他过了就点「过」。记准了，我算的才准。</div>';
      return;
    }
    var a;
    try {
      a = D.advise({
        hand: S.myHand, me: 0, landlord: S.landlord,
        seatCounts: S.seatCounts, played: S.played, last: S.last, bottom: S.bottom
      });
    } catch (e) {
      adviceCache = null;
      el.className = 'advice wait';
      el.innerHTML = '<div class="tip">算不出建议</div><div class="why">' + e.message + '</div>';
      return;
    }
    adviceCache = a;
    var html = '';
    html += '<div class="tip">轮到你 · ' + roleName(0) + ' · 手里 ' + D.total(S.myHand) + ' 张 · 约 ' + a.plan + ' 手出完</div>';
    html += '<div class="big">' + (a.pass ? '建议：过' : '建议：' + D.describe(a.move)) + '</div>';
    html += '<div class="why">' + (a.reason || '') + '</div>';
    if (a.notes && a.notes.length) {
      html += '<div class="note">' + a.notes.join('　·　') + '</div>';
    }
    if (a.options && a.options.length > 1) {
      html += '<div class="opts">';
      a.options.forEach(function (o, i) {
        html += '<button class="opt" data-act="opt" data-i="' + i + '"><b>' + o.label + '</b>' +
          '<span style="color:var(--dim)"> ' + o.tag + '</span></button>';
      });
      html += '</div>';
    }
    html += '<div class="ops">';
    if (a.pass) {
      html += '<button class="btn primary" data-act="pass">记录：过</button>';
    } else {
      html += '<button class="btn gold" data-act="adopt">采纳，选中这手</button>';
    }
    html += '</div>';
    el.className = 'advice';
    el.innerHTML = html;
  }

  function renderTable() {
    $('turnInfo').textContent = S.over !== null ? '本局结束' : '轮到 ' + seatName(S.turn);
    var lp = $('lastPlay');
    if (!S.last) {
      lp.innerHTML = '<span style="color:var(--dim)">桌上没牌 · ' + seatName(S.turn) + ' 领出</span>';
    } else {
      lp.innerHTML = '<b>' + seatName(S.last.seat) + '</b> 出 ' + D.describe(S.last.move) +
        '<div style="font-size:12px;color:var(--dim);margin-top:2px">' + D.cardsText(S.last.move.cards) + '</div>';
    }
  }

  function renderMyHand() {
    var html = '';
    for (var i = 0; i < 15; i++) {
      if (!S.myHand[i]) continue;
      html += '<div class="hcard">' + D.rankName(i + 3) +
        (S.myHand[i] > 1 ? '<small>×' + S.myHand[i] + '</small>' : '') + '</div>';
    }
    if (!html) html = '<span class="label">手牌出完了</span>';
    $('myHand').innerHTML = html;
    $('myLeft').textContent = D.total(S.myHand) + ' 张';
  }

  function selMax(rank) {
    var i = rank - 3;
    if (S.turn === 0) return S.myHand[i];
    return Math.max(0, capOf(rank) - S.played[i]);
  }

  function renderInput() {
    $('whoLabel').textContent = seatName(S.turn);
    var cards = D.cardsOf(S.sel);
    $('selInfo').textContent = cards.length ? ('已选 ' + cards.length + ' 张：' + D.cardsText(cards)) : '还没选牌';

    var box = $('playChips');
    box.innerHTML = '';
    for (var i = 0; i < 15; i++) {
      var r = i + 3, cur = S.sel[i], cap = selMax(r);
      var left = Math.max(0, capOf(r) - S.myHand[i] - S.played[i]);
      var b = document.createElement('button');
      b.className = 'chip' + (cur ? ' sel' : '') + (cap <= 0 ? ' zero' : '') + (r >= 16 ? ' joker' : '');
      b.dataset.r = r;
      b.innerHTML = '<div class="r">' + D.rankName(r) + '</div>' +
        '<div class="n">剩 ' + left + '</div>' +
        (cur ? '<span class="badge">' + cur + '</span>' : '');
      box.appendChild(b);
    }

    $('playBtn').disabled = !cards.length || S.over !== null;
    $('passBtn').disabled = !(S.last && S.last.seat !== S.turn) || S.over !== null;
    $('undoBtn').disabled = !S.history.length;
  }

  function tapChip(rank) {
    if (S.over !== null) return;
    var i = rank - 3, cap = selMax(rank);
    if (cap <= 0) return toast('这个点数没有可记的牌了');
    S.sel[i] = (S.sel[i] + 1) % (cap + 1);
    renderInput();
  }

  function pushHistory() {
    S.history.push(JSON.stringify({
      myHand: S.myHand, played: S.played, seatCounts: S.seatCounts, last: S.last,
      lastLeader: S.lastLeader, passes: S.passes, turn: S.turn, log: S.log, over: S.over
    }));
    if (S.history.length > 60) S.history.shift();
  }

  function undo() {
    if (!S.history.length) return;
    var o = JSON.parse(S.history.pop());
    Object.keys(o).forEach(function (k) { S[k] = o[k]; });
    S.sel = D.zero();
    toast('已撤销上一笔');
    render();
  }

  function doPlay() {
    if (S.over !== null) return;
    var who = S.turn;
    var cards = D.cardsOf(S.sel);
    if (!cards.length) return toast('先在下面点出这手牌');
    var mv = D.classify(cards);
    if (!mv) return toast('这不是合法牌型：点数或张数不对');
    if (who === 0) {
      for (var i = 0; i < 15; i++) {
        if (S.sel[i] > S.myHand[i]) return toast('手里没有这么多 ' + D.rankName(i + 3));
      }
    }
    if (S.last && S.last.seat !== who && !D.beats(mv, S.last.move)) {
      return toast('压不过桌上的「' + D.describe(S.last.move) + '」');
    }
    if (cards.length > S.seatCounts[who]) return toast(seatName(who) + ' 只剩 ' + S.seatCounts[who] + ' 张了');

    pushHistory();
    for (var k = 0; k < 15; k++) {
      S.played[k] += S.sel[k];
      if (who === 0) S.myHand[k] = Math.max(0, S.myHand[k] - S.sel[k]);
    }
    S.seatCounts[who] -= cards.length;
    S.last = { seat: who, move: mv };
    S.lastLeader = who;
    S.passes = 0;
    S.log.push({ seat: who, text: D.describe(mv), cards: cards.slice().sort(function (a, b) { return a - b; }) });
    S.sel = D.zero();
    if (S.seatCounts[who] <= 0) S.over = who;
    else S.turn = (who + 1) % 3;
    render();
  }

  function doPass() {
    if (S.over !== null) return;
    var who = S.turn;
    if (!S.last || S.last.seat === who) return toast('这轮你领出，不能过');
    pushHistory();
    S.log.push({ seat: who, pass: true });
    S.passes++;
    if (S.passes >= 2) {
      S.last = null;
      S.passes = 0;
      S.turn = S.lastLeader;
    } else {
      S.turn = (who + 1) % 3;
    }
    S.sel = D.zero();
    render();
  }

  function adopt(i) {
    if (!adviceCache || adviceCache.pass) return toast('这手建议过牌');
    var mv = (i == null) ? adviceCache.move : (adviceCache.options[i] && adviceCache.options[i].move);
    if (!mv) return;
    S.sel = D.countsOf(mv.cards);
    renderInput();
    toast('已选中：' + D.cardsText(mv.cards));
  }

  /* ---------------- AI 演示 ---------------- */
  function demoStop() {
    clearTimeout(demoTimer);
    demoTimer = null;
  }

  function demoStart() {
    demoStop();
    var d = D.deal();
    var land = D.pickLandlord(d.hands);
    d.hands[land] = D.addCards(d.hands[land], d.bottom);
    demo = {
      hands: d.hands, landlord: land, bottom: d.bottom,
      seatCounts: d.hands.map(function (h) { return D.total(h); }),
      played: D.zero(), last: null, lastLeader: land, passes: 0,
      turn: land, log: [], over: null
    };
    S.view = 'demo';
    render();
    demoStep();
  }

  function demoStep() {
    if (!demo || demo.over !== null) return;
    var who = demo.turn, a;
    try {
      a = D.advise({
        hand: demo.hands[who], me: who, landlord: demo.landlord,
        seatCounts: demo.seatCounts, played: demo.played, last: demo.last, bottom: demo.bottom
      });
    } catch (e) {
      demo.log.push({ seat: who, text: '算牌出错：' + e.message });
      demo.over = -1;
      renderDemo();
      return;
    }
    var canPass = demo.last && demo.last.seat !== who;
    if (a.pass && canPass) {
      demo.passes++;
      demo.log.push({ seat: who, pass: true });
      if (demo.passes >= 2) {
        demo.last = null;
        demo.passes = 0;
        demo.turn = demo.lastLeader;
      } else {
        demo.turn = (who + 1) % 3;
      }
    } else if (a.move) {
      var mv = a.move;
      demo.played = D.addCards(demo.played, mv.cards);
      demo.hands[who] = D.minus(demo.hands[who], mv.cards);
      demo.seatCounts[who] -= mv.cards.length;
      demo.last = { seat: who, move: mv };
      demo.lastLeader = who;
      demo.passes = 0;
      demo.log.push({ seat: who, text: D.describe(mv), cards: mv.cards.slice().sort(function (a, b) { return a - b; }) });
      if (demo.seatCounts[who] <= 0) demo.over = who;
      else demo.turn = (who + 1) % 3;
    } else {
      demo.log.push({ seat: who, text: '无牌可出' });
      demo.over = -1;
    }
    renderDemo();
    if (demo.over === null) {
      demoTimer = setTimeout(demoStep, demoSpeed);
    }
  }

  function renderDemo() {
    var seats = $('demoSeats'), logBox = $('demoLog');
    $('demoStart').textContent = demo ? '重开一局' : '开一局';
    if (!demo) {
      seats.innerHTML = '<div class="seat" style="grid-column:1/-1">' +
        '<div class="who">还没开牌</div><div class="cnt">—</div>' +
        '<div class="role">AI 打三家，你只看</div></div>';
      logBox.innerHTML = '<div style="color:var(--dim);font-size:13px">点上面「开一局」，看这套算法怎么拆牌、什么时候压、什么时候过。</div>';
      return;
    }
    var html = '';
    for (var s = 0; s < 3; s++) {
      html += '<div class="seat' + (demo.turn === s && demo.over === null ? ' turn' : '') + (s === 0 ? ' me' : '') + '">' +
        '<div class="who">' + seatName(s) + '</div>' +
        '<div class="cnt">' + demo.seatCounts[s] + '<span style="font-size:11px;color:var(--dim)"> 张</span></div>' +
        '<div class="role' + (s === demo.landlord ? ' lord' : '') + '">' + (s === demo.landlord ? '地主' : '农民') + '</div>' +
        '</div>';
    }
    seats.innerHTML = html;

    var lines = demo.log.map(function (x) {
      var txt = x.pass ? '过' : x.text + (x.cards ? ' <span style="color:var(--dim)">' + D.cardsText(x.cards) + '</span>' : '');
      return '<div class="li"><span class="who">' + seatName(x.seat) + '</span>' +
        '<span class="what' + (x.pass ? ' pass' : '') + '">' + txt + '</span></div>';
    });
    var banner = '';
    if (demo.over !== null) {
      banner = '<div class="li" style="border-bottom:0;padding-top:8px"><span class="who">结果</span><span class="what">' +
        (demo.over < 0 ? '这局出错了' : (demo.over === demo.landlord ? '地主赢' : '农民赢') + '（共 ' + demo.log.length + ' 手）') +
        '</span></div>';
    }
    logBox.innerHTML = lines.join('') || '<div style="color:var(--dim)">…</div>';
    if (banner) logBox.innerHTML += banner;
    logBox.scrollTop = logBox.scrollHeight;
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    $('setupChips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (b) tapPick(Number(b.dataset.r));
    });
    $('playChips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (b) tapChip(Number(b.dataset.r));
    });
    $('lordSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      S.landlord = Number(b.dataset.v);
      render();
    });
    $('clearPick').addEventListener('click', function () {
      S.pick = D.zero();
      render();
    });
    $('bottomChips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (b) tapBottom(Number(b.dataset.r));
    });
    $('bottomClear').addEventListener('click', function () {
      S.bottom = D.zero();
      renderSetup();
      save();
    });
    $('pasteApply').addEventListener('click', applyPaste);
    $('pasteHand').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applyPaste(); }
    });
    $('startBtn').addEventListener('click', startGame);
    $('playBtn').addEventListener('click', doPlay);
    $('passBtn').addEventListener('click', doPass);
    $('undoBtn').addEventListener('click', undo);
    $('goSetup').addEventListener('click', function () { S.view = 'setup'; render(); });
    $('advice').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.dataset.act;
      if (act === 'adopt') adopt(null);
      else if (act === 'opt') adopt(Number(b.dataset.i));
      else if (act === 'pass') doPass();
      else if (act === 'restart') {
        demoStop();
        S.started = false;
        S.over = null;
        S.sel = D.zero();
        S.view = 'setup';
        render();
      }
    });
    $('tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      S.view = b.dataset.v;
      render();
    });
    $('demoStart').addEventListener('click', demoStart);
    $('speedSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      demoSpeed = Number(b.dataset.v);
      Array.prototype.forEach.call($('speedSeg').children, function (x) {
        x.className = 'btn sm' + (x === b ? ' primary' : '');
      });
    });
  }

  // 支持 ?hand=334455789TJQKA2&lord=1 直接带牌面打开
  function applyUrl() {
    var q = '';
    try { q = (window.location && window.location.search) || ''; } catch (e) { return; }
    if (!q) return;
    var m = /[?&]hand=([^&]+)/.exec(q);
    if (m) {
      try {
        S.pick = D.parseCards(decodeURIComponent(m[1]));
        S.view = 'setup';
      } catch (e) { /* 链接写错了就不填，页面上还能手动选 */ }
    }
    var l = /[?&]lord=([0-2])/.exec(q);
    if (l) S.landlord = Number(l[1]);
  }

  load();
  applyUrl();
  bind();
  render();
  document.title = '斗地主军师';
})();
