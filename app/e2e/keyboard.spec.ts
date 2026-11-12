import { checkBars, checkRadarRatings, checkBrief, checkCovered, checkDetailsOn, checkRatingReconciles, checkRevealed, checkTimeRevealed, checkTimeThen, radarCount } from './checks';
import { expect, test } from './fixtures';

test('demo walkthrough with the keyboard only', async ({ page, walk }) => {
  const key = (k: string) => page.keyboard.press(k);

  await walk.open('/#/blind', async () => {
    await expect(page.locator('.b-count b')).toBeVisible();
  });
  await checkBrief(page);

  await key('Enter');
  const covered = await checkCovered(page);

  await key('r');
  await checkRevealed(page, covered);

  await key('ArrowRight');
  await checkRatingReconciles(page);

  await key('ArrowRight');
  await expect(page).toHaveURL(/#\/radar/);
  await expect(page.locator('.r-table')).toBeVisible();
  await checkRadarRatings(page);
  const before = await radarCount(page);

  const slider = page.locator('#radar-budget');
  await slider.focus();
  const now = Number(await slider.inputValue());
  await key(now === 0 ? 'ArrowRight' : 'Home');
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(new RegExp(`^${before} young`));
  expect(await radarCount(page), 'radar title number after the budget change').not.toBe(before);
  await key('Tab');

  await key('ArrowRight');
  await expect(page).toHaveURL(/#\/time-machine/);
  const rows = await checkTimeThen(page);
  await key('r');
  await checkTimeRevealed(page, rows);

  await key('ArrowRight');
  await expect(page).toHaveURL(/#\/evidence/);
  await checkBars(page);
  await key('d');
  await checkDetailsOn(page);
});
