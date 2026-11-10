import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useInventoryContext } from "../use-inventory-context";
import { useDocumentTitle } from "../../shell/use-document-title";
import {
  conditionLotOptions,
  conditionStatusOptions,
  conditionRouteScope,
} from "./condition-queries";
import { useConditionCapture } from "./use-condition-capture";
import { hasConditionCaptureDenial, isConditionAccessDenied } from "./condition-access";
export function useConditionScreen(code: string) {
  const { t } = useTranslation();
  const scope = conditionRouteScope(useInventoryContext(), code);
  const lot = useQuery(conditionLotOptions(scope, code));
  const status = useQuery(conditionStatusOptions(scope, lot.data?.id));
  const isDenied =
    (lot.isSuccess && lot.data === null) ||
    isConditionAccessDenied(lot.error) ||
    isConditionAccessDenied(status.error) ||
    hasConditionCaptureDenial(status);
  const capture = useConditionCapture(isDenied);
  useDocumentTitle(t("conditions.page.title"));
  async function review() {
    const result = await status.refetch();
    if (!result.error && result.data) capture.reviewed();
  }
  return { code, scope, lot, status, capture, review };
}
