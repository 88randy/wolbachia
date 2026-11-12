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
    kind: "lot",
    id: lot.id,
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
    kind: "location",
    id: location.id,
    code: location.code,
    lines: present([
      location.name,
      location.quadrant_code ? `${kind} · ${location.quadrant_code}` : kind,
    ]),
  };
}

/** Bag: the date it was registered. */
export function bagLabel(
  bag: Pick<Schemas["Bag"], "id" | "code" | "created_at">,
  text: LabelText,
): LabelRecord {
  return {
    kind: "bag",
    id: bag.id,
    code: bag.code,
    lines: present([text.t("labels.line.createdOn", { date: text.date(bag.created_at) })]),
  };
}

/** Motorcycle: its plate. */
export function motorcycleLabel(
  moto: Pick<Schemas["Motorcycle"], "id" | "code" | "plate">,
  text: LabelText,
): LabelRecord {
  return {
    kind: "motorcycle",
    id: moto.id,
    code: moto.code,
    lines: present([moto.plate && text.t("labels.line.plate", { plate: moto.plate })]),
  };
}

/** Ovitrap: the sampling point it belongs to. */
export function ovitrapLabel(
  ovitrap: Pick<Schemas["Ovitrap"], "id" | "code" | "point_code">,
  text: LabelText,
): LabelRecord {
  return {
    kind: "ovitrap",
    id: ovitrap.id,
    code: ovitrap.code,
    fallbackCode: ovitrap.point_code,
    lines: present([
      ovitrap.point_code && text.t("labels.line.point", { code: ovitrap.point_code }),
    ]),
  };
}

/** Egg paddle: only its code. */
export function paddleLabel(paddle: Pick<Schemas["Paddle"], "id" | "code">): LabelRecord {
  return { kind: "paddle", id: paddle.id, code: paddle.code, lines: [] };
}

/** A row of any printable kind, as the label picker reads it from the API. */
export type LabelSource =
  | { kind: "lot"; row: Schemas["Lot"] }
  | { kind: "bag"; row: Schemas["Bag"] }
  | { kind: "paddle"; row: Schemas["Paddle"] }
  | { kind: "ovitrap"; row: Schemas["Ovitrap"] }
  | { kind: "motorcycle"; row: Schemas["Motorcycle"] }
  | { kind: "location"; row: Schemas["Location"] };

/** The label of any source row. */
export function toLabelRecord(source: LabelSource, text: LabelText): LabelRecord {
  switch (source.kind) {
    case "lot":
      return lotLabel(source.row, text);
    case "bag":
      return bagLabel(source.row, text);
    case "paddle":
      return paddleLabel(source.row);
    case "ovitrap":
      return ovitrapLabel(source.row, text);
    case "motorcycle":
      return motorcycleLabel(source.row, text);
    case "location":
      return locationLabel(source.row, text);
  }
}
