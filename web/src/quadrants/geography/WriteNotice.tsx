import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { WriteOutcome } from "./write-result";
interface Props {
  outcome: WriteOutcome<unknown> | null;
}
export function WriteNotice({ outcome }: Props) {
  const { t } = useTranslation();
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (outcome?.kind === "failed") alert.current?.focus();
  }, [outcome]);
  if (outcome?.kind === "failed")
    return (
      <p ref={alert} role="alert" tabIndex={-1}>
        {t(outcome.key)}
      </p>
    );
  return <p role="status">{outcome?.kind === "saved" ? t("geography.status.saved") : ""}</p>;
}
