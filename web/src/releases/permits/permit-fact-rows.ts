import type { TFunction } from "i18next";
import { maxGpsAccuracy } from "./permit-requirements";
import type { Permit, PermitVersion } from "./permits-query";

interface Input {
  permit: Permit;
  version: PermitVersion;
  t: TFunction;
  format: (iso: string) => string;
  /** Formats the end of the validity (a midnight end reads as its last day). */
  formatEnd: (iso: string) => string;
}

/** Label and value of each fact of the current official version, in reading order. */
export function factRows({ permit, version, t, format, formatEnd }: Input): [string, string][] {
  const meters = maxGpsAccuracy(version.requirements);
  const from = format(version.valid_from);
  const to = formatEnd(version.valid_to);
  return [
    [t("permits.detail.number"), version.number],
    [t("permits.detail.authority"), version.authority],
    [t("permits.detail.type"), permit.type_name ?? ""],
    [t("permits.detail.validity"), t("permits.column.validityCell", { from, to })],
    [t("permits.detail.center"), permit.center_code],
    [t("permits.detail.quadrant"), permit.quadrant_code],
    [
      t("permits.detail.requirements"),
      meters === null ? "" : t("permits.types.requirement", { meters }),
    ],
    [t("permits.detail.attestation"), version.document_attestation],
  ];
}
