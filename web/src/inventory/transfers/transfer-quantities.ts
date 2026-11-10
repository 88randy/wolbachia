const SCALE = 1_000_000n;
const DECIMAL = /^(\d{1,14})(?:\.(\d{1,6}))?$/;
/** Decimal(20,6) arithmetic never rounds physical stock through Number. */
export function quantityUnits(value: string): bigint | null {
  const match = DECIMAL.exec(value);
  return match ? BigInt(match[1] ?? "0") * SCALE + BigInt((match[2] ?? "").padEnd(6, "0")) : null;
}
export function quantityText(units: bigint): string {
  const fraction = (units % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return `${String(units / SCALE)}${fraction ? `.${fraction}` : ""}`;
}
