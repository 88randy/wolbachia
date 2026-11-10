import { LABEL_KIND_SPECS } from "./label-kinds";
import type { LabelKind } from "./label-kinds";

/** One printable record: its row id, its human code and one short caption line. */
export interface LabelItem {
  id: string;
  code: string;
  caption?: string;
}

/** The text a label encodes: `wbf:1:<kind>:<uuid>`, or the human code for motorcycles and paddles. */
export function qrPayload(kind: LabelKind, item: Pick<LabelItem, "id" | "code">): string {
  const spec = LABEL_KIND_SPECS[kind];
  return `wbf:1:${spec.qr}:${spec.byCode ? item.code : item.id.toLowerCase()}`;
}
