/* eslint-disable max-lines-per-function -- presentational JSX of a dialog; splitting it into one-use fragments would hurt readability. */
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { DialogFooter } from "../../ui/DialogFooter";
import { InlineNotice } from "../../ui/InlineNotice";
import { ModalDialog } from "../../ui/ModalDialog";
import { useToast } from "../../ui/toast-context";

export interface CreatedKey {
  institution: string;
  /** Lives only in this dialog's props: it is never stored, cached or logged. */
  secret: string;
}

/** Shows the secret of a new key ONCE. Closing it forgets the secret for good. */
export function ApiKeySecretDialog({
  created,
  onClose,
}: {
  created: CreatedKey;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const copy = () => {
    void navigator.clipboard.writeText(created.secret).then(() => {
      showToast({ message: t("apiKeys.secret.copied"), tone: "success" });
    });
  };
  return (
    <ModalDialog
      title={t("apiKeys.secret.title", { institution: created.institution })}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[13px] leading-5 text-ink-2">{t("apiKeys.secret.intro")}</p>
        <div className="flex min-w-0 items-center gap-3 rounded-lg border border-line-strong bg-surface-muted p-3">
          <code
            aria-label={t("apiKeys.secret.label")}
            className="min-w-0 flex-1 font-mono text-[13px] break-all text-ink select-all"
          >
            {created.secret}
          </code>
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<Copy aria-hidden="true" />}
            onClick={copy}
          >
            {t("apiKeys.secret.copy")}
          </Button>
        </div>
        <InlineNotice tone="warning">
          <p>{t("apiKeys.secret.channel")}</p>
        </InlineNotice>
        <DialogFooter>
          <Button onClick={onClose}>{t("apiKeys.secret.done")}</Button>
        </DialogFooter>
      </div>
    </ModalDialog>
  );
}
