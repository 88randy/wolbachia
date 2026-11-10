import { LABEL_KIND_SPECS } from "./label-kinds";
import type { LabelKind } from "./label-kinds";

/** One printable record: its row id, its human code and one short caption line. */
export interface LabelItem {
  id: string;
  code: string;
  caption?: string;
}

/** The text a label encodes; mobile and the backend parse `wbf:1:<kind>:<uuid>`. */
export function qrPayload(kind: LabelKind, id: string): string {
  return `wbf:1:${LABEL_KIND_SPECS[kind].qr}:${id.toLowerCase()}`;
}
