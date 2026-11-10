import { CalendarPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useGenerateWeek } from "./use-scheduling-writes";
import { weekNumberOf } from "./week-dates";

/** "Armar la semana": says what will happen before doing it. */
export function GenerateWeekButton({
  week,
  variant = "primary",
}: {
  week: string;
  variant?: "primary" | "secondary";
}) {
  const { t } = useTranslation();
  const generate = useGenerateWeek();
  return (
    <ConfirmDialog
      title={t("scheduling.generate.title", { week: weekNumberOf(week) })}
      consequence={t("scheduling.generate.consequence")}
      actionLabel={t("scheduling.generate.confirm")}
      onConfirm={() => {
        generate.mutate(week);
      }}
      trigger={
        <Button
          variant={variant}
          leadingIcon={<CalendarPlus aria-hidden="true" />}
          loading={generate.isPending}
        >
          {t("scheduling.generate.action")}
        </Button>
      }
    />
  );
}
