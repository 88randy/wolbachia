import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { ResolvedBagCode } from "./ResolvedBagCode";
import type { ReceptionRow } from "./reception-query";
export function ReceptionBagCode({ row }: { row: ReceptionRow }) {
  const { t } = useTranslation();
  const can = useCan();
  if (row.code) return <span>{row.code}</span>;
  if (!row.bagId) return <span>{t("labReception.table.noPaddle")}</span>;
  return can("reading.read") ? <ResolvedBagCode id={row.bagId} /> : <span>{row.bagId}</span>;
}
