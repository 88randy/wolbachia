import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useBreadcrumbLabel } from "../../../shell/breadcrumb-labels";
import { PendingState } from "../../../states/PendingState";
import { EmptyState } from "../../../ui/EmptyState";
import { ErrorState } from "../../../ui/ErrorState";
import { InlineNotice } from "../../../ui/InlineNotice";
import { CENTERS_PATH, centerDetailOptions } from "./centers-api";
import { CloseChecklist } from "./CloseChecklist";
import { useCentersScope } from "./use-centers-scope";

/** Settings → Organización → Centros → one center → "Cerrar centro" guided flow. */
export function CenterClosePage({ code }: { code: string }) {
  const { t } = useTranslation();
  const query = useQuery(centerDetailOptions(useCentersScope(), code));
  const center = query.data;
  useBreadcrumbLabel(`${CENTERS_PATH}/${code}`, center?.name);
  if (query.isPending) return <PendingState />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (!center) return <EmptyState kind="noData" message={t("centersAdmin.detail.notFound")} />;
  if (!center.is_active)
    return <InlineNotice>{t("centersAdmin.close.alreadyInactive")}</InlineNotice>;
  return <CloseChecklist center={center} />;
}
