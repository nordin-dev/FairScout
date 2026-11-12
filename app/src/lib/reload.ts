/** Loads the app again at a hash address. Unlike a link to the same hash, this also works from that very address. */
export function reloadAt(hash: string): void {
  window.location.hash = hash;
  window.location.reload();
}
