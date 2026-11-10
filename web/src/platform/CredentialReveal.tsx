/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { Copy, KeyRound, MailCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { useToast } from "../ui/toast-context";

interface CredentialRevealProps {
  username: string;
  temporaryPassword: string | null | undefined;
}

/**
 * The one-time password of a new admin, shown once with a copy button; it is never cached or
 * stored by the client. With an invitation there is nothing to show but the confirmation.
 */
export function CredentialReveal({ username, temporaryPassword }: CredentialRevealProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  if (!temporaryPassword) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-neutral-bg p-4 text-sm text-ink">
        <MailCheck aria-hidden="true" className="size-5 flex-none text-success-fg" />
        {t("platform.done.inviteSent", { username })}
      </div>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-warning-bg p-5">
      <h2 className="m-0 flex items-center gap-2 text-sm font-semibold text-ink">
        <KeyRound aria-hidden="true" className="size-4" />
        {t("platform.done.passwordTitle", { username })}
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded-lg border border-line bg-surface px-4 py-2 text-lg font-semibold tracking-wider text-ink select-all">
          {temporaryPassword}
        </code>
        <Button
          variant="secondary"
          leadingIcon={<Copy aria-hidden="true" />}
          onClick={() => {
            void navigator.clipboard.writeText(temporaryPassword).then(() => {
              showToast({ message: t("platform.done.copied"), tone: "success" });
            });
          }}
        >
          {t("platform.done.copy")}
        </Button>
      </div>
      <p className="m-0 text-xs text-ink-2">{t("platform.done.passwordWarning")}</p>
    </section>
  );
}
