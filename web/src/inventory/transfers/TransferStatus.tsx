import { useTranslation } from "react-i18next";
import { StatusPill } from "../../ui/StatusPill";
import type { Transfer } from "./transfer-query";
export function TransferStatus({ state }: { state: Transfer["state"] }) {
  const { t } = useTranslation();
  const tone = state === "discrepancy" ? "warning" : state === "prepared" ? "neutral" : "success";
  return <StatusPill tone={tone}>{t(`transfers.state.${state}`)}</StatusPill>;
}
