// Static server for the demo: serves app/dist on 127.0.0.1, standard library only.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PORT = 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/**
 * Start a static server for `root` on 127.0.0.1 and resolve with { server, port }. Port 0 picks a free port.
 * The app uses hash addresses, so a path that is no file and has no extension (/radar, /player/<id>) is
 * redirected to the same path behind a hash (/#/radar), with its query kept; a missing file with an extension is a 404.
 */
export function serve(root, port = 0) {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    let rel;
    try {
      rel = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end('bad address');
      return;
    }
    // A NUL byte makes the file read throw at once instead of answering; refuse it here.
    if (rel.includes('\0')) {
      res.writeHead(400).end('bad address');
      return;
    }
    const file = path.join(base, rel.endsWith('/') ? rel + 'index.html' : rel);
    if (file !== base && !file.startsWith(base + path.sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (error, body) => {
      if (error) {
        if (path.extname(rel) === '' && rel !== '/') {
          res.writeHead(302, { location: `/#${url.pathname.replace(/\/$/, '')}${url.search}` }).end();
          return;
        }
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/** Read the options of the command line: { port, dir } or { error }. */
export function parseArgs(argv, defaultDir) {
  const options = { port: DEFAULT_PORT, dir: defaultDir };
  for (let i = 0; i < argv.length; i += 2) {
    const value = argv[i + 1];
    if (argv[i] === '--port' && /^\d+$/.test(value ?? '') && Number(value) <= 65535) options.port = Number(value);
    else if (argv[i] === '--dir' && value) options.dir = value;
    else return { error: `unknown or incomplete option "${argv[i]}"; usage: node scripts/serve.mjs [--port <number>] [--dir <folder>]` };
  }
  return options;
}

/** Start the demo server and resolve with { code } (non-zero: nothing started) or { code: 0, server, port }. */
export async function main(argv, defaultDir, log = console.log) {
  const options = parseArgs(argv, defaultDir);
  if (options.error) {
    log(`FAIL ${options.error}`);
    return { code: 2 };
  }
  if (!fs.existsSync(path.join(options.dir, 'index.html'))) {
    log('FAIL the build is missing (app/dist/index.html): run the build first with "make build"');
    return { code: 1 };
  }
  try {
    const { server, port } = await serve(options.dir, options.port);
    log(`Fair Scout demo: open http://127.0.0.1:${port}/ (Ctrl+C stops it)`);
    return { code: 0, server, port };
  } catch (error) {
    log(`FAIL cannot listen on port ${options.port}: ${error.message}`);
    return { code: 1 };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await main(process.argv.slice(2), fileURLToPath(new URL('../app/dist', import.meta.url)));
  if (result.code !== 0) {
    process.exitCode = result.code;
  } else {
    process.once('SIGINT', () => {
      result.server.close(() => process.exit(0));
      result.server.closeAllConnections();
    });
  }
}
