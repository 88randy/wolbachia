import { useTranslation } from "react-i18next";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { InlineNotice } from "../../ui/InlineNotice";
import type { RubricLookupModel } from "./use-rubric-lookup";
export function RubricLookupStatus({ model }: { model: RubricLookupModel }) {
  const { t } = useTranslation();
  const isUnconfigured = model.code && model.query.isSuccess && !model.rubric;
  return (
    <>
      {model.code && model.query.isPending && <CardSkeleton />}
      {model.query.error && (
        <ErrorState
          onRetry={() => {
            void model.query.refetch();
          }}
        />
      )}
      {isUnconfigured && (
        <InlineNotice tone="warning">{t("evaluations.rubric.unconfigured")}</InlineNotice>
      )}
    </>
  );
}
