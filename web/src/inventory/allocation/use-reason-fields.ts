import { useState } from "react";
import { useVoidLimits } from "../../void";
import { useVoidReasons } from "../../void/use-void-reasons";

/** Reason code from the organization's reason catalog; free text is required only for "Other". */
export function useReasonFields() {
  const catalog = useVoidReasons();
  const limits = useVoidLimits();
  const [reasonCode, setReasonCode] = useState("");
  const [reason, setReason] = useState("");
  const isOtherReason = catalog.items.find((item) => item.code === reasonCode)?.is_other === true;
  return {
    items: catalog.items,
    isLoading: catalog.isCatalogLoading,
    isBlocked: catalog.isCatalogBlocked,
    retry: catalog.retryCatalog,
    reasonCode,
    reason: isOtherReason ? reason : "",
    isOtherReason,
    minReasonLength: limits.minLength,
    maxReasonLength: limits.maxLength,
    setReasonCode,
    setReason,
  };
}
export type ReasonFields = ReturnType<typeof useReasonFields>;
