'use strict';
// 极简 DOM 宿主：把打包后的 HTML 解析成节点树，在 Node 里跑 app.js 的真实事件路径
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const VOID = new Set(['br', 'img', 'input', 'meta', 'link', 'hr']);

class El {
  constructor(tag) {
    this.tagName = tag.toLowerCase();
    this.children = [];
    this.parentNode = null;
    this.attrs = {};
    this._text = '';
    this._listeners = {};
    this.disabled = false;
    const self = this;
    const key = (k) => 'data-' + String(k).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
    this.dataset = new Proxy({}, {
      get(t, k) { return typeof k === 'string' ? self.attrs[key(k)] : undefined; },
      set(t, k, v) { self.attrs[key(k)] = String(v); return true; },
      has(t, k) { return key(k) in self.attrs; }
    });
  }
  get id() { return this.attrs.id || ''; }
  get className() { return this.attrs.class || ''; }
  set className(v) { this.attrs.class = String(v); }
  get classList() {
    const self = this;
    const read = () => new Set(self.className.split(/\s+/).filter(Boolean));
    const write = (s) => { self.className = Array.from(s).join(' '); };
    return {
      add: function () { const s = read(); [].forEach.call(arguments, (n) => s.add(n)); write(s); },
      remove: function () { const s = read(); [].forEach.call(arguments, (n) => s.delete(n)); write(s); },
      toggle: function (n, force) {
        const s = read();
        const on = force === undefined ? !s.has(n) : !!force;
        if (on) s.add(n); else s.delete(n);
        write(s);
        return on;
      },
      contains: function (n) { return read().has(n); }
    };
  }
  get textContent() {
    if (this.tagName === '#text') return this._text;
    let s = this._text || '';
    for (const c of this.children) s += c.textContent;
    return s;
  }
  set textContent(v) {
    this.children = [];
    this._text = String(v);
  }
  set innerHTML(html) {
    this.children = [];
    this._text = '';
    parseInto(this, String(html));
  }
  get innerHTML() {
    return this.children.map(serialize).join('');
  }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener() {}
  preventDefault() {}
  stopPropagation() { this._stop = true; }
  click() { this.dispatch({ type: 'click' }); }
  dispatch(ev) {
    let node = this;
    ev.target = this;
    while (node) {
      const fns = node._listeners[ev.type];
      if (fns) {
        for (const fn of fns.slice()) {
          ev.currentTarget = node;
          fn.call(node, ev);
          if (ev._stop) return ev;
        }
      }
      node = node.parentNode;
    }
    return ev;
  }
  closest(sel) {
    const c = parseCompound(sel);
    let node = this;
    while (node && node.tagName !== '#document') {
      if (matchCompound(node, c)) return node;
      node = node.parentNode;
    }
    return null;
  }
  querySelectorAll(sel) {
    const parts = sel.trim().split(/\s+/).map(parseCompound);
    const out = [];
    walk(this, (el) => { if (matchesPath(el, parts)) out.push(el); });
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function walk(node, fn) {
  for (const c of node.children) {
    if (c.tagName === '#text') continue;
    fn(c);
    walk(c, fn);
  }
}

function parseCompound(sel) {
  const out = { tag: null, id: null, cls: [], attrs: [] };
  let s = sel.trim();
  const tagM = s.match(/^[a-zA-Z][\w-]*/);
  if (tagM) { out.tag = tagM[0].toLowerCase(); s = s.slice(tagM[0].length); }
  const re = /([.#][\w-]+|\[[^\]]+\])/g;
  let m;
  while ((m = re.exec(s))) {
    const t = m[0];
    if (t[0] === '.') out.cls.push(t.slice(1));
    else if (t[0] === '#') out.id = t.slice(1);
    else {
      const a = t.slice(1, -1).match(/^([\w-]+)(?:="([^"]*)")?$/);
      if (a) out.attrs.push([a[1], a[2]]);
    }
  }
  return out;
}

function matchCompound(el, c) {
  if (!el || el.tagName === '#text') return false;
  if (c.tag && el.tagName !== c.tag) return false;
  if (c.id && el.id !== c.id) return false;
  for (const k of c.cls) if (!el.classList.contains(k)) return false;
  for (const [k, v] of c.attrs) {
    if (k.indexOf('data-') === 0) {
      const key = k.slice(5).replace(/-([a-z])/g, (m, x) => x.toUpperCase());
      if (v === undefined) { if (!(k in el.attrs)) return false; }
      else if (el.dataset[key] !== v) return false;
    } else if (v === undefined) {
      if (!(k in el.attrs)) return false;
    } else if (el.attrs[k] !== v) {
      return false;
    }
  }
  return true;
}

function matchesPath(el, parts) {
  if (!matchCompound(el, parts[parts.length - 1])) return false;
  let i = parts.length - 2;
  let node = el.parentNode;
  while (i >= 0 && node && node.tagName !== '#document') {
    if (matchCompound(node, parts[i])) i--;
    node = node.parentNode;
  }
  return i < 0;
}

function parseInto(root, html) {
  const tagRe = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[a-zA-Z_:][-\w:.]*(?:\s*=\s*"[^"]*")?)*)\s*(\/?)>/g;
  let last = 0, m;
  const stack = [root];
  while ((m = tagRe.exec(html))) {
    if (m.index > last) addText(stack[stack.length - 1], html.slice(last, m.index));
    last = tagRe.lastIndex;
    const closing = m[1] === '/', tag = m[2].toLowerCase(), rawAttrs = m[3], selfClose = m[4] === '/';
    if (closing) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === tag) { stack.length = i; break; }
      }
    } else {
      const el = new El(tag);
      const are = /([a-zA-Z_:][-\w:.]*)(?:\s*=\s*"([^"]*)")?/g;
      let a;
      while ((a = are.exec(rawAttrs || ''))) el.attrs[a[1].toLowerCase()] = a[2] === undefined ? '' : a[2];
      stack[stack.length - 1].appendChild(el);
      if (!selfClose && !VOID.has(tag)) stack.push(el);
    }
  }
  if (last < html.length) addText(stack[stack.length - 1], html.slice(last));
}

