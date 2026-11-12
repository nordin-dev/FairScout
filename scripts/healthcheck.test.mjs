import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BROWSER_PLACES, DATA_FILES, buildScreens, excerpt, judgeScreen, exportProblems, brokenWords, main, missingBrowserMessage, withProfileFolder } from './healthcheck.mjs';

const GOOD_DOM = '<html><body><div id="root"><main><h1>Blind pick</h1><p>Ana Test</p></main></div><script></script></body></html>';
const PAGE = '<!doctype html><script type="module" src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css">';

const META = JSON.stringify({ model: { training_rows: 1200 }, pool: { up_to_1m: 1 } });
const PLAYERS = JSON.stringify([{ id: 'p-1', name: 'Ana Test', in_pool: true }]);
const TIMEMACHINE = JSON.stringify({ seasons: [{ season: '2019', picks: [{ name: 'Old Pick' }] }, { season: '2020', picks: [{ name: 'Ana Test' }] }] });

/** A stand-in for the browser: every screen renders a good page. */
async function goodScreens() {
  return { dom: GOOD_DOM, log: '' };
}

function site(page = PAGE, skip = null, broken = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'healthcheck-'));
  fs.mkdirSync(path.join(root, 'data'));
  fs.writeFileSync(path.join(root, 'index.html'), page);
  for (const file of DATA_FILES) {
    if (file === skip) continue;
    fs.writeFileSync(path.join(root, file), file === broken ? 'not json' : file === 'data/players.json' ? PLAYERS : file === 'data/timemachine.json' ? TIMEMACHINE : file === 'data/meta.json' ? META : '{}');
  }
  return root;
}

async function run(root, render = goodScreens) {
  const lines = [];
  const code = await main(root, (line) => lines.push(line), render);
  return { code, text: lines.join('\n') };
}

test('a complete folder passes', async () => {
  const { code, text } = await run(site());
  assert.equal(code, 0, text);
  assert.match(text, /all 14 checks passed/);
});

test('a build that does not render from a nested folder fails and names the folder', async () => {
  const addresses = [];
  const render = async (address) => {
    addresses.push(address);
    return address.includes('/any/sub%20folder/') ? { dom: '<html><body><div id="root"></div></body></html>', log: '' } : { dom: GOOD_DOM, log: '' };
  };
  const { code, text } = await run(site(), render);
  assert.equal(code, 1);
  assert.match(text, /FAIL \/any\/sub folder\/ \(the build runs from a nested folder\): the root element is empty/);
  assert.match(text, /1 of 14 checks failed/);
  assert.equal(addresses.filter((address) => address.endsWith('/any/sub%20folder/#/radar')).length, 1);
});

test('a render that throws in the nested folder gives one line without a path', async () => {
  const render = async (address) => {
    if (address.includes('/any/sub%20folder/')) throw Object.assign(new Error("ENOENT: no such file, open '/somewhere/private/file'"), { code: 'ENOENT' });
    return { dom: GOOD_DOM, log: '' };
  };
  const { code, text } = await run(site(), render);
  assert.equal(code, 1);
  assert.match(text, /FAIL \/any\/sub folder\/ \(the build runs from a nested folder\): the copy could not be made, served or rendered \(ENOENT\)/);
  assert.doesNotMatch(text, /somewhere/);
});

test('a missing data file fails and names it', async () => {
  const { code, text } = await run(site(PAGE, 'data/leagues.json'));
  assert.equal(code, 1);
  assert.match(text, /FAIL \/data\/leagues\.json: status 404/);
});

test('a data file that is not JSON fails', async () => {
  const { code, text } = await run(site(PAGE, null, 'data/meta.json'));
  assert.equal(code, 1);
  assert.match(text, /FAIL \/data\/meta\.json: body is not valid JSON/);
});

test('an absolute script address fails', async () => {
  const { code, text } = await run(site('<!doctype html><script type="module" src="/assets/app.js"></script>'));
  assert.equal(code, 1);
  assert.match(text, /not relative: \/assets\/app\.js/);
});

test('a missing folder says to build first and exits with 1', () => {
  const script = fileURLToPath(new URL('./healthcheck.mjs', import.meta.url));
  const missing = path.join(os.tmpdir(), 'healthcheck-no-such-folder');
  const result = spawnSync(
    process.execPath,
    ['-e', `import(${JSON.stringify(script)}).then(async (m) => { process.exitCode = await m.main(${JSON.stringify(missing)}); })`],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /run the build first/);
});

const log = (message) => `[71799:703935:1112/035515.925501:INFO:CONSOLE:1] "${message}", source: http://127.0.0.1:8765/ (1)\n`;

test('a rendered page with a heading passes', () => {
  assert.deepEqual(judgeScreen({ dom: GOOD_DOM, log: 'noise: INFO:cv_display_link failed\n', playerName: 'Ana Test' }), { ok: true, reason: '' });
});

test('an empty root fails', () => {
  const verdict = judgeScreen({ dom: '<body><div id="root"></div><script></script></body>', log: '' });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /root element is empty/);
});

test('the not-found screen of the frame fails', () => {
  const dom = '<div id="root"><div class="not-found"><h1>This page does not exist.</h1></div></div>';
  assert.match(judgeScreen({ dom, log: '' }).reason, /not-found screen/);
});

test('a data error block fails', () => {
  const dom = '<div id="root"><main><h1>Radar</h1><div class="sheet state-block" role="alert"><h2>x</h2></div></main></div>';
  assert.match(judgeScreen({ dom, log: '' }).reason, /data error block/);
});

