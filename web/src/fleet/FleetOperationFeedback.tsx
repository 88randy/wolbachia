import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { FleetDraft } from "./fleet-drafts";
import type { useFleetOperations } from "./use-fleet-operations";
import type { FleetOperationProps } from "./FleetOperationForm";
function ReviewAction({ draft, operations }: FleetOperationProps) {
  const { t } = useTranslation();
  if (draft.failure !== "conflict" && draft.failure !== "uncertain" && !operations.requiresReview)
    return null;
  return (
    <Button
      variant="secondary"
      aria-disabled={draft.phase !== "idle"}
      onClick={() => {
        void operations.review();
      }}
    >
      {t(draft.failure === "uncertain" ? "fleet.action.refreshUnknown" : "fleet.action.review")}
    </Button>
  );
}
export function FleetOperationFeedback({
  draft,
  operations,
}: {
  draft: FleetDraft;
  operations: ReturnType<typeof useFleetOperations>;
}) {
  const { t } = useTranslation();
  if (operations.cooling) return <p role="status">{t("fleet.write.cooldown")}</p>;
  if ((!draft.failure && !operations.requiresReview) || draft.phase === "write") return null;
  return (
    <div role="alert" tabIndex={-1}>
      <p>{t(`fleet.write.${draft.failure ?? "conflict"}`)}</p>
      <ReviewAction draft={draft} operations={operations} />
      {operations.inspectedRevision !== undefined && (
        <p role="status">{t("fleet.write.readback", { revision: operations.inspectedRevision })}</p>
      )}
      {draft.failure === "uncertain" && (
        <Button
          variant="secondary"
          aria-disabled={draft.phase !== "idle"}
          onClick={operations.discard}
        >
          {t("fleet.action.discard")}
        </Button>
      )}
    </div>
  );
}
