import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { main, parseArgs, serve } from './serve.mjs';

const SCRIPT = fileURLToPath(new URL('./serve.mjs', import.meta.url));

function build() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-'));
  fs.mkdirSync(path.join(root, 'data'));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>start</title>');
  fs.writeFileSync(path.join(root, 'data', 'meta.json'), '{"a":1}');
  fs.writeFileSync(path.join(path.dirname(root), `${path.basename(root)}-secret.txt`), 'secret');
  return root;
}

async function withServer(work) {
  const root = build();
  const { server, port } = await serve(root);
  try {
    await work(`http://127.0.0.1:${port}`, root);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('a file is served with its type, and / serves the start page', async () => {
  await withServer(async (origin) => {
    const json = await fetch(`${origin}/data/meta.json`);
    assert.equal(json.status, 200);
    assert.match(json.headers.get('content-type'), /^application\/json/);
    assert.deepEqual(await json.json(), { a: 1 });
    const start = await fetch(`${origin}/`);
    assert.match(start.headers.get('content-type'), /^text\/html/);
    assert.match(await start.text(), /<title>start<\/title>/);
  });
});

test('a path outside the build folder is refused', async () => {
  await withServer(async (origin, root) => {
    const secret = `${path.basename(root)}-secret.txt`;
    const escaped = await fetch(`${origin}/..%2f${secret}`, { redirect: 'manual' });
    assert.equal(escaped.status, 403);
    const plain = await fetch(`${origin}/../${secret}`, { redirect: 'manual' });
    assert.notEqual(plain.status, 200);
  });
});

test('a deep link is redirected to its hash address', async () => {
  await withServer(async (origin) => {
    for (const route of ['/radar', '/time-machine', '/player/abc%20d']) {
      const answer = await fetch(`${origin}${route}`, { redirect: 'manual' });
      assert.equal(answer.status, 302, route);
      assert.equal(answer.headers.get('location'), `/#${route}`);
    }
  });
});

test('a deep link keeps its query behind the hash', async () => {
  await withServer(async (origin) => {
    const answer = await fetch(`${origin}/time-machine?season=2019`, { redirect: 'manual' });
    assert.equal(answer.status, 302);
    assert.equal(answer.headers.get('location'), '/#/time-machine?season=2019');
  });
});

test('a NUL byte in the path is refused and the server keeps answering', async () => {
  await withServer(async (origin) => {
    assert.equal((await fetch(`${origin}/%00`, { redirect: 'manual' })).status, 400);
    assert.equal((await fetch(`${origin}/data/meta.json%00`, { redirect: 'manual' })).status, 400);
    assert.equal((await fetch(`${origin}/data/meta.json`)).status, 200);
  });
});

test('a missing file with an extension gives 404', async () => {
  await withServer(async (origin) => {
    assert.equal((await fetch(`${origin}/assets/missing.js`, { redirect: 'manual' })).status, 404);
  });
});

test('without a build the command says to run the build first and exits non-zero', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-empty-'));
  const result = spawnSync(process.execPath, [SCRIPT, '--dir', empty], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /run the build first with "make build"/);
  assert.equal(result.stdout.trim().split('\n').length, 1);
});

test('main prints one line with the address and honours --port', async () => {
  const root = build();
  const lines = [];
  const result = await main(['--port', '0'], root, (line) => lines.push(line));
  try {
    assert.equal(result.code, 0);
    assert.deepEqual(lines, [`Fair Scout demo: open http://127.0.0.1:${result.port}/ (Ctrl+C stops it)`]);
  } finally {
    await new Promise((resolve) => result.server.close(resolve));
  }
  assert.equal(parseArgs(['--port', '5000'], 'x').port, 5000);
  assert.match(parseArgs(['--port', 'abc'], 'x').error, /usage/);
});

test('a port that is taken gives one clear line and a non-zero code', async () => {
  const root = build();
  const first = await serve(root);
  const lines = [];
  try {
    const result = await main(['--port', String(first.port)], root, (line) => lines.push(line));
    assert.equal(result.code, 1);
    assert.equal(lines.length, 1);
    assert.match(lines[0], new RegExp(`^FAIL cannot listen on port ${first.port}: `));
  } finally {
    await new Promise((resolve) => first.server.close(resolve));
  }
});

test('PORT in the environment sets the port and opens the server to every interface', () => {
  assert.deepEqual(parseArgs([], 'dist', { PORT: '8080' }), { port: 8080, host: '0.0.0.0', dir: 'dist' });
});

test('without PORT the server stays on 127.0.0.1 and the default port', () => {
  assert.deepEqual(parseArgs([], 'dist', {}), { port: 4173, host: '127.0.0.1', dir: 'dist' });
  assert.deepEqual(parseArgs([], 'dist', { PORT: 'abc' }), { port: 4173, host: '127.0.0.1', dir: 'dist' });
});

test('the command line and HOST win over the defaults', () => {
  assert.deepEqual(parseArgs(['--port', '5000', '--host', '127.0.0.1'], 'dist', { PORT: '8080' }), { port: 5000, host: '127.0.0.1', dir: 'dist' });
  assert.equal(parseArgs([], 'dist', { PORT: '8080', HOST: '127.0.0.1' }).host, '127.0.0.1');
});
