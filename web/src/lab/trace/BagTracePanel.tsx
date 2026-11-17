import { ApiError } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { ErrorState } from "../../ui/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineNotice } from "../../ui/InlineNotice";
import { CompactTrace } from "./CompactTrace";
import { FullTrace } from "./FullTrace";
import { useBagTrace } from "./use-bag-trace";

interface Props {
  code: string;
  /** `compact` sits under a scan result or a count; `full` fills the bag drawer. */
  variant: "compact" | "full";
}

/** "Origen de la papeleta": bag, reading, ovitrap, point, block, quadrant and center in one panel. */
export function BagTracePanel({ code, variant }: Props) {
  const { t } = useTranslation();
  const query = useBagTrace(code);
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404)
      return <InlineNotice tone="info">{t("labTrace.notFound")}</InlineNotice>;
    return (
      <ErrorState
        message={t("labTrace.error")}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (!query.data)
    return (
      <div role="status" aria-busy="true" aria-label={t("labTrace.loading")}>
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  return variant === "compact" ? (
    <CompactTrace trace={query.data} />
  ) : (
    <FullTrace trace={query.data} />
  );
}
