/* eslint-disable max-params -- fast mode (demo 2026-11-20): map measurements, split after the demo. */
import type { TFunction } from "i18next";

const HECTARE_M2 = 10_000;
const KM = 1000;

const number = (language: string, value: number, decimals: number) =>
  new Intl.NumberFormat(language, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);

/** "2.4 ha" (hectares from 1 ha when allowed) or "3,150 m²", in the user's number format. */
export function compactAreaText(
  t: TFunction,
  language: string,
  squareMeters: number,
  allowHectares = true,
): string {
  return allowHectares && squareMeters >= HECTARE_M2
    ? t("geography.measure.ha", { value: number(language, squareMeters / HECTARE_M2, 1) })
    : t("geography.measure.m2", { value: number(language, squareMeters, 0) });
}

/** "2.45 ha (24,500 m²)" or "850 m²" for detail panels. */
export function areaDetailText(t: TFunction, language: string, squareMeters: number): string {
  const plain = t("geography.measure.m2", { value: number(language, squareMeters, 0) });
  if (squareMeters < HECTARE_M2) return plain;
  return t("geography.measure.areaBoth", {
    big: t("geography.measure.ha", { value: number(language, squareMeters / HECTARE_M2, 2) }),
    small: plain,
  });
}

/** "640 m" or "1.25 km". */
export function lengthDetailText(t: TFunction, language: string, meters: number): string {
  return meters >= KM
    ? t("geography.measure.km", { value: number(language, meters / KM, 2) })
    : t("geography.measure.m", { value: number(language, meters, 0) });
}
