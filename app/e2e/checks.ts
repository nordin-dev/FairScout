import { expect, type Page } from '@playwright/test';

const num = (s: string): number => Number(/[−-]?\d+(?:\.\d+)?/.exec(s)?.[0].replace('−', '-'));

const euros = (s: string): number => {
  const m = /€\s?(\d+(?:\.\d+)?)([kM]?)/.exec(s);
  return m ? Number(m[1]) * (m[2] === 'M' ? 1_000_000 : m[2] === 'k' ? 1_000 : 1) : NaN;
};

/** Section 01 before a player is named: the question, one budget chosen, six players to start from, no match yet. */
export async function checkAsk(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Who can you not afford?');
  await expect(page.getByRole('group', { name: 'Budget', exact: true }).locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('.sim-pick')).toHaveCount(6);
  await expect(page.locator('.sim-card')).toHaveCount(0);
  await checkNoLongDecimals(page);
}

/** After a player is named: one to three similar players, most similar first, each inside the budget and cheaper than him. */
export async function checkSimilar(page: Page): Promise<void> {
  const title = await page.getByRole('heading', { level: 1 }).innerText();
  expect(title).toMatch(/^Like .+\. Within €\d+(?:\.\d+)?[kM]\.$/);
  const budget = euros(title.slice(title.lastIndexOf('€')));
  const cards = await page.locator('.sim-card').count();
  expect(cards, 'similar players shown').toBeGreaterThanOrEqual(1);
  expect(cards).toBeLessThanOrEqual(3);
  const scores = await page.locator('.sim-card .sim-scores b').allInnerTexts();
  expect(scores, 'three scores on each similar player').toHaveLength(cards * 3);
  for (const s of scores) {
    expect(s, 'score printed as a whole number').toMatch(/^\d{1,3}$/);
    expect(Number(s)).toBeLessThanOrEqual(100);
  }
  const alike = (await page.locator('.sim-card .sim-pct b').allInnerTexts()).map(num);
  expect(alike, 'most similar first').toEqual([...alike].sort((a, b) => b - a));
  const wanted = euros(await page.locator('.sim-ref .sim-cost b').innerText());
  for (const text of await page.locator('.sim-card .sim-cost b').allInnerTexts()) {
    expect(euros(text), `price ${text} is inside the budget`).toBeLessThanOrEqual(budget);
    expect(euros(text), `price ${text} is below the named player's`).toBeLessThan(wanted);
  }
  await checkNoLongDecimals(page);
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
