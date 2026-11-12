import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import type { LabelRecord } from "./label-record";

/** The translator and date formatters a mapper needs (the hook below supplies the real ones). */
export interface LabelText {
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  /** A calendar date ("2026-11-10") as people read it. */
  calendarDate: (isoDate: string) => string;
  /** A moment, as a date in the organization's time zone. */
  date: (iso: string) => string;
}

function present(lines: readonly (string | false | null | undefined)[]): string[] {
  return lines.filter((line): line is string => typeof line === "string" && line !== "");
}

/** Lot: item name and expiry date. */
export function lotLabel(lot: Schemas["Lot"], text: LabelText): LabelRecord {
  const expiry = lot.expiry_date;
  return {
    code: lot.code,
    lines: present([
      lot.supply_version.label,
      expiry && text.t("labels.line.expires", { date: text.calendarDate(expiry) }),
    ]),
  };
}

/** Location: its name, then its type (and the quadrant when it has one). */
export function locationLabel(location: Schemas["Location"], text: LabelText): LabelRecord {
  const kind = text.t(`inventory.option.${location.kind}`);
  return {
    code: location.code,
    lines: present([
      location.name,
      location.quadrant_code ? `${kind} · ${location.quadrant_code}` : kind,
    ]),
  };
}

/** Bag: the date it was registered. */
export function bagLabel(bag: { code: string; createdAt: string }, text: LabelText): LabelRecord {
  return {
    code: bag.code,
    lines: present([text.t("labels.line.createdOn", { date: text.date(bag.createdAt) })]),
  };
}

/** Motorcycle: its plate. */
export function motorcycleLabel(
  moto: Pick<Schemas["Motorcycle"], "code" | "plate">,
  text: LabelText,
): LabelRecord {
  return {
    code: moto.code,
    lines: present([moto.plate && text.t("labels.line.plate", { plate: moto.plate })]),
  };
}
