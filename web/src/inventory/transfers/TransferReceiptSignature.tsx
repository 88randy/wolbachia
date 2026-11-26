import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FormActions } from "../../components/templates/FormGrid";
import { useMe } from "../../session/use-me";
import { displayNameOf } from "../../shell/user-display";
import { Button } from "../../ui/Button";
import { TransferSignature } from "./TransferSignature";
import type { TransferScope } from "./transfer-query";
import type { useTransferReception } from "./use-transfer-reception";

interface SignatureProps {
  scope: TransferScope;
  model: ReturnType<typeof useTransferReception>;
  isBlocked: boolean;
  canSubmit: boolean;
}

/** The person who receives signs on the pad, then confirms the reception. */
export function TransferReceiptSignature({ scope, model, isBlocked, canSubmit }: SignatureProps) {
  const { t } = useTranslation();
  const me = useMe();
  const reasonId = useId();
  const hasSignature = Boolean(model.draft.signature);
  return (
    <>
      <TransferSignature
        scope={scope}
        signerName={displayNameOf(me.user)}
        isBlocked={isBlocked}
        onVerified={model.verifySignature}
      />
      <FormActions>
        {!canSubmit && (
          <p id={reasonId} className="m-0 mr-auto text-[13px] text-ink-2">
            {t(
              hasSignature
                ? "transfers.receive.needsPhotos"
                : "transfers.write.receiveNeedsSignature",
            )}
          </p>
        )}
        <Button
          loading={model.write.isBusy}
          aria-disabled={!canSubmit || undefined}
          aria-describedby={canSubmit ? undefined : reasonId}
          onClick={() => {
            if (canSubmit) model.send();
          }}
        >
          {t("transfers.action.receive")}
        </Button>
      </FormActions>
    </>
  );
}
