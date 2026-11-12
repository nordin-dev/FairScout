// Health check: serves app/dist on 127.0.0.1, requests the start page and the data files, renders the five
// screens and renders one of them again from a nested folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

export const DATA_FILES = [
  'data/players.json',
  'data/leagues.json',
  'data/evidence.json',
  'data/timemachine.json',
  'data/meta.json',
];

/**
 * The problems that show a data file is not from the export: one line per problem, empty when the five
 * files look exported. `files` maps the published path to the parsed content (null when it did not parse).
 */
export function exportProblems(files) {
  const problems = [];
  const meta = files['data/meta.json'];
  const players = files['data/players.json'];
  const rows = meta?.model?.training_rows;
  if (!(typeof rows === 'number' && rows > 0)) {
    problems.push(`FAIL /data/meta.json (from the export): model.training_rows is ${JSON.stringify(rows)}, expected a number above zero`);
  }
  if (!Array.isArray(players)) {
    problems.push('FAIL /data/players.json (from the export): the file is not a list of players');
    return problems;
  }
  const samples = players.filter((p) => typeof p?.id === 'string' && p.id.startsWith('sample-'));
  if (samples.length > 0) {
    problems.push(`FAIL /data/players.json (from the export): ${samples.length} id(s) begin with "sample-", first "${samples[0].id}"`);
  }
  const stated = meta?.pool?.up_to_1m;
  const counted = players.filter((p) => p?.in_pool === true).length;
  if (counted !== stated) {
    problems.push(`FAIL /data/players.json (from the export): ${counted} records have in_pool true, meta.json states a pool of ${JSON.stringify(stated)}`);
  }
  return problems;
}

/** The forbidden words in the visible text of a rendered page; empty when it has none. */
export function brokenWords(dom) {
  const body = dom.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
  const text = decodeEntities(body.replace(/<[^>]*>/g, ' '));
  return [/\bNaN\b/, /\bundefined\b/, /\[object Object\]/].filter((word) => word.test(text)).map((word) => word.source.replace(/\\b|\\/g, ''));
}

/** Fetch an address and return { status, body }. */
async function get(url) {
  const response = await fetch(url);
  return { status: response.status, body: await response.text() };
}

/** Return the script and style addresses of a start page that are not relative. */
export function nonRelativeReferences(html) {
  const bad = [];
  const pattern = /<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(pattern)) {
    const tag = match[0];
    if (/<link\b/i.test(tag) && !/rel=["']?(stylesheet|modulepreload)/i.test(tag)) continue;
    const address = match[1];
    if (!address.startsWith('./') && !address.startsWith('../')) bad.push(address);
  }
  return bad;
}

export const BROWSER_PLACES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'google-chrome',
  'chromium',
  'chromium-browser',
];

const BROWSER_TIME_LIMIT_MS = 30000;

/** Find the browser: the macOS Chrome first, then the names on the path. Return its path or null. */
export function findBrowser(places = BROWSER_PLACES, pathVariable = process.env.PATH ?? '') {
  for (const place of places) {
    const candidates = place.includes('/') ? [place] : pathVariable.split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, place));
    for (const candidate of candidates) {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // not here: try the next place
      }
    }
  }
  return null;
}

/** The one-line failure for a machine without a browser; it names every place that was searched. */
export function missingBrowserMessage(places = BROWSER_PLACES) {
  return `FAIL screens: no Chrome or Chromium found; looked for ${places.map((place) => `"${place}"`).join(', ')}; install Chrome or Chromium`;
}

const EXCERPT_LIMIT = 160;

