import { expect, test } from './fixtures';

test('a deep link opens directly on the static server', async ({ page }) => {
  await page.goto('/radar');
  await expect(page).toHaveURL(/#\/radar$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('young player');
  await expect(page.locator('.r-table')).toBeVisible();
});

test('the start address opens on section 01, the similar players', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/similar$/);
  await expect(page.locator('.sim-pick').first()).toBeVisible();
});

test('an old link to the blind pick opens the screen that took its place', async ({ page }) => {
  await page.goto('/#/blind');
  await expect(page).toHaveURL(/#\/similar$/);
  await expect(page.locator('.sim-pick').first()).toBeVisible();
});

test('no screen, in any sport or language, links to or names the blind pick', async ({ page }) => {
  const old = /blind pick|slijep|kör seçim|盲选/i;
  await page.goto('/');
  await expect(page.locator('.sim-pick').first()).toBeVisible();
  for (const lang of ['en', 'bs', 'tr', 'zh']) {
    await page.locator(`.langs button[lang="${lang}"]`).click();
    for (const sport of [0, 1, 2]) {
      for (const route of ['/similar', '/radar', '/time-machine', '/evidence', '/account', '/my-picks', '/nowhere']) {
        await page.goto(`/#${route}`);
        const seg = page.locator('.seg').nth(sport);
        if (await seg.count()) await seg.click();
        if (route === '/similar') {
          await expect(page.locator('.sim-pick, .sim-ref').first()).toBeVisible();
          if (!(await page.locator('.sim-ref').count())) await page.locator('.sim-pick').first().click();
          await expect(page.locator('.sim-ref')).toBeVisible();
        }
        await page.waitForTimeout(150);
        const where = `${lang} ${route} sport ${sport}`;
        expect(await page.locator('body').innerText(), `text of ${where}`).not.toMatch(old);
        const links = await page.locator('a[href]').evaluateAll((all) => all.map((a) => a.getAttribute('href') ?? ''));
        expect(links.filter((href) => /blind/i.test(href)), `links of ${where}`).toEqual([]);
      }
      // The card of a similar player and its way back.
      await page.goto('/#/similar');
      await page.locator('.seg').nth(sport).click();
      await expect(page.locator('.sim-pick, .sim-ref').first()).toBeVisible();
      if (!(await page.locator('.sim-ref').count())) await page.locator('.sim-pick').first().click();
      const open = page.locator('.sim-open').first();
      if (await open.count()) {
        await open.click();
        await expect(page.locator('a.back')).toBeVisible();
        expect(await page.locator('body').innerText(), `card text ${lang} sport ${sport}`).not.toMatch(old);
        await page.locator('a.back').click();
        await expect(page).toHaveURL(/#\/similar$/);
      }
    }
  }
});
