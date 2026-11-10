import { useTranslation } from "react-i18next";
import { DetailPage } from "../../components/templates/DetailPage";
import { ErrorState } from "../../ui/ErrorState";
import { ConditionStatusContent } from "./ConditionStatusContent";
import { ConditionsActions } from "./ConditionsHeader";
import type { useConditionScreen } from "./use-condition-screen";

export function ConditionsContent({ model }: { model: ReturnType<typeof useConditionScreen> }) {
  const { t } = useTranslation();
  const { code, scope, lot, status, capture } = model;
  const review = () => {
    void model.review();
  };
  return (
    <DetailPage
      code={code}
      title={t("conditions.page.title")}
      actions={<ConditionsActions code={code} context={scope.readContext} onReview={review} />}
    >
      {lot.error && (
        <ErrorState
          onRetry={() => {
            void lot.refetch();
          }}
        />
      )}
      <ConditionStatusContent
        status={status}
        lot={lot.data?.id ?? ""}
        capture={capture}
        isLotReady={!lot.error && !lot.isFetching && !lot.isPlaceholderData}
      />
    </DetailPage>
  );
}
