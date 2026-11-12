import { expect, type Page } from '@playwright/test';

const num = (s: string): number => Number(/[−-]?\d+(?:\.\d+)?/.exec(s)?.[0].replace('−', '-'));

/** The brief is filled in from the default and at least three players match. Returns the count. */
export async function checkBrief(page: Page): Promise<number> {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What are you looking for?');
  await expect(page.getByRole('group', { name: 'Position' }).locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.getByRole('group', { name: 'Age' }).locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.getByRole('group', { name: 'Budget' }).locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.getByRole('group', { name: 'Most important' }).locator('[aria-pressed="true"]')).toHaveCount(2);
  const count = num(await page.locator('.b-count b').innerText());
  expect(count, 'players matching the default brief').toBeGreaterThanOrEqual(3);
  await expect(page.getByRole('button', { name: /Show me three/ })).toBeEnabled();
  await checkNoLongDecimals(page);
  return count;
}

export type Covered = { before: string };

/** Three candidates, each with name, club and league covered; no price in the page. Returns the page text before the pick. */
export async function checkCovered(page: Page): Promise<Covered> {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Three \w+\. No names\. Pick one\.$/);
  await expect(page.locator('.dossier')).toHaveCount(3);
  await expect(page.locator('.dossier .redact:not(.is-open)')).toHaveCount(6);
  await checkScores(page);
  await expect(page.locator('.dossier .secret')).toHaveCount(0);
  await expect(page.locator('.dossier .after')).toHaveCount(0);
  await expect(page.locator('.verdict')).toHaveCount(0);
  expect(await page.locator('.dossier').allInnerTexts().then((t) => t.join(' ')), 'no price in the candidates before the pick').not.toMatch(/€\s?\d|Price/);
  const before = await page.locator('body').innerText();
  await checkNoLongDecimals(page);
  return { before };
}

/** Every score printed on the three candidates is a whole number from 0 to 100. */
export async function checkScores(page: Page): Promise<void> {
  const scores = await page.locator('.dossier .score b').allInnerTexts();
  expect(scores, 'three scores on each of the three candidates').toHaveLength(9);
  for (const s of scores) {
    expect(s, 'score printed as a whole number').toMatch(/^\d{1,3}$/);
    expect(Number(s)).toBeLessThanOrEqual(100);
  }
}

/** The black overlay of every bar has finished opening: its scale is zero, so no black is left (waits out the 0.45 s). */
export async function checkBarsOpen(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.locator('.dossier .redact').evaluateAll((bars) =>
          bars.every((b) => b.getAttribute('data-open') === 'true' && new DOMMatrixReadOnly(getComputedStyle(b, '::after').transform).a === 0),
        ),
      { message: 'the black bars are fully open', timeout: 5000 },
    )
    .toBe(true);
}

/** After the pick: all three revealed, names that were not in the page before, the verdict. */
export async function checkRevealed(page: Page, covered: Covered): Promise<void> {
  await expect(page.locator('.verdict')).toBeVisible();
  await checkScores(page);
  await expect(page.locator('.verdict-line')).toHaveText(/^(You and the model agree: [ABC]\.|You picked [ABC]\. The model picks [ABC]\.)$/);
  await expect(page.locator('.dossier .redact[data-open="true"]')).toHaveCount(6);
  await expect(page.locator('.dossier .after')).toHaveCount(3);
  await checkBarsOpen(page);
  const names = await page.locator('.dossier .ident-name .secret').allInnerTexts();
  expect(names).toHaveLength(3);
  for (const n of names) {
    expect(n.length).toBeGreaterThan(2);
    expect(covered.before, `name "${n}" must not be in the page before the pick`).not.toContain(n);
  }
  await checkNoLongDecimals(page);
  await expect(page.locator('.dossier.picked')).toHaveCount(1);
  await expect(page.getByText('Model’s pick')).toHaveCount(1);
}

