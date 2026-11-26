import type { MotorcycleOption } from "./domain.ts";

const QR_PREFIX = /^wbf:1:motorcycle:(.+)$/;

/**
 * Finds the motorcycle a scanned QR points to, only inside the downloaded fleet list. The QR holds
 * the fleet code (optionally as `wbf:1:motorcycle:<code>`) or the plate. [ASSUMPTION] no fixed
 * motorcycle QR format exists yet.
 */
export function matchMotorcycle(
  scanned: string,
  options: readonly MotorcycleOption[],
): MotorcycleOption | null {
  const value = scanned.trim();
  const needle = (QR_PREFIX.exec(value)?.[1] ?? value).toLowerCase();
  if (!needle) return null;
  return (
    options.find(
      (option) => option.code.toLowerCase() === needle || option.plate.toLowerCase() === needle,
    ) ?? null
  );
}
