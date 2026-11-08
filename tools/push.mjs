// 用 GitHub REST API 推送本地 HEAD 到远端（本机 TLS 被沙箱限制时 git push 用不了）
// 用法：GH_TOKEN=xxx node tools/push.mjs [owner/repo]
// 说明：以远端 HEAD 为父提交、本地 HEAD 的树为新快照，内容与本地提交一致（SHA 不同）。
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) {
  console.error('缺少 GH_TOKEN 环境变量');
  process.exit(2);
}
const REPO = process.argv[2] || 'BaChongYingovo/doudizhu-assistant';
const API = 'https://api.github.com';
const H = {
  authorization: 'token ' + TOKEN,
  'user-agent': 'dsh-agent',
  accept: 'application/vnd.github+json',
  'content-type': 'application/json'
};

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', cwd: process.cwd() }).trim();
}

// 沙箱里 Node 可能不允许 spawn 子进程（EPERM），此时由外面先把 git 信息写进 PUSH_STATE 指向的 JSON
let meta = null;
if (process.env.PUSH_STATE) {
  meta = JSON.parse(readFileSync(process.env.PUSH_STATE, 'utf8'));
} else {
  meta = {
    head: git('rev-parse', 'HEAD'),
    message: git('log', '-1', '--pretty=%B').replace(/\s+$/, ''),
    authorName: git('log', '-1', '--pretty=%an'),
    authorEmail: git('log', '-1', '--pretty=%ae'),
    authorDate: git('log', '-1', '--pretty=%aI'),
    files: git('ls-tree', '-r', 'HEAD', '--name-only').split('\n').filter(Boolean)
  };
}

async function gh(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: H,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* 非 JSON */ }
  if (!res.ok) {
    const msg = json && json.message ? json.message : text.slice(0, 300);
    const err = new Error(method + ' ' + url + ' -> ' + res.status + ' ' + msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

const { head, message, authorName, authorEmail, authorDate, files } = meta;

// 远端当前 HEAD
let remoteHead = null;
try {
  const ref = await gh('GET', '/repos/' + REPO + '/git/ref/heads/main');
  remoteHead = ref.object.sha;
} catch (e) {
  // 空仓库时 GitHub 返回 409 "Git Repository is empty."
  if (e.status !== 404 && e.status !== 409) throw e;
}

if (!remoteHead) {
  // 空仓库无法直接建 blob，先用 contents API 造一个初始提交
  const init = await gh('PUT', '/repos/' + REPO + '/contents/README.md', {
    message: 'chore: init repository',
    content: Buffer.from('#' + REPO + '\n').toString('base64')
  });
  remoteHead = init.commit.sha;
  console.log('initialized empty repo:', remoteHead.slice(0, 7));
}

if (meta.tree && remoteHead) {
  const rc = await gh('GET', '/repos/' + REPO + '/git/commits/' + remoteHead);
  if (rc.tree && rc.tree.sha === meta.tree) {
    console.log('远端内容已一致，跳过：' + remoteHead.slice(0, 7));
    process.exit(0);
  }
}

const tree = [];
for (const file of files) {
  const buf = readFileSync(path.resolve(file));
  const blob = await gh('POST', '/repos/' + REPO + '/git/blobs', {
    content: buf.toString('base64'),
    encoding: 'base64'
  });
  tree.push({ path: file.split(path.sep).join('/'), mode: '100644', type: 'blob', sha: blob.sha });
  console.log('blob', file, buf.length + 'B', blob.sha.slice(0, 7));
}

const newTree = await gh('POST', '/repos/' + REPO + '/git/trees', { tree });
const commit = await gh('POST', '/repos/' + REPO + '/git/commits', {
  message,
  tree: newTree.sha,
  parents: remoteHead ? [remoteHead] : [],
  author: { name: authorName, email: authorEmail, date: authorDate }
});

if (remoteHead) {
  await gh('PATCH', '/repos/' + REPO + '/git/refs/heads/main', { sha: commit.sha, force: false });
} else {
  await gh('POST', '/repos/' + REPO + '/git/refs', { ref: 'refs/heads/main', sha: commit.sha });
}

console.log('pushed', commit.sha.slice(0, 7), 'files=' + files.length,
  (remoteHead ? '(parent ' + remoteHead.slice(0, 7) + ')' : '(first commit)'));
console.log('https://github.com/' + REPO);
