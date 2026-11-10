import type { MessageKey } from "@wolbachia/i18n";
import { isoToZonedLocal, zonedLocalToIso } from "./permit-dates";
import { parsePolygon } from "./permit-geometry";
import type { Permit } from "./permits-query";

export interface PermitDraft {
  code: string;
  quadrant: string;
  type: string;
  number: string;
  authority: string;
  attestation: string;
  geometry: string;
  validFrom: string;
  validTo: string;
}

export type PermitErrors = Partial<Record<keyof PermitDraft | "document", MessageKey>>;

/** What the validation needs besides the draft itself. */
export interface DraftContext {
  timeZone: string;
  isVersion: boolean;
  hasDocument: boolean;
}

const REQUIRED = "permits.form.required" as const;
const BLANK: PermitDraft = {
  code: "",
  quadrant: "",
  type: "",
  number: "",
  authority: "",
  attestation: "",
  geometry: "",
  validFrom: "",
  validTo: "",
};

/** A new version starts from the current one; the attestation is always a fresh statement. */
export function initialDraft(permit: Permit | undefined, timeZone: string): PermitDraft {
  const version = permit?.current_version;
  if (!permit || !version) return BLANK;
  return {
    ...BLANK,
    code: permit.code,
    quadrant: permit.quadrant,
    type: version.type,
    number: version.number,
    authority: version.authority,
    geometry: JSON.stringify(version.geometry),
    validFrom: isoToZonedLocal(version.valid_from, timeZone),
    validTo: isoToZonedLocal(version.valid_to, timeZone),
  };
}

const TEXT_FIELDS = ["quadrant", "type", "number", "authority", "attestation"] as const;

function validateTexts(draft: PermitDraft, isVersion: boolean): PermitErrors {
  const missing = TEXT_FIELDS.filter((field) => draft[field].trim() === "");
  const codeMissing = !isVersion && draft.code.trim() === "";
  return {
    ...Object.fromEntries(missing.map((field) => [field, REQUIRED])),
    ...(codeMissing ? { code: REQUIRED } : {}),
  };
}

function validateDates(draft: PermitDraft, timeZone: string): PermitErrors {
  const from = zonedLocalToIso(draft.validFrom, timeZone);
  const to = zonedLocalToIso(draft.validTo, timeZone);
  if (from === null || to === null)
    return {
      ...(from === null ? { validFrom: REQUIRED } : {}),
      ...(to === null ? { validTo: REQUIRED } : {}),
    };
  return Date.parse(to) <= Date.parse(from) ? { validTo: "permits.form.datesInvalid" } : {};
}

export function validatePermit(draft: PermitDraft, context: DraftContext): PermitErrors {
  return {
    ...validateTexts(draft, context.isVersion),
    ...(parsePolygon(draft.geometry) === null ? { geometry: "permits.form.geometryInvalid" } : {}),
    ...validateDates(draft, context.timeZone),
    ...(context.hasDocument ? {} : { document: "permits.form.documentRequired" }),
  };
}

/** Version fields of the request; call it only after `validatePermit` found no error. */
export function versionBody(draft: PermitDraft, timeZone: string, documentId: string) {
  return {
    type: draft.type,
    number: draft.number.trim(),
    authority: draft.authority.trim(),
    official_document: documentId,
    document_attestation: draft.attestation.trim(),
    geometry: parsePolygon(draft.geometry) ?? { type: "Polygon" as const, coordinates: [] },
    valid_from: zonedLocalToIso(draft.validFrom, timeZone) ?? "",
    valid_to: zonedLocalToIso(draft.validTo, timeZone) ?? "",
  };
}
