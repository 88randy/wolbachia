import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { Disclosure } from "../../ui/Disclosure";
import { useToast } from "../../ui/toast-context";

/** Collapsed audit detail: the SHA-256 the server sealed when it applied the decision's effect. */
export function ReviewReceiptFingerprint({ hash }: { hash: string }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const copy = () => {
    void navigator.clipboard.writeText(hash).then(() => {
      showToast({ message: t("reviews.workspace.hashCopied"), tone: "success" });
    });
  };
  return (
    <Disclosure title={t("reviews.workspace.receipt")}>
      <p className="m-0 text-xs text-ink-2">{t("reviews.workspace.payloadHash")}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <code className="min-w-0 font-mono text-xs break-all text-ink">{hash}</code>
        <Button variant="ghost" size="sm" leadingIcon={<Copy aria-hidden="true" />} onClick={copy}>
          {t("reviews.workspace.copyHash")}
        </Button>
      </div>
    </Disclosure>
  );
}