test('a console error line fails', () => {
  const verdict = judgeScreen({ dom: GOOD_DOM, log: log('boom message') });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /console error.*boom message/);
});

test('an uncaught exception line fails', () => {
  const verdict = judgeScreen({ dom: GOOD_DOM, log: log('Uncaught Error: uncaught boom') });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /uncaught exception.*uncaught boom/);
});

test('a player card without the player name fails', () => {
  assert.match(judgeScreen({ dom: GOOD_DOM, log: '', playerName: 'Zed Other' }).reason, /Zed Other/);
});

test('the missing-browser message names the places it looked', () => {
  const message = missingBrowserMessage();
  for (const place of BROWSER_PLACES) assert.ok(message.includes(place), place);
});

test('the list of screens holds the five addresses', () => {
  const { screens, problems } = buildScreens([{ id: 'p-1', name: 'Ana Test' }], JSON.parse(TIMEMACHINE));
  assert.deepEqual(problems, []);
  assert.deepEqual(screens.map((screen) => screen.route), ['/blind', '/radar', '/player/p-1', '/time-machine', '/evidence']);
  assert.equal(screens[3].expected, 'Ana Test');
});

test('the time-machine screen fails when the first pick of the last season is missing from the page', async () => {
  const render = async (address) => ({ dom: address.endsWith('#/time-machine') ? GOOD_DOM.replace('Ana Test', 'Someone Else') : GOOD_DOM, log: '' });
  const { code, text } = await run(site(), render);
  assert.equal(code, 1);
  assert.match(text, /FAIL #\/time-machine: the player name "Ana Test" is not in the page/);
  assert.match(text, /1 of 14 checks failed/);
});

test('the profile folder exists during a render and is gone after it', async () => {
  let seen = null;
  const render = async (_address, profileDir) => {
    seen ??= profileDir;
    assert.ok(fs.existsSync(profileDir));
    return { dom: GOOD_DOM, log: '' };
  };
  const { code, text } = await run(site(), render);
  assert.equal(code, 0, text);
  assert.ok(seen);
  assert.equal(fs.existsSync(seen), false);
});

test('the profile folder is removed also when the render throws', async () => {
  let seen = null;
  const render = async (_address, profileDir) => {
    seen = profileDir;
    throw new Error('browser crashed');
  };
  const { code, text } = await run(site(), render);
  assert.equal(code, 1);
  assert.match(text, /FAIL #\/blind: browser crashed/);
  assert.equal(fs.existsSync(seen), false);
  let kept = null;
  await assert.rejects(withProfileFolder(async (dir) => { kept = dir; throw new Error('stop'); }), /stop/);
  assert.equal(fs.existsSync(kept), false);
});

test('a player id with a special character is encoded in the address', () => {
  const { screens } = buildScreens([{ id: 'a/b c#d?e', name: 'Ana Test' }], JSON.parse(TIMEMACHINE));
  assert.equal(screens[2].route, '/player/a%2Fb%20c%23d%3Fe');
});

test('a failure line shows a short, escaped excerpt of the log', () => {
  const raw = `x\u0007\u001b[31m"${'a'.repeat(500)}`;
  const short = excerpt(raw);
  assert.ok(short.length < 200, String(short.length));
  assert.ok(!/[\u0000-\u001f]/.test(short));
  assert.ok(short.includes('\\u0007') && short.includes('\\"') && short.endsWith('...'));
  const verdict = judgeScreen({ dom: GOOD_DOM, log: log('b'.repeat(500)) });
  assert.ok(verdict.reason.length < 260, String(verdict.reason.length));
});

const exported = () => ({ 'data/meta.json': JSON.parse(META), 'data/players.json': JSON.parse(PLAYERS) });

test('exported files have no export problem', () => {
  assert.deepEqual(exportProblems(exported()), []);
});

test('zero training rows fail', () => {
  const files = exported();
  files['data/meta.json'].model.training_rows = 0;
  assert.match(exportProblems(files).join('\n'), /training_rows is 0/);
});

test('a player id that begins with sample- fails', () => {
  const files = exported();
  files['data/players.json'].push({ id: 'sample-a', name: 'X', in_pool: false });
  assert.match(exportProblems(files).join('\n'), /begin with "sample-", first "sample-a"/);
});

test('a pool size that differs from the in_pool records fails', () => {
  const files = exported();
  files['data/meta.json'].pool.up_to_1m = 437;
  assert.match(exportProblems(files).join('\n'), /1 records have in_pool true, meta\.json states a pool of 437/);
});

test('sample files fail the check through the whole run', async () => {
  const root = site();
  fs.writeFileSync(path.join(root, 'data/players.json'), JSON.stringify([{ id: 'sample-a', name: 'Ana Test', in_pool: true }]));
  const { code, text } = await run(root);
  assert.equal(code, 1);
  assert.match(text, /from the export/);
});

test('the words NaN, undefined and [object Object] in the visible text fail a screen', () => {
  for (const word of ['NaN', 'undefined', '[object Object]']) {
    const dom = GOOD_DOM.replace('Ana Test', `Price ${word}`);
    assert.deepEqual(brokenWords(dom), [word]);
    const verdict = judgeScreen({ dom, log: '' });
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /visible text contains/);
  }
});

test('the forbidden words in a script or in a longer word do not fail a screen', () => {
  const dom = GOOD_DOM.replace('<script></script>', '<script>var a = undefined; NaN</script>').replace('Ana Test', 'Nana Banana');
  assert.deepEqual(brokenWords(dom), []);
  assert.equal(judgeScreen({ dom, log: '' }).ok, true);
});
