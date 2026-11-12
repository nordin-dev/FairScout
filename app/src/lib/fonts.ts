const FAMILIES = ['IBM Plex Sans', 'IBM Plex Mono'] as const;
const WEIGHTS = [400, 500, 600] as const;
/** One Latin letter and one letter only the Latin Extended file holds (player names such as Łukasz or Šeško). */
const SAMPLES = ['A', 'Ł'] as const;

/** The font requests the app will make, as `document.fonts.load` arguments: every family and weight, in both Latin files. */
export function fontRequests(): { font: string; text: string }[] {
  return FAMILIES.flatMap((family) => WEIGHTS.flatMap((weight) => SAMPLES.map((text) => ({ font: `${weight} 1em "${family}"`, text }))));
}

/** Starts every font file the app can need at once, so none is fetched later while the scout is mid-demo. */
export function loadFontsUpFront(fonts: Pick<FontFaceSet, 'load'> = document.fonts): Promise<unknown> {
  return Promise.all(fontRequests().map((r) => fonts.load(r.font, r.text)));
}
