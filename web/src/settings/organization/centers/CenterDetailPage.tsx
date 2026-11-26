import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DetailPage } from "../../../components/templates/DetailPage";
import { useBreadcrumbLabel } from "../../../shell/breadcrumb-labels";
import { EmptyState } from "../../../ui/EmptyState";
import { ErrorState } from "../../../ui/ErrorState";
import { PendingState } from "../../../states/PendingState";
import { CENTERS_PATH, centerDetailOptions } from "./centers-api";
import { CenterBelongings } from "./CenterBelongings";
import { CenterFacts } from "./CenterFacts";
import { CenterHeaderActions } from "./CenterHeaderActions";
import { CenterStatusPill } from "./CenterStatusPill";
import { useCentersScope } from "./use-centers-scope";

/** Settings → Organización → Centros → one center: data card and what belongs to it. */
export function CenterDetailPage({ code }: { code: string }) {
  const { t } = useTranslation();
  const query = useQuery(centerDetailOptions(useCentersScope(), code));
  const center = query.data;
  useBreadcrumbLabel(`${CENTERS_PATH}/${code}`, center?.name);
  if (query.isPending) return <PendingState />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (!center) return <EmptyState kind="noData" message={t("centersAdmin.detail.notFound")} />;
  return (
    <DetailPage
      title={center.name}
      code={center.code}
      status={<CenterStatusPill isActive={center.is_active} />}
      back={{ label: t("centersAdmin.detail.back"), link: { to: CENTERS_PATH } }}
      actions={<CenterHeaderActions center={center} />}
    >
      <CenterFacts center={center} />
      <CenterBelongings center={center} />
    </DetailPage>
  );
}
