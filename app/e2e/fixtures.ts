import { expect, test as base, type Page } from '@playwright/test';

export type Walk = {
  /** Opens the app and waits until data and fonts are in; from then on any network request fails the test. */
  open: (path: string, ready: () => Promise<void>) => Promise<void>;
  shot: (name: string) => Promise<void>;
};

type Guard = { arm: () => void };

export const test = base.extend<{ guard: Guard; walk: Walk }>({
  // Automatic: every spec fails on a console error, an uncaught page error and, once armed, any request.
  guard: [
    async ({ page }, provide) => {
      const problems: string[] = [];
      let armed = false;
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`console error: ${m.text()} (${m.location().url})`);
      });
      page.on('pageerror', (e) => problems.push(`uncaught page error: ${e.message}`));
      page.on('request', (r) => {
        if (armed) problems.push(`network request after the first load: ${r.method()} ${r.url()}`);
      });
      page.on('requestfailed', (r) => {
        problems.push(`request failed: ${r.url()}`);
      });
      await provide({ arm: () => (armed = true) });
      expect(problems, 'console errors, page errors and late network requests').toEqual([]);
    },
    { auto: true },
  ],
  walk: async ({ page, guard }, provide, testInfo) => {
    const walk: Walk = {
      open: async (path, ready) => {
        await page.goto(path, { waitUntil: 'networkidle' });
        await ready();
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        await page.waitForLoadState('networkidle');
        guard.arm();
      },
      shot: async (name) => {
        await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
      },
    };
    await provide(walk);
  },
});

export { expect };
export type { Page };

/** The whole text of the page, for "is this word in the page" checks. */
export const pageText = (page: Page): Promise<string> => page.locator('body').innerText();

export const countIn = (text: string): number => Number(/\d+/.exec(text.replace(/[,\s]/g, ''))?.[0] ?? NaN);
