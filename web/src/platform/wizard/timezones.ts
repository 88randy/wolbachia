/** Countries offered by the wizard and their usual time zones (IANA names, shown as cities). */
export const COUNTRIES = ["MX", "GT", "HN", "SV", "CO", "PE", "BR", "US"] as const;
export type CountryCode = (typeof COUNTRIES)[number];

const ZONES: Record<CountryCode, readonly string[]> = {
  MX: [
    "America/Mexico_City",
    "America/Merida",
    "America/Cancun",
    "America/Monterrey",
    "America/Matamoros",
    "America/Chihuahua",
    "America/Mazatlan",
    "America/Hermosillo",
    "America/Bahia_Banderas",
    "America/Tijuana",
  ],
  GT: ["America/Guatemala"],
  HN: ["America/Tegucigalpa"],
  SV: ["America/El_Salvador"],
  CO: ["America/Bogota"],
  PE: ["America/Lima"],
  BR: ["America/Sao_Paulo", "America/Fortaleza", "America/Recife", "America/Manaus"],
  US: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"],
};

const CITY_NAMES: Readonly<Record<string, string>> = {
  "America/Mexico_City": "Ciudad de México",
  "America/Merida": "Mérida",
  "America/Cancun": "Cancún",
  "America/Bahia_Banderas": "Bahía de Banderas",
  "America/Sao_Paulo": "São Paulo",
  "America/Bogota": "Bogotá",
};

function isCountry(country: string): country is CountryCode {
  return (COUNTRIES as readonly string[]).includes(country);
}

export function zonesOf(country: string): readonly string[] {
  return isCountry(country) ? ZONES[country] : [];
}

export function defaultTimezone(country: string): string {
  return zonesOf(country)[0] ?? "";
}

function offsetOf(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    return parts.find((part) => part.type === "timeZoneName")?.value.replace("GMT", "UTC") ?? "";
  } catch {
    return "";
  }
}

/** "Mérida (UTC-6)": a city name and its current offset, never the raw IANA name. */
export function zoneLabel(zone: string): string {
  const city = CITY_NAMES[zone] ?? (zone.split("/").pop() ?? zone).replace(/_/g, " ");
  const offset = offsetOf(zone);
  return offset ? `${city} (${offset})` : city;
}
