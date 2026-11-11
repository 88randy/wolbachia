import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SignaturePad } from "../../ui/SignaturePad";
import { useTransferUpload } from "./use-transfer-upload";
import type { TransferUploadScope } from "./use-transfer-upload";

/**
 * A drawn signature, uploaded and verified through the same private upload flow as any evidence,
 * without a "verify" step for the person: when the drawing is long enough it is saved by itself.
 */
export function TransferSignature(props: {
  scope: TransferUploadScope;
  /** Whose signature it is, e.g. "Walter Rosado Lara". */
  signerName: string;
  isBlocked?: boolean;
  /** Needed when several pads share one page. */
  id?: string;
  onVerified: (id: string) => void;
}) {
  const { t } = useTranslation();
  const upload = useTransferUpload(props.scope, props.onVerified);
  const canSign = props.scope.identity.permissions?.includes("field.upload") === true;
  const { proof, status } = upload;
  useEffect(() => {
    if (proof && !proof.verifiedAt && status === "idle") upload.verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once per newly drawn signature
  }, [proof, status]);
  if (!canSign) return <p className="m-0 text-sm">{t("ui.signaturePad.noPermission")}</p>;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SignaturePad
        id={props.id ?? "signature-pad"}
        label={t("ui.signaturePad.signer", { name: props.signerName })}
        disabled={props.isBlocked === true || upload.isBusy}
        isReady={Boolean(proof?.verifiedAt)}
        onChange={(png) => {
          upload.select(png ? new File([png], "signature.png", { type: "image/png" }) : undefined);
        }}
      />
      {status === "failed" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-critical-fg">
          <span>{t("ui.signaturePad.failed")}</span>
          <button type="button" className="font-semibold underline" onClick={upload.verify}>
            {t("allocation.command.retry")}
          </button>
        </div>
      )}
    </div>
  );
}
