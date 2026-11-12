import { describe, expect, it, vi } from 'vitest';
import { fontRequests, loadFontsUpFront } from '../src/lib/fonts';

describe('fonts loaded up front', () => {
  it('asks for both families, three weights and a letter from each Latin file', () => {
    const requests = fontRequests();
    expect(requests).toHaveLength(12);
    expect(requests.map((r) => r.font)).toContain('600 1em "IBM Plex Sans"');
    expect(requests.map((r) => r.font)).toContain('400 1em "IBM Plex Mono"');
    expect(requests.map((r) => r.text)).toContain('Ł');
  });

  it('starts every request', async () => {
    const load = vi.fn().mockResolvedValue([]);
    await loadFontsUpFront({ load });
    expect(load).toHaveBeenCalledTimes(12);
  });
});
