import type { MessageKey } from "@wolbachia/i18n";

/** The five printable label types. `qr` is the kind segment of the `wbf:1:<kind>:<uuid>` payload. */
export const LABEL_KINDS = ["lots", "bags", "paddles", "ovitraps", "motorcycles"] as const;
export type LabelKind = (typeof LABEL_KINDS)[number];

export interface LabelKindSpec {
  kind: LabelKind;
  /** Permission code that lets the user read the records of this type. */
  permission: string;
  labelKey: MessageKey;
  /**
   * Kind segment of the QR payload. `lot`, `bag` and `ovitrap` are the kinds the backend scan
   * parser accepts (`backend/ovitraps/qr.py`); `paddle` and `motorcycle` are assumptions until
   * the parser registers them.
   */
  qr: string;
}

export const LABEL_KIND_SPECS: Record<LabelKind, LabelKindSpec> = {
  lots: { kind: "lots", permission: "lot.read", labelKey: "inventory.labels.kind.lots", qr: "lot" },
  bags: {
    kind: "bags",
    permission: "reading.read",
    labelKey: "inventory.labels.kind.bags",
    qr: "bag",
  },
  paddles: {
    kind: "paddles",
    permission: "egg_paddle.reuse",
    labelKey: "inventory.labels.kind.paddles",
    qr: "paddle",
  },
  ovitraps: {
    kind: "ovitraps",
    permission: "ovitrap.read",
    labelKey: "inventory.labels.kind.ovitraps",
    qr: "ovitrap",
  },
  motorcycles: {
    kind: "motorcycles",
    permission: "motorcycle.read",
    labelKey: "inventory.labels.kind.motorcycles",
    qr: "motorcycle",
  },
};

export const LABEL_PERMISSIONS = LABEL_KINDS.map((kind) => LABEL_KIND_SPECS[kind].permission);

export const LABEL_SIZES = ["small", "medium", "large"] as const;
export type LabelSize = (typeof LABEL_SIZES)[number];