/** The four rating steps of the card reconcile: step 1 divided by the league factor (from step 2's tip) gives step 3. */
export async function checkRatingReconciles(page: Page): Promise<void> {
  await expect(page).toHaveURL(/#\/player\//);
  const steps = page.locator('.flow .step');
  await expect(steps).toHaveCount(4);
  const figure = (i: number) => steps.nth(i).locator('b').innerText();
  const did = num(await figure(0));
  const leaguePct = num(await figure(1));
  const scale = num(await figure(2));
  const tip = (await steps.nth(1).getAttribute('data-tip')) ?? '';
  const factor = Number(/League factor ([\d.]+)/.exec(tip)?.[1]);
  expect(factor, `league factor in the tip "${tip}"`).toBeGreaterThan(0);
  expect(Math.abs(did / factor - scale), `${did} / ${factor} should give ${scale}`).toBeLessThanOrEqual(0.02);
  expect(Math.abs((1 / factor - 1) * 100 - leaguePct), 'league step percentage').toBeLessThanOrEqual(1);
  const scaleTip = (await steps.nth(2).getAttribute('data-tip')) ?? '';
  expect(scaleTip).toBe(`${(await figure(0)).trim()} divided by ${factor.toFixed(2)}`);
  const rating = num(await figure(3));
  expect(rating).toBeGreaterThanOrEqual(0);
  expect(rating).toBeLessThanOrEqual(100);
  await checkNoLongDecimals(page);
}

/** The card of a pool player shows a projection figure, the similar panel (rows or its empty sentence) and a note. */
export async function checkCardPanels(page: Page): Promise<void> {
  await expect(page.locator('.proj-head b').first()).toHaveText(/€\d/);
  const similar = page.locator('.p-row3 .simrow');
  if ((await similar.count()) === 0) await expect(page.getByText('No similar player inside this budget.')).toBeVisible();
  await expect(page.locator('.p-row3 .say').first()).not.toBeEmpty();
  await checkNoLongDecimals(page);
}

/** The rating column of the first radar rows is a plausible 0 to 100. */
export async function checkRadarRatings(page: Page): Promise<void> {
  const meters = page.locator('.r-table [role="meter"]');
  await expect(meters.first()).toBeVisible();
  const n = Math.min(await meters.count(), 10);
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const v = Number(await meters.nth(i).getAttribute('aria-valuenow'));
    expect(v, `rating of radar row ${i + 1}`).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
    expect(Number(await meters.nth(i).locator('.m-val').innerText())).toBe(v);
  }
  await checkNoLongDecimals(page);
}

/** The radar's title carries the number of players; returns it. */
export async function radarCount(page: Page): Promise<number> {
  const title = await page.getByRole('heading', { level: 1 }).innerText();
  const n = /^(\d+) young players? fits?|^(\d+) young players? fit/.exec(title.replace(/,/g, ''));
  expect(n, `radar title "${title}"`).not.toBeNull();
  await checkNoLongDecimals(page);
  return Number(n?.[1] ?? n?.[2]);
}

/** Before the reveal: the title counts the rows of the list and no outcome is in the page. Returns the row count. */
export async function checkTimeThen(page: Page): Promise<number> {
  await expect(page.locator('.tm-list .tm-row:not(.tm-head)').first()).toBeVisible();
  const rows = await page.locator('.tm-list .tm-row:not(.tm-head)').count();
  const title = await page.getByRole('heading', { level: 1 }).innerText();
  expect(title).toMatch(/The radar shows (\d+) players under/);
  expect(Number(/shows (\d+) players/.exec(title)?.[1]), 'title against list').toBe(rows);
  await expect(page.locator('.tm-list [role="img"]')).toHaveCount(0);
  await expect(page.locator('.tm-list .later:not(:empty)')).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toMatch(/made it/i);
  await checkNoLongDecimals(page);
  return rows;
}

/** After the reveal: the number in the title equals the made-it marks in the list. */
export async function checkTimeRevealed(page: Page, rows: number): Promise<number> {
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toHaveText(/\d+ of the \d+ made it\./);
  const m = /(\d+) of the (\d+) made it/.exec(await title.innerText());
  const hits = Number(m?.[1]);
  expect(Number(m?.[2]), 'title total against list').toBe(rows);
  await expect(page.locator('.tm-list [role="img"][aria-label="made it"]')).toHaveCount(hits);
  await expect(page.locator('.tm-list [role="img"]')).toHaveCount(rows);
  await checkNoLongDecimals(page);
  return hits;
}

/** Five bars on the evidence screen. */
export async function checkBars(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Does it work? We tested it on the past.');
  await expect(page.locator('.bars').first().locator('.bar-row')).toHaveCount(5);
  await checkNoLongDecimals(page);
}

export async function checkDetailsOn(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: /Details/ })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('.detail').count(), 'detail blocks').toBeGreaterThanOrEqual(2);
  await checkNoLongDecimals(page);
}

/** The visible text holds no number with three or more decimal places. */
export async function checkNoLongDecimals(page: Page): Promise<void> {
  const text = await page.locator('body').innerText();
  const long = text.match(/\d+\.\d{3,}/g);
  expect(long, 'numbers with three or more decimals in the visible text').toBeNull();
}
