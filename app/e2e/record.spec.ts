import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from './fixtures';
import { mouseWalk } from './mouse-walk';
import { startScreencast, writeVideo } from './recorder';

/** Only the "record" project runs this: the walkthrough with pauses, filmed with Chrome's screencast into demo/walkthrough.webm. */
test('record the demo walkthrough', async ({ page, walk }, testInfo) => {
  test.setTimeout(240_000);
  const file = resolve(testInfo.config.rootDir, '../../demo/walkthrough.webm');
  const screencast = await startScreencast(page);
  await mouseWalk(page, walk, { station: () => page.waitForTimeout(3000) });
  const frames = await screencast.stop();
  expect(frames.length, `only ${frames.length} screencast frames were captured, at least 20 are needed`).toBeGreaterThanOrEqual(20);

  await writeVideo(page, frames, file);
  expect(existsSync(file), `the video file ${file} was not written`).toBe(true);
  expect(statSync(file).size, 'the video file is smaller than 100 kB').toBeGreaterThan(100_000);
  expect(readFileSync(file).subarray(0, 4).toString('hex'), 'the file does not start with the webm header 1A45DFA3').toBe('1a45dfa3');
  const seconds = ((frames[frames.length - 1]?.timestamp ?? 0) - (frames[0]?.timestamp ?? 0)).toFixed(1);
  console.log(`recorded ${frames.length} frames over ${seconds} s, ${statSync(file).size} bytes`);
});
