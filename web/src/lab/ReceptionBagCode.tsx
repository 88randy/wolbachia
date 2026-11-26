import { useTranslation } from "react-i18next";
import { EmptyValue } from "../ui/EmptyValue";
import { useCan } from "../session/use-can";
import { ResolvedBagCode } from "./ResolvedBagCode";
import { BagCodeLink } from "./trace/BagCodeLink";
import type { ReceptionRow } from "./reception-query";
export function ReceptionBagCode({ row }: { row: ReceptionRow }) {
  const { t } = useTranslation();
  const can = useCan();
  if (row.code) return <BagCodeLink code={row.code} />;
  if (!row.bagId) return <span>{t("labReception.table.noPaddle")}</span>;
  return can("reading.read") ? <ResolvedBagCode id={row.bagId} /> : <EmptyValue />;
}
