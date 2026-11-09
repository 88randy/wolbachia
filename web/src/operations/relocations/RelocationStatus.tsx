import { useTranslation } from "react-i18next";
import { StatusPill } from "../../ui/StatusPill";
import { relocationStatusKey } from "./relocation-snapshot";
import type { Relocation } from "./relocations-query";
export function RelocationStatus({ status }: { status: Relocation["status"] }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={status === "pending" ? "warning" : "neutral"}>
      {t(relocationStatusKey(status))}
    </StatusPill>
  );
}
