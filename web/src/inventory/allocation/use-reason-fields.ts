import { useState } from "react";
import { useVoidLimits } from "../../void";
import { useVoidReasons } from "../../void/use-void-reasons";
import type { ReasonKind } from "../../void/use-void-reasons";

/** The note a catalog reason carries when nobody wrote text (at least 10 characters). */
export function supplyNote(label: string): string {
  return `${label} (sin comentarios)`;
}

/** Reason code from the organization's reason catalog; free text is required only for "Other". */
export function useReasonFields(kind: ReasonKind = "void") {
  const catalog = useVoidReasons(kind);
  const limits = useVoidLimits();
  const [reasonCode, setReasonCode] = useState("");
  const [reason, setReason] = useState("");
  const chosen = catalog.items.find((item) => item.code === reasonCode);
  const isOtherReason = chosen?.is_other === true;
  /** Supply operations keep a 10-character note for every code: the reason's name stands in. */
  const note = chosen ? supplyNote(chosen.label_es) : "";
  return {
    items: catalog.items,
    isLoading: catalog.isCatalogLoading,
    isBlocked: catalog.isCatalogBlocked,
    retry: catalog.retryCatalog,
    reasonCode,
    reason: isOtherReason ? reason : note,
    isOtherReason,
    minReasonLength: limits.minLength,
    maxReasonLength: limits.maxLength,
    setReasonCode,
    setReason,
  };
}
export type ReasonFields = ReturnType<typeof useReasonFields>;
