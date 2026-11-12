import { checkAsk, checkBars, checkRadarRatings, checkDetailsOn, checkRatingReconciles, checkSimilar, checkTimeRevealed, checkTimeThen, radarCount } from './checks';
import { expect, test } from './fixtures';

test('demo walkthrough with the keyboard only', async ({ page, walk }) => {
  const key = (k: string) => page.keyboard.press(k);

  await walk.open('/#/similar', async () => {
    await expect(page.locator('.sim-pick').first()).toBeVisible();
  });
  await checkAsk(page);

  // The test puts the focus in the search box; the name, the move to the result and the choice are keys.
  await page.locator('#sim-search').focus();
  await page.keyboard.type('demirovic');
  await expect(page.locator('.sim-pick')).toHaveCount(1);
  await key('Tab');
  await key('Enter');
  await checkSimilar(page);

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
  const step = now === 1_000_000 ? -50_000 : 50_000;
  await key(step > 0 ? 'ArrowRight' : 'ArrowLeft');
  expect(Number(await slider.inputValue()), 'one arrow press moves the budget by one step').toBe(now + step);
  await key(now === 1_000_000 ? 'Home' : 'End');
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
