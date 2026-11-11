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
 * phone only always asks; warehouse only never asks; either asks while the delivery is not
 * signed yet (it waits for the phone).
 */
export function needsPhoneSignature(
  mode: SignatureMode,
  signature: DeliverySignature | null,
): boolean {
  if (mode === 2) return true;
  if (mode === 1) return false;
  return signature?.state !== "signed";
}

/** A delivery that waits for the courier signature on the phone: "Tienes material por recibir". */
export function isPendingPhone(signature: DeliverySignature | null): boolean {
  return signature?.state === "pending_phone";
}
