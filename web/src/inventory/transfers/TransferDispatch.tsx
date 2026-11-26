import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FormActions } from "../../components/templates/FormGrid";
import { useMe } from "../../session/use-me";
import { displayNameOf } from "../../shell/user-display";
import { Button } from "../../ui/Button";
import { TransferSignature } from "./TransferSignature";
import { TransferWriteFeedback } from "./TransferWriteFeedback";
import { useTransferDispatch } from "./use-transfer-dispatch";
import type { TransferRecordProps } from "./TransferRecord";

/** Send the shipment: the person who hands it over signs on the pad, then sends. */
export function TransferDispatch(props: TransferRecordProps) {
  const { t } = useTranslation();
  const me = useMe();
  const reasonId = useId();
  const { write, verifySignature, send, canSubmit } = useTransferDispatch(props);
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <TransferSignature
        scope={props.scope}
        signerName={displayNameOf(me.user)}
        isBlocked={write.isBusy || write.isFrozen}
        onVerified={verifySignature}
      />
      <FormActions>
        {!canSubmit && (
          <p id={reasonId} className="m-0 mr-auto text-[13px] text-ink-2">
            {t("transfers.write.dispatchNeedsSignature")}
          </p>
        )}
        <Button
          loading={write.isBusy}
          aria-disabled={!canSubmit || undefined}
          aria-describedby={canSubmit ? undefined : reasonId}
          onClick={() => {
            if (canSubmit) send();
          }}
        >
          {t("transfers.action.dispatch")}
        </Button>
      </FormActions>
      <TransferWriteFeedback write={write} onRetry={send} />
    </section>
  );
}
