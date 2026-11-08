// 生成三个测试页：test-full（断言）、test-setup / test-game（截图用）
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'doudizhu.html'), 'utf8');

function page(js) {
  return html.replace('</body>', '<script>' + js + '</script>\n</body>');
}

const HELP = `
  var $ = function(id){ return document.getElementById(id); };
  var Q = function(s){ return document.querySelector(s); };
  var C = function(s){ var e = Q(s); if(!e){ BAD.push('missing '+s); return false; } e.click(); return true; };
  var T = function(id){ var e = $(id); return e ? e.textContent.replace(/\\s+/g,' ').trim() : '<missing '+id+'>'; };
  var BAD = [];
`;

const full = `(function(){
  var log = [], BAD = [], done = false;
  window.onerror = function(m, s, l, c){ log.push('JSERROR ' + m + ' @' + l + ':' + c); };
` + HELP + `
  function ok(name, cond, extra){ log.push((cond ? 'PASS ' : 'FAIL ') + name + (extra != null ? ' | ' + String(extra).slice(0, 80) : '')); }
  function pickHand(){
    [3,4,5,6].forEach(function(r){ for(var k=0;k<4;k++) C('#setupChips .chip[data-r="'+r+'"]'); });
    C('#setupChips .chip[data-r="7"]');
  }
  function finish(){
    if(done) return; done = true;
    var pre = document.createElement('pre'); pre.id = 'testout';
    pre.textContent = JSON.stringify({ bad: BAD, log: log }, null, 1);
    document.body.appendChild(pre);
    document.title = 'DONETEST';
  }
  var steps = [
    function(){
      ok('title', document.title === '斗地主军师', document.title);
      ok('chips15', document.querySelectorAll('#setupChips .chip').length === 15);
      ok('tabs3', document.querySelectorAll('#tabs button').length === 3);
    },
    pickHand,
    function(){ ok('pick17', T('pickInfo') === '17/17', T('pickInfo')); C('#lordSeg button[data-v="1"]'); },
    function(){ ok('lordHint17', T('lordHint').indexOf('17 张') >= 0, T('lordHint')); C('#startBtn'); },
    function(){
      ok('gameShown', !$('viewGame').classList.contains('hidden'));
      ok('adviceWaitXJ', T('advice').indexOf('等 下家') >= 0, T('advice'));
      ok('turnXJ', T('turnInfo') === '轮到 下家', T('turnInfo'));
      C('#playChips .chip[data-r="8"]');
    },
    function(){ ok('selOne8', T('selInfo').indexOf('已选 1 张') >= 0, T('selInfo')); C('#playBtn'); },
    function(){
      ok('turnSJ', T('turnInfo') === '轮到 上家', T('turnInfo'));
      ok('adviceWaitSJ', T('advice').indexOf('等 上家') >= 0, T('advice'));
      ok('seat16', T('seats').indexOf('16') >= 0, T('seats'));
      C('#passBtn');
    },
    function(){
      ok('turnMe', T('turnInfo') === '轮到 我', T('turnInfo'));
      ok('advicePass', T('advice').indexOf('建议：过') >= 0, T('advice'));
      ok('passEnabled', !$('passBtn').disabled);
      C('#advice [data-act="pass"]');
    },
    function(){
      ok('trickClosed', T('lastPlay').indexOf('桌上没牌') >= 0, T('lastPlay'));
      ok('backToLeader', T('turnInfo') === '轮到 下家', T('turnInfo'));
      C('#undoBtn');
    },
    function(){ ok('undo1', T('turnInfo') === '轮到 我', T('turnInfo')); C('#undoBtn'); },
    function(){ C('#undoBtn'); },
    function(){
      ok('undo3', T('turnInfo') === '轮到 下家' && T('lastPlay').indexOf('桌上没牌') >= 0, T('turnInfo') + ' | ' + T('lastPlay'));
      C('#playChips .chip[data-r="3"]'); C('#playBtn');
    },
    function(){ ok('turnSJ2', T('turnInfo') === '轮到 上家', T('turnInfo')); C('#passBtn'); },
    function(){
      ok('adviceBeat', T('advice').indexOf('建议：单张 4') >= 0, T('advice'));
      C('#advice [data-act="adopt"]');
    },
    function(){
      ok('adopted', T('selInfo').indexOf('已选 1 张') >= 0 && T('selInfo').indexOf('4') >= 0, T('selInfo'));
      C('#playBtn');
    },
    function(){
      ok('me16', T('seats').indexOf('16') >= 0, T('seats'));
      ok('afterMine', T('turnInfo') === '轮到 下家', T('turnInfo'));
      ok('handNoPlayed4', T('myHand').indexOf('4') >= 0, T('myHand'));
      C('#tabs button[data-v="demo"]');
    },
    function(){ ok('demoShown', !$('viewDemo').classList.contains('hidden')); C('#speedSeg button[data-v="220"]'); C('#demoStart'); },
    function(){
      setTimeout(function(){
        var n = document.querySelectorAll('#demoLog .li').length;
        ok('demoLogLines', n > 5, 'lines=' + n);
        ok('demoNoError', T('demoLog').indexOf('出错') < 0, T('demoLog').slice(0, 80));
        C('#tabs button[data-v="game"]');
        finish();
      }, 2600);
    }
  ];
  var i = 0;
  function next(){
    if(i >= steps.length) return finish();
    try { steps[i++](); } catch(e){ log.push('EXC ' + (e && e.message)); }
    if(!done) setTimeout(next, 30);
  }
  setTimeout(next, 60);
})();`;

fs.writeFileSync(path.join(root, 'test-full.html'), page(full), 'utf8');

const setupShot = `(function(){
` + HELP + `
  C('#setupChips .chip[data-r="3"]'); C('#setupChips .chip[data-r="3"]'); C('#setupChips .chip[data-r="3"]');
  C('#setupChips .chip[data-r="4"]'); C('#setupChips .chip[data-r="4"]');
  C('#setupChips .chip[data-r="15"]'); C('#setupChips .chip[data-r="16"]');
  C('#lordSeg button[data-v="0"]');
})();`;
fs.writeFileSync(path.join(root, 'test-setup.html'), page(setupShot), 'utf8');

const gameShot = `(function(){
` + HELP + `
  [3,4,5,6].forEach(function(r){ for(var k=0;k<4;k++) C('#setupChips .chip[data-r="'+r+'"]'); });
  C('#setupChips .chip[data-r="7"]');
  C('#lordSeg button[data-v="1"]'); C('#startBtn');
  setTimeout(function(){
    C('#playChips .chip[data-r="8"]'); C('#playBtn'); C('#passBtn');
  }, 80);
})();`;
fs.writeFileSync(path.join(root, 'test-game.html'), page(gameShot), 'utf8');

console.log('test pages written');
