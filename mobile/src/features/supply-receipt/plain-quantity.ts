/** "2.000000" is shown as "2" and "2.500000" as "2.5"; a value without decimals is left alone. */
export function plainQuantity(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}
