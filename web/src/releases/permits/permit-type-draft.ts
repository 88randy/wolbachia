import type { MessageKey } from "@wolbachia/i18n";

export interface PermitTypeDraft {
  code: string;
  name: string;
  gps: string;
}

export type PermitTypeErrors = Partial<Record<keyof PermitTypeDraft, MessageKey>>;

export const EMPTY_TYPE_DRAFT: PermitTypeDraft = { code: "", name: "", gps: "" };

const REQUIRED = "permits.form.required" as const;

/** Positive finite number (a comma or a dot as decimal mark), or `null`. */
export function parseMeters(text: string): number | null {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() !== "" && Number.isFinite(value) && value > 0 ? value : null;
}

export function validateType(draft: PermitTypeDraft): PermitTypeErrors {
  return {
    ...(draft.code.trim() === "" ? { code: REQUIRED } : {}),
    ...(draft.name.trim() === "" ? { name: REQUIRED } : {}),
    ...(parseMeters(draft.gps) === null ? { gps: REQUIRED } : {}),
  };
}

/** Body of `POST /permit-types/`; call it only after `validateType` found no error. */
export function typeBody(draft: PermitTypeDraft) {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    requirements: { max_gps_accuracy_m: parseMeters(draft.gps) ?? 0 },
  };
}
