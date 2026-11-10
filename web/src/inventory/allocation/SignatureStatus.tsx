import { Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusPill } from "../../ui/StatusPill";
import type { signatureState } from "./reconciliation-equation";

type State = ReturnType<typeof signatureState> | "unassigned" | "sent";

/** Reports the real state only: pending, verified, or unknown when the reconciliation is unreadable. */
export function SignatureStatus({ state }: { state: State }) {
  const { t } = useTranslation();
  const tone =
    state === "verified"
      ? "success"
      : state === "pending" || state === "sent"
        ? "warning"
        : "neutral";
  return (
    <section aria-label={t("allocation.signature.title")}>
      <h3>{t("allocation.signature.title")}</h3>
      <StatusPill tone={tone}>
        {state === "pending" || state === "sent" ? (
          <Smartphone aria-hidden="true" size={14} />
        ) : null}
        {t(`allocation.signature.${state}`)}
      </StatusPill>
    </section>
  );
}
