/**
 * Characters of a text the way the API counts them (Python `len`: Unicode code points), not
 * UTF-16 units: an emoji is one character here, as it is there.
 */
export function countCharacters(text: string): number {
  return Array.from(text).length;
}
