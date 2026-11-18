import type { MessageKey } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";

/** The text for a sample that did not come from a bag: its lot or its release. */
export function otherOriginKey(sample: {
  lot_id: string | null;
  release_id: string | null;
}): MessageKey | null {
  if (sample.lot_id) return "lab.origin.lot";
  if (sample.release_id) return "lab.origin.release";
  return null;
}

/** The catalog label of the origin of a PCR batch sample, in the user's language (Spanish when no English one). */
export function pcrOriginLabel(sample: Schemas["PcrSampleEntry"], language: string): string {
  return language === "en" && sample.origin_label_en !== ""
    ? sample.origin_label_en
    : sample.origin_label_es;
}
