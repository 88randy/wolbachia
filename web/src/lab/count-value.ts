/** Accept only an explicit, interoperable nonnegative base-ten integer; zero is a count. */
export function countValue(text: string): number | undefined {
  if (!/^[0-9]+$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : undefined;
}
