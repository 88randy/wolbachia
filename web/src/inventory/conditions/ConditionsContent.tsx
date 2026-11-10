import { ErrorState } from "../../ui/ErrorState";
import { ConditionStatusContent } from "./ConditionStatusContent";
import { ConditionsHeader } from "./ConditionsHeader";
import type { useConditionScreen } from "./use-condition-screen";
import page from "../../styles/page.module.css";
import styles from "../inventory.module.css";
export function ConditionsContent({ model }: { model: ReturnType<typeof useConditionScreen> }) {
  const { code, scope, lot, status, capture, review } = model;
  return (
    <section className={[page.page, styles.content].join(" ")}>
      <ConditionsHeader
        code={code}
        context={scope.readContext}
        onReview={() => {
          void review();
        }}
      />
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
    </section>
  );
}
