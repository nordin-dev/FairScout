import { expect, test } from './fixtures';

test('a deep link opens directly on the static server', async ({ page }) => {
  await page.goto('/radar');
  await expect(page).toHaveURL(/#\/radar$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('young player');
  await expect(page.locator('.r-table')).toBeVisible();
});

test('the start address opens on the blind pick', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/blind$/);
  await expect(page.locator('.b-count b')).toBeVisible();
});
