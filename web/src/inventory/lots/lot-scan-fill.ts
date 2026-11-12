import type { Gs1Data } from "../../scan/gs1";

/** The form fields a supplier code can fill (the supply is chosen by its GTIN separately). */
export type FilledField = "code" | "expiry_date" | "quantity";

export interface LotFillPatch {
  values: Record<string, string>;
  fields: FilledField[];
}

const POSITIVE_INTEGER = /^[1-9]\d*$/;

/** What a supplier's GS1 code puts in the new-lot form. Only facts the code really carries. */
export function patchFromSupplierCode(data: Gs1Data): LotFillPatch {
  const values: Record<string, string> = {};
  const fields: FilledField[] = [];
  if (data.lot !== null) {
    values["code"] = data.lot;
    fields.push("code");
  }
  if (data.expiryDate !== null) {
    values["expiry_date"] = data.expiryDate;
    fields.push("expiry_date");
  }
  if (data.quantity !== null && POSITIVE_INTEGER.test(data.quantity)) {
    values["quantity"] = data.quantity;
    fields.push("quantity");
  }
  return { values, fields };
}