function addText(parent, txt) {
  if (!txt) return;
  const t = new El('#text');
  t._text = txt.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  t.parentNode = parent;
  parent.children.push(t);
}

function serialize(el) {
  if (el.tagName === '#text') return el._text;
  const attrs = Object.keys(el.attrs).map((k) => ' ' + k + '="' + el.attrs[k] + '"').join('');
  if (VOID.has(el.tagName)) return '<' + el.tagName + attrs + '>';
  return '<' + el.tagName + attrs + '>' + el.children.map(serialize).join('') + '</' + el.tagName + '>';
}

function load(opts) {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'doudizhu.html'), 'utf8');
  const bodyHtml = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/gi, '');

  const doc = new El('#document');
  const body = new El('body');
  doc.appendChild(body);
  parseInto(body, bodyHtml);

  doc.body = body;
  doc.title = '斗地主军师';
  doc.createElement = (t) => new El(t);
  doc.getElementById = (id) => body.querySelector('#' + id);
  doc.querySelector = (s) => body.querySelector(s);
  doc.querySelectorAll = (s) => body.querySelectorAll(s);

  const store = (opts && opts.store) || new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); }
  };

  const sandbox = {
    document: doc, localStorage, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    location: { search: (opts && opts.search) || '', pathname: '/', href: 'file:///doudizhu.html' + ((opts && opts.search) || '') },
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'engine.js'), 'utf8'), ctx, { filename: 'engine.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'ui', 'app.js'), 'utf8'), ctx, { filename: 'app.js' });

  return { doc, body, sandbox, html, store };
}

module.exports = { load, El };
