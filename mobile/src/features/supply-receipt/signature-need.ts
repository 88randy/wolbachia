/** Rule `delivery_signature_mode`: 0 = either, 1 = warehouse only, 2 = phone only. The server owns it. */
export type SignatureMode = 0 | 1 | 2;

/** `lifecycle.signature` of a courier assignment; null when the delivery has no signature fact yet. */
export interface DeliverySignature {
  readonly state: "signed" | "pending_phone";
  readonly channel: "warehouse_screen" | "courier_device" | null;
}

export function readSignatureMode(value: unknown): SignatureMode {
  return value === 1 || value === 2 ? value : 0;
}

/**
 * Whether the receipt screen shows the signature pad. The app only shows the rule:
 * phone only always asks; either asks while the delivery is not signed yet (it waits for the
 * phone). Warehouse only asks just like either: a release under that rule is always signed at
 * the warehouse, so the pad shows only for a release made before the rule changed.
 */
export function needsPhoneSignature(
  mode: SignatureMode,
  signature: DeliverySignature | null,
): boolean {
  if (mode === 2) return true;
  return signature?.state !== "signed";
}

/** The rule value from the downloaded rules snapshot `parameters`; absent or unknown means "either". */
export function signatureModeFromRules(parameters: unknown): SignatureMode {
  if (!Array.isArray(parameters)) return 0;
  const row = (parameters as readonly unknown[]).find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as { key?: unknown }).key === "delivery_signature_mode",
  ) as { value?: unknown } | undefined;
  return readSignatureMode(typeof row?.value === "string" ? Number(row.value) : row?.value);
}

/** A delivery that waits for the courier signature on the phone: "Tienes material por recibir". */
export function isPendingPhone(signature: DeliverySignature | null): boolean {
  return signature?.state === "pending_phone";
}
