import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { useFormatDateTime } from "../format/use-format-date-time";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { conflictOptions } from "./lab-query";
import type { LabScope } from "./lab-query";
/** Read the current result only when authorized; 409 itself exposes no actor or timestamp. */
export function ConflictCount({ scope, code }: { scope: LabScope; code: string }) {
  const { t } = useTranslation();
  const canRead = useCan()("egg_count.read");
  const query = useQuery({ ...conflictOptions(scope, code), enabled: scope.identity.isSettled && canRead });
  const format = useFormatDateTime();
  if (!canRead) return <p>{t("lab.error.conflictHidden")}</p>;
  if (query.isPending) return <CardSkeleton />;
  if (query.isError) return <ErrorState onRetry={() => { void query.refetch(); }} />;
  const count = query.data.results[0];
  if (!count) return <p>{t("lab.error.conflictMissing")}</p>;
  return <dl><dt>{t("lab.history.author")}</dt><dd>{count.created_by}</dd><dt>{t("lab.history.time")}</dt><dd><time dateTime={count.created_at}>{format(count.created_at)}</time></dd></dl>;
}
