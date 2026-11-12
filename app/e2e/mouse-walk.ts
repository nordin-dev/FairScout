import { checkBars, checkRadarRatings, checkBrief, checkCovered, checkDetailsOn, checkCardPanels, checkRatingReconciles, checkRevealed, checkTimeRevealed, checkTimeThen, radarCount } from './checks';
import { expect, type Page, type Walk } from './fixtures';

export type WalkOptions = {
  /** Runs once the first page has loaded its data and fonts, before the first click. */
  afterLoad?: () => Promise<void>;
  /** Runs at each station; the recording uses it to pause so that a viewer can follow. */
  station?: () => Promise<void>;
};

/** The whole demo walkthrough with the mouse, shared by the walkthrough, the offline run and the recording. */
export async function mouseWalk(page: Page, walk: Walk, { afterLoad, station }: WalkOptions = {}): Promise<void> {
  const rest = station ?? (async () => undefined);
  await walk.open('/#/blind', async () => {
    await expect(page.locator('.b-count b')).toBeVisible();
  });
  await afterLoad?.();

  await checkBrief(page);
  await walk.shot('01-brief');
  await rest();

  await page.getByRole('button', { name: /Show me three/ }).click();
  const covered = await checkCovered(page);
  await walk.shot('02-comparison');
  await rest();

  await page.getByRole('button', { name: 'Pick player B' }).click();
  await checkRevealed(page, covered);
  await walk.shot('03-revealed');
  await rest();

  await page.getByRole('button', { name: /See why/ }).click();
  await checkRatingReconciles(page);
  await checkCardPanels(page);
  await walk.shot('04-card');
  await rest();

  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Radar/ }).click();
  await expect(page).toHaveURL(/#\/radar/);
  await expect(page.locator('.r-table')).toBeVisible();
  await checkRadarRatings(page);
  const before = await radarCount(page);
  await walk.shot('05-radar-before');
  await rest();

  const slider = page.locator('#radar-budget');
  const now = Number(await slider.inputValue());
  await slider.fill(now === 100_000 ? '1000000' : '100000');
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(new RegExp(`^${before} young`));
  const after = await radarCount(page);
  expect(after, 'radar title number after the budget change').not.toBe(before);
  await walk.shot('06-radar-after');
  await rest();

  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Time machine/ }).click();
  await expect(page).toHaveURL(/#\/time-machine/);
  const rows = await checkTimeThen(page);
  await walk.shot('07-time-machine');
  await rest();

  await page.getByRole('button', { name: /Show what happened/ }).click();
  await checkTimeRevealed(page, rows);
  await walk.shot('08-time-machine-revealed');
  await rest();

  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /Evidence/ }).click();
  await expect(page).toHaveURL(/#\/evidence/);
  await checkBars(page);
  await walk.shot('09-evidence');
  await rest();

  await page.getByRole('button', { name: /Details/ }).click();
  await checkDetailsOn(page);
  await walk.shot('10-evidence-details');
  await rest();
}