/** A short, escaped excerpt of a log line: control characters and quotes escaped, cut at a fixed length. */
export function excerpt(text, limit = EXCERPT_LIMIT) {
  const flat = String(text).trim();
  const escaped = JSON.stringify(flat.slice(0, limit)).slice(1, -1);
  return flat.length > limit ? `${escaped}...` : escaped;
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Judge one rendered screen. `dom` is the page as rendered, `log` the browser's log, `playerName` the
 * name that must be on a player card (omit it for the other screens). Return { ok, reason }.
 */
export function judgeScreen({ dom, log, playerName = null }) {
  if (!/<div id="root"[^>]*>\s*<(?!\/div)/i.test(dom)) {
    return { ok: false, reason: 'the root element is empty' };
  }
  if (!/<h1[\s>]/i.test(dom)) return { ok: false, reason: 'the page has no main heading' };
  if (/class="[^"]*\bnot-found\b/.test(dom)) return { ok: false, reason: "the page shows the frame's not-found screen" };
  if (/role="alert"/.test(dom)) return { ok: false, reason: 'the page shows a data error block' };
  const broken = brokenWords(dom);
  if (broken.length > 0) return { ok: false, reason: `the visible text contains ${broken.join(', ')}` };
  if (playerName !== null) {
    const text = decodeEntities(dom.replace(/<[^>]*>/g, ' '));
    if (!text.includes(playerName)) return { ok: false, reason: `the player name "${playerName}" is not in the page` };
  }
  // This Chrome logs every console call and every uncaught exception as an INFO:CONSOLE line, the level
  // of console.error is not kept; so any console line counts, and "Uncaught" marks an exception.
  const lines = log.split('\n').filter((line) => /:CONSOLE[:\]]/.test(line));
  const uncaught = lines.find((line) => /"Uncaught\b/.test(line));
  if (uncaught) return { ok: false, reason: `uncaught exception in the console: ${excerpt(uncaught)}` };
  if (lines.length > 0) return { ok: false, reason: `console error: ${excerpt(lines[0])}` };
  return { ok: true, reason: '' };
}

/** Open an address in headless `browser`, with its own profile folder, and resolve with { dom, log }. The browser is always ended. */
export function renderWithBrowser(browser, address, profileDir, limitMs = BROWSER_TIME_LIMIT_MS) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      `--user-data-dir=${profileDir}`,
      '--virtual-time-budget=5000',
      '--dump-dom',
      '--enable-logging=stderr',
      '--v=0',
      address,
    ];
    const child = spawn(browser, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let dom = '';
    let log = '';
    let finished = false;
    const end = () => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // the browser has already ended
      }
    };
    const timer = setTimeout(() => {
      finished = true;
      end();
      reject(new Error(`the browser did not finish within ${limitMs / 1000} seconds`));
    }, limitMs);
    child.stdout.on('data', (chunk) => (dom += chunk));
    child.stderr.on('data', (chunk) => (log += chunk));
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', () => {
      clearTimeout(timer);
      end();
      if (!finished) resolve({ dom, log });
    });
  });
}

