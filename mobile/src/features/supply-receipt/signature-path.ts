export const SIGNATURE_WIDTH = 320;
export const SIGNATURE_HEIGHT = 160;
export const MAX_SIGNATURE_POINTS = 4096;
export const MAX_SIGNATURE_STROKES = 128;
/** Stable normalized coordinates survive rotation and text-scale changes. */
export function signaturePoint(input: {
  x: number;
  y: number;
  width: number;
  height: number;
}): string {
  const x = Math.round(
    Math.max(0, Math.min(SIGNATURE_WIDTH, (input.x / input.width) * SIGNATURE_WIDTH)),
  );
  const y = Math.round(
    Math.max(0, Math.min(SIGNATURE_HEIGHT, (input.y / input.height) * SIGNATURE_HEIGHT)),
  );
  return `${String(x)},${String(y)}`;
}
