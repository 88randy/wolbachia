export const SIGNATURE_WIDTH = 320;
export const SIGNATURE_HEIGHT = 160;
export const MAX_SIGNATURE_POINTS = 4096;
export const MAX_SIGNATURE_STROKES = 128;
/** A tap jitters a few units; any real initial or scribble crosses 10 % of the pad width. */
export const MIN_SIGNATURE_SPAN = SIGNATURE_WIDTH / 10;
export const MIN_SIGNATURE_POINTS = 5;
/**
 * Stable normalized coordinates survive rotation and text-scale changes.
 * The touch and the pad size come in separately: the pad's layout also has x/y (its offset in the
 * parent), which once overwrote the touch and collapsed every signature into a single dot.
 */
export function signaturePoint(
  touch: { readonly locationX: number; readonly locationY: number },
  pad: { readonly width: number; readonly height: number },
): string {
  const x = Math.round(
    Math.max(0, Math.min(SIGNATURE_WIDTH, (touch.locationX / pad.width) * SIGNATURE_WIDTH)),
  );
  const y = Math.round(
    Math.max(0, Math.min(SIGNATURE_HEIGHT, (touch.locationY / pad.height) * SIGNATURE_HEIGHT)),
  );
  return `${String(x)},${String(y)}`;
}
/** True once the strokes hold enough points spread over a real width or height, never for a dot. */
export function isMeaningfulSignature(strokes: readonly string[]): boolean {
  let count = 0;
  const box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  for (const stroke of strokes)
    for (const [, x, y] of stroke.matchAll(/(\d+),(\d+)/g)) {
      count += 1;
      box.left = Math.min(box.left, Number(x));
      box.right = Math.max(box.right, Number(x));
      box.top = Math.min(box.top, Number(y));
      box.bottom = Math.max(box.bottom, Number(y));
    }
  return (
    count >= MIN_SIGNATURE_POINTS &&
    (box.right - box.left >= MIN_SIGNATURE_SPAN || box.bottom - box.top >= MIN_SIGNATURE_SPAN)
  );
}