/** Run `work(profileDir)` with a temporary browser profile folder that is removed afterwards, also on failure. */
export async function withProfileFolder(work) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'healthcheck-profile-'));
  try {
    return await work(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The screens to render and the problems found while building the list. `players` and `timemachine` are
 * the parsed data files (or null). The player id is encoded before it enters an address.
 */
export function buildScreens(players, timemachine) {
  const screens = [
    { route: '/similar', expected: null },
    { route: '/radar', expected: null },
  ];
  const problems = [];
  const first = Array.isArray(players) ? players[0] : undefined;
  if (first && typeof first.id === 'string' && typeof first.name === 'string') {
    screens.push({ route: `/player/${encodeURIComponent(first.id)}`, expected: first.name });
  } else {
    problems.push('FAIL #/player/<id> (player card): data/players.json holds no first player with an id and a name');
  }
  const seasons = timemachine && Array.isArray(timemachine.seasons) ? timemachine.seasons : [];
  const pick = seasons.length ? seasons[seasons.length - 1].picks?.[0] : undefined;
  if (pick && typeof pick.name === 'string') {
    screens.push({ route: '/time-machine', expected: pick.name });
  } else {
    problems.push('FAIL #/time-machine: data/timemachine.json holds no last season with a first pick that has a name');
  }
  screens.push({ route: '/evidence', expected: null });
  return { screens, problems };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Check the five screens. Return [{ ok, line }]. `render(address, profileDir)` gives { dom, log }. */
async function checkScreens(origin, root, render) {
  const { screens, problems } = buildScreens(
    readJson(path.join(root, 'data/players.json')),
    readJson(path.join(root, 'data/timemachine.json')),
  );
  const results = problems.map((line) => ({ ok: false, line }));
  await withProfileFolder(async (profileDir) => {
    for (const screen of screens) {
      const label = `#${screen.route}`;
      try {
        const { dom, log } = await render(`${origin}/#${screen.route}`, profileDir);
        const verdict = judgeScreen({ dom, log, playerName: screen.expected });
        results.push(
          verdict.ok
            ? { ok: true, line: `ok   ${label} (renders, no console error)` }
            : { ok: false, line: `FAIL ${label}: ${verdict.reason}` },
        );
      } catch (error) {
        results.push({ ok: false, line: `FAIL ${label}: ${excerpt(error.message)}` });
      }
    }
  });
  return results;
}

const NESTED = ['any', 'sub folder'];

/**
 * Check that the build also runs from a folder below the server's root: the build is copied into a nested
 * folder with a space in its name, the start page and the five data files must answer 200 there and the radar must
 * render. Return [{ ok, line }]. The copy is removed afterwards, also on failure.
 */
async function checkNestedFolder(root, render) {
  const label = `/${NESTED.join('/')}/ (the build runs from a nested folder)`;
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'healthcheck-nested-'));
  try {
    fs.mkdirSync(path.join(parent, ...NESTED.slice(0, -1)), { recursive: true });
    fs.cpSync(root, path.join(parent, ...NESTED), { recursive: true });
    const { server, port } = await serve(parent);
    try {
      const base = `http://127.0.0.1:${port}/${NESTED.map(encodeURIComponent).join('/')}/`;
      const start = await get(base);
      if (start.status !== 200) return [{ ok: false, line: `FAIL ${label}: start page status ${start.status}` }];
      for (const file of DATA_FILES) {
        const data = await get(`${base}${file}`);
        if (data.status !== 200) return [{ ok: false, line: `FAIL ${label}: ${file} status ${data.status}` }];
      }
      const verdict = await withProfileFolder(async (profileDir) => judgeScreen(await render(`${base}#/radar`, profileDir)));
      return [verdict.ok ? { ok: true, line: `ok   ${label}` } : { ok: false, line: `FAIL ${label}: ${verdict.reason}` }];
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } catch (error) {
    // The code only: the message of a file error would print a path of this machine.
    return [{ ok: false, line: `FAIL ${label}: the copy could not be made, served or rendered (${error.code ?? error.name})` }];
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
}

/** The render function of the installed browser, or null when the machine has none. */
function browserRenderer() {
  const browser = findBrowser();
  return browser ? (address, profileDir) => renderWithBrowser(browser, address, profileDir) : null;
}

/** Run every check against `root`. Return [{ ok, line }] in order. */
export async function runChecks(root, render = null) {
  const { server, port } = await serve(root);
  const origin = `http://127.0.0.1:${port}`;
  const results = [];
  try {
    const page = await get(`${origin}/`);
    results.push(
      page.status === 200
        ? { ok: true, line: 'ok   / (start page, status 200)' }
        : { ok: false, line: `FAIL / (start page): status ${page.status}` },
    );
    if (page.status === 200) {
      const bad = nonRelativeReferences(page.body);
      const references = /<script\b[^>]*\bsrc=/i.test(page.body);
      if (bad.length > 0) {
        results.push({ ok: false, line: `FAIL / (relative addresses): not relative: ${bad.join(', ')}` });
      } else if (!references) {
        results.push({ ok: false, line: 'FAIL / (relative addresses): the start page refers to no script' });
      } else {
        results.push({ ok: true, line: 'ok   / (scripts and styles use relative addresses)' });
      }
    }
    const parsed = {};
    for (const file of DATA_FILES) {
      const address = `/${file}`;
      const answer = await get(`${origin}${address}`);
      if (answer.status !== 200) {
        results.push({ ok: false, line: `FAIL ${address}: status ${answer.status}` });
        continue;
      }
      try {
        parsed[file] = JSON.parse(answer.body);
        results.push({ ok: true, line: `ok   ${address} (status 200, valid JSON)` });
      } catch {
        results.push({ ok: false, line: `FAIL ${address}: body is not valid JSON` });
      }
    }
    if (Object.keys(parsed).length === DATA_FILES.length) {
      const problems = exportProblems(parsed);
      results.push(...problems.map((line) => ({ ok: false, line })));
      if (problems.length === 0) results.push({ ok: true, line: 'ok   data files come from the export (training rows, no sample ids, pool size matches)' });
    }
    const renderer = render ?? browserRenderer();
    if (renderer) {
      results.push(...(await checkScreens(origin, root, renderer)));
      results.push(...(await checkNestedFolder(root, renderer)));
    } else {
      results.push({ ok: false, line: missingBrowserMessage() });
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  return results;
}

/** Run the health check for `root`, print one line per check and return the exit code. */
export async function main(root, log = console.log, render = null) {
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    log(`FAIL ${root} is missing: run the build first (make build)`);
    return 1;
  }
  const results = await runChecks(root, render);
  for (const result of results) log(result.line);
  const failed = results.filter((result) => !result.ok).length;
  log(
    failed === 0
      ? `health: all ${results.length} checks passed`
      : `health: ${failed} of ${results.length} checks failed`,
  );
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../app/dist', import.meta.url));
  process.exitCode = await main(root);
}
