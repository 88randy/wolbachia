import type { MessageKey } from "@wolbachia/i18n";
import { z } from "zod";

/** The six things that can carry a QR label. One name per kind, also the kind segment of the QR. */
export const LABEL_KINDS = ["lot", "bag", "paddle", "ovitrap", "motorcycle", "location"] as const;
export type LabelKind = (typeof LABEL_KINDS)[number];

export interface LabelKindSpec {
  /** Permission that lets the user read the records of this kind (and so print their labels). */
  permission: string;
  labelKey: MessageKey;
  /**
   * What the QR carries after `wbf:1:<kind>:`. The phone matches lots, bags and ovitraps by id
   * (`backend/ovitraps/qr.py` accepts only a uuid for them) and paddles and motorcycles by human
   * code. Locations have no scanner yet; they carry the human code.
   */
  qrBy: "id" | "code";
}

export const LABEL_KIND_SPECS: Record<LabelKind, LabelKindSpec> = {
  lot: { permission: "lot.read", labelKey: "inventory.labels.kind.lot", qrBy: "id" },
  bag: { permission: "reading.read", labelKey: "inventory.labels.kind.bag", qrBy: "id" },
  paddle: {
    permission: "egg_paddle.reuse",
    labelKey: "inventory.labels.kind.paddle",
    qrBy: "code",
  },
  ovitrap: { permission: "ovitrap.read", labelKey: "inventory.labels.kind.ovitrap", qrBy: "id" },
  motorcycle: {
    permission: "motorcycle.read",
    labelKey: "inventory.labels.kind.motorcycle",
    qrBy: "code",
  },
  location: {
    permission: "location.read",
    labelKey: "inventory.labels.kind.location",
    qrBy: "code",
  },
};

export const LABEL_PERMISSIONS = LABEL_KINDS.map((kind) => LABEL_KIND_SPECS[kind].permission);

export function isLabelKind(value: unknown): value is LabelKind {
  return typeof value === "string" && (LABEL_KINDS as readonly string[]).includes(value);
}

/** Query string of the label tool: `?kind=lot&code=L-0001` preselects one record by its human code. */
export const labelsSearchSchema = z.object({
  kind: z.string().optional(),
  code: z.string().optional(),
});
