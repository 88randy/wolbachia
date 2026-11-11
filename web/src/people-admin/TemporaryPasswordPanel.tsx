/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import { useFormatDateTime } from "../format/use-format-date-time";
import { Button } from "../ui/Button";
import { InlineNotice } from "../ui/InlineNotice";
import { useTemporaryPassword } from "./use-temporary-password";

/** Generates a temporary password and shows it once, with a copy button and its expiry. */
export function TemporaryPasswordPanel({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  const { issued, generate, writer } = useTemporaryPassword(userId);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  async function copyPassword() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.temporary_password);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }
  return (
    <div className="flex flex-col gap-3">
      {writer.error && <InlineNotice tone="critical">{t(writer.error)}</InlineNotice>}
      {issued ? (
        <>
          <p className="m-0 text-sm text-ink-2">{t("users.password.once")}</p>
          <p className="m-0 text-xs text-ink-2">{t("users.password.label")}</p>
          <code
            data-testid="temporary-password"
            className="select-all break-all rounded-md bg-surface-muted p-2 font-mono text-base text-ink"
          >
            {issued.temporary_password}
          </code>
          <p className="m-0 text-xs text-ink-2">
            {t("users.password.expires", { date: formatDateTime(issued.expires_at) })}{" "}
            {t("users.password.mustChange")}
          </p>
          <Button
            variant="secondary"
            leadingIcon={<Copy aria-hidden="true" />}
            onClick={() => void copyPassword()}
          >
            {t("users.password.copy")}
          </Button>
          <p role="status" className="m-0 text-xs text-ink-2">
            {copy === "copied" && t("users.password.copied")}
            {copy === "failed" && t("users.password.copyFailed")}
          </p>
        </>
      ) : (
        <Button loading={writer.isBusy} onClick={() => void generate()}>
          {t("users.password.action")}
        </Button>
      )}
    </div>
  );
}
