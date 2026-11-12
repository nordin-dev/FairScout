import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CDPSession, Page } from '@playwright/test';

type Frame = { data: string; timestamp: number };

const SLICE = 3 * 1024 * 1024;

/** Starts a Chrome screencast of `page`; `stop` ends it and returns the frames in order. */
export async function startScreencast(page: Page): Promise<{ stop: () => Promise<Frame[]> }> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  const frames: Frame[] = [];
  cdp.on('Page.screencastFrame', (event) => {
    frames.push({ data: event.data, timestamp: event.metadata.timestamp ?? 0 });
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });
  return {
    stop: async () => {
      await cdp.send('Page.stopScreencast');
      await cdp.detach();
      return frames;
    },
  };
}

/** Replays the frames in real time on a canvas of a second page, records the canvas as webm and writes `file`. */
export async function writeVideo(page: Page, frames: Frame[], file: string): Promise<void> {
  const player = await page.context().newPage();
  try {
    await player.goto('about:blank');
    await player.bringToFront();
    await player.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1440;
      canvas.height = 900;
      document.body.append(canvas);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no 2d canvas context');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, 1440, 900);
      const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      const chunks: Blob[] = [];
      // A high bit rate keeps small text readable right after a change of screen.
      const recorder = new MediaRecorder(canvas.captureStream(15), { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 8_000_000 });
      recorder.ondataavailable = (e) => chunks.push(e.data);
      const w = window as unknown as Record<string, unknown>;
      let current: HTMLImageElement | null = null;
      w.__draw = async (data: string) => {
        const image = new Image();
        image.src = `data:image/jpeg;base64,${data}`;
        await image.decode();
        current = image;
        context.drawImage(image, 0, 0, 1440, 900);
      };
      // A still screen would give the encoder no new frames; repainting the last one lets it sharpen the picture.
      setInterval(() => {
        if (current) context.drawImage(current, 0, 0, 1440, 900);
      }, 66);
      w.__chunks = chunks;
      w.__recorder = recorder;
      recorder.start(1000);
    });
    const first = frames[0]?.timestamp ?? 0;
    const began = Date.now();
    for (const frame of frames) {
      const wait = (frame.timestamp - first) * 1000 - (Date.now() - began);
      if (wait > 0) await player.waitForTimeout(wait);
      await player.evaluate((d) => (window as unknown as { __draw: (x: string) => Promise<void> }).__draw(d), frame.data);
    }
    await player.waitForTimeout(1000);
    await player.evaluate(
      () =>
        new Promise<void>((done) => {
          const w = window as unknown as { __recorder: MediaRecorder; __chunks: Blob[]; __blob?: Blob };
          w.__recorder.onstop = () => {
            w.__blob = new Blob(w.__chunks, { type: 'video/webm' });
            done();
          };
          w.__recorder.stop();
        }),
    );
    const size = await player.evaluate(() => (window as unknown as { __blob: Blob }).__blob.size);
    const parts: Buffer[] = [];
    for (let at = 0; at < size; at += SLICE) {
      const base64 = await player.evaluate(
        ([from, to]) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL((window as unknown as { __blob: Blob }).__blob.slice(from, to));
          }),
        [at, at + SLICE] as const,
      );
      parts.push(Buffer.from(base64, 'base64'));
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.concat(parts));
  } finally {
    await player.close();
  }
}
