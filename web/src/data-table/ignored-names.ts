/** Longest name of an ignored parameter that is shown; the rest is cut with an ellipsis. */
export const MAX_NAME_LENGTH = 32;
/** How many names are listed before "and N more". */
export const MAX_NAMES = 5;

export interface IgnoredSummary {
  /** Names ready to show: cut to `MAX_NAME_LENGTH`, at most `MAX_NAMES`. */
  shown: string[];
  /** How many more were left out. */
  hidden: number;
}

/**
 * The names of ignored URL parameters come straight from the address, which anyone can craft in
 * a link: a long or numerous list could push fake text into the page. Only a few short names are
 * shown (React escapes them; this limits their size).
 */
export function summarizeIgnored(names: readonly string[]): IgnoredSummary {
  const cut = (name: string) =>
    name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH)}…` : name;
  return {
    shown: names.slice(0, MAX_NAMES).map(cut),
    hidden: Math.max(0, names.length - MAX_NAMES),
  };
}
