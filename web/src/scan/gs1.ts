/**
 * GS1 element strings printed by suppliers (GS1-128, GS1 DataMatrix, GS1 QR): application
 * identifiers (AI) followed by their data, e.g. `(01)07501055300013(17)271231(10)LOT42`.
 * Pure functions, no DOM: the receiving form and its tests use them directly.
 */

export interface Gs1Data {
  /** GTIN-14 of the product (AI 01), check digit verified. */
  gtin: string | null;
  /** Batch or lot code (AI 10). */
  lot: string | null;
  /** Expiry as `YYYY-MM-DD` (AI 17). */
  expiryDate: string | null;
  /** Production date as `YYYY-MM-DD` (AI 11). */
  productionDate: string | null;
  /** Quantity as a plain integer text (AI 30, or AI 37 when 30 is absent). */
  quantity: string | null;
}

/** FNC1 separator that ends a variable-length field (ASCII 29), plus its printable stand-in. */
// eslint-disable-next-line no-control-regex -- ASCII 29 (GS) is the FNC1 separator of GS1 data
const GROUP_SEPARATOR = /[\u001d␝]/;
const SYMBOLOGY_IDENTIFIER = /^\][A-Za-z][0-9A-Za-z]/;

/** AIs whose data has a fixed length (digits only). */
const FIXED: Readonly<Record<string, number>> = {
  "00": 18,
  "01": 14,
  "02": 14,
  "11": 6,
  "12": 6,
  "13": 6,
  "15": 6,
  "16": 6,
  "17": 6,
  "20": 2,
};
/** AIs whose data runs up to this many characters or to the next separator. */
const VARIABLE: Readonly<Record<string, number>> = {
  "10": 20,
  "21": 20,
  "22": 20,
  "30": 8,
  "37": 8,
  "240": 30,
  "241": 30,
  "250": 30,
  "251": 30,
};
const MEASURE_AI = /^3[1-6]\d\d$/;

type Pairs = Map<string, string>;

function aiAt(text: string, from: number): { ai: string; fixed: number | null } | null {
  for (const length of [2, 3, 4]) {
    const ai = text.slice(from, from + length);
    if (ai.length < length || !/^\d+$/.test(ai)) return null;
    const fixed = FIXED[ai];
    if (fixed !== undefined) return { ai, fixed };
    if (length === 4 && MEASURE_AI.test(ai)) return { ai, fixed: 6 };
    if (VARIABLE[ai] !== undefined) return { ai, fixed: null };
  }
  return null;
}

function readParenthesized(text: string): Pairs | null {
  const pairs: Pairs = new Map();
  const pattern = /\((\d{2,4})\)([^(]*)/gy;
  let consumed = 0;
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    const [whole, ai, data] = match;
    if (ai === undefined || data === undefined || data === "") return null;
    pairs.set(ai, data.replace(GROUP_SEPARATOR, ""));
    consumed += whole.length;
  }
  return consumed === text.length && pairs.size > 0 ? pairs : null;
}

function readPlain(text: string): Pairs | null {
  const pairs: Pairs = new Map();
  let at = 0;
  while (at < text.length) {
    if (GROUP_SEPARATOR.test(text.charAt(at))) {
      at += 1;
      continue;
    }
    const found = aiAt(text, at);
    if (found === null) return null;
    const start = at + found.ai.length;
    let end: number;
    if (found.fixed !== null) {
      end = start + found.fixed;
      if (end > text.length) return null;
    } else {
      const rest = text.slice(start);
      const separator = rest.search(GROUP_SEPARATOR);
      end = separator === -1 ? text.length : start + separator;
      if (end - start > (VARIABLE[found.ai] ?? 0)) return null;
    }
    const data = text.slice(start, end);
    if (data === "") return null;
    pairs.set(found.ai, data);
    at = end;
  }
  return pairs.size > 0 ? pairs : null;
}

/** Mod-10 check digit of a GTIN (any of the 8, 12, 13 or 14 digit forms). */
export function isValidGtin(digits: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return false;
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let index = 0; index < body.length; index += 1) {
    const digit = Number(body.charAt(body.length - 1 - index));
    sum += digit * (index % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(digits.slice(-1));
}

/** GTIN-8/12/13 padded with zeros to the canonical GTIN-14 the catalog stores. */
export function toGtin14(digits: string): string {
  return digits.padStart(14, "0");
}

function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `YYMMDD` to `YYYY-MM-DD`; day `00` means the last day of the month (GS1 rule). */
function toIsoDate(yymmdd: string): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const year = 2000 + Number(yymmdd.slice(0, 2));
  const month = Number(yymmdd.slice(2, 4));
  const rawDay = Number(yymmdd.slice(4, 6));
  if (month < 1 || month > 12) return null;
  const last = lastDayOf(year, month);
  const day = rawDay === 0 ? last : rawDay;
  if (day > last) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${String(year)}-${pad(month)}-${pad(day)}`;
}

function toQuantity(digits: string | undefined): string | null {
  if (digits === undefined || !/^\d+$/.test(digits)) return null;
  return String(Number(digits));
}

function toData(pairs: Pairs): Gs1Data | null {
  const gtin = pairs.get("01") ?? null;
  if (gtin !== null && !isValidGtin(gtin)) return null;
  const lot = pairs.get("10") ?? null;
  if (gtin === null && lot === null) return null;
  const expiry = pairs.get("17");
  const production = pairs.get("11");
  return {
    gtin,
    lot,
    expiryDate: expiry === undefined ? null : toIsoDate(expiry),
    productionDate: production === undefined ? null : toIsoDate(production),
    quantity: toQuantity(pairs.get("30") ?? pairs.get("37")),
  };
}

/**
 * Reads a GS1 element string (parenthesized, or raw with FNC1/GS separators). Returns `null` when
 * the text is not GS1 (a plain label code), is malformed, or its GTIN check digit fails, so a
 * misread never fills a form with wrong data. A GS1 string needs at least a GTIN or a lot.
 */
export function parseGs1(raw: string): Gs1Data | null {
  const text = raw.replace(SYMBOLOGY_IDENTIFIER, "").trim();
  if (text === "") return null;
  const pairs = text.startsWith("(") ? readParenthesized(text) : readPlain(text);
  return pairs === null ? null : toData(pairs);
}

/**
 * What a supplier label carries: a GS1 element string, or just a retail barcode (EAN-13, UPC-A,
 * GTIN-14) that is only the product number. A bare valid GTIN wins over the GS1 reading, since a
 * number such as `1012345678905` could otherwise be taken for "AI 10, lot 12345678905".
 */
export function parseSupplierCode(raw: string): Gs1Data | null {
  const text = raw.replace(SYMBOLOGY_IDENTIFIER, "").trim();
  if (isValidGtin(text)) {
    return {
      gtin: toGtin14(text),
      lot: null,
      expiryDate: null,
      productionDate: null,
      quantity: null,
    };
  }
  return parseGs1(text);
}
