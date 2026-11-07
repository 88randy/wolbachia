import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import { Button } from "../ui/Button";
import type { MessageKey } from "@wolbachia/i18n";
interface Props {
  failure?: { key: MessageKey; reasons: MessageKey[]; conflict: boolean; uncertain: boolean };
  invalid: boolean;
  disabled?: boolean;
  onReview: () => void;
  onReconcile: () => void;
}
function FailureNotice({ failure }: Pick<Props, "failure">) {
  const { t } = useTranslation();
  if (!failure) return null;
  return (
    <InlineNotice tone="critical">
      <div role="alert">
        {t(failure.uncertain ? "inventory.state.uncertain" : failure.key)}
        {failure.reasons.map((reason) => (
          <p key={reason}>{t(reason)}</p>
        ))}
      </div>
    </InlineNotice>
  );
}
export function InventoryFormFeedback(props: Props) {
  const { t } = useTranslation();
  return (
    <>
      {props.invalid && <p role="alert">{t("inventory.state.invalid")}</p>}
      <FailureNotice failure={props.failure} />
      {props.failure?.conflict && (
        <Button variant="secondary" disabled={props.disabled} onClick={props.onReview}>
          {t("inventory.action.review")}
        </Button>
      )}
      {props.failure?.uncertain && (
        <Button variant="secondary" disabled={props.disabled} onClick={props.onReconcile}>
          {t("inventory.action.reconcile")}
        </Button>
      )}
    </>
  );
}
