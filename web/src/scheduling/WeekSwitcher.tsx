import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { addDays } from "./week-dates";

/** Previous / next week buttons that keep the week in the address bar. */
export function WeekSwitcher({ week }: { week: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const go = (value: string) => {
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, week: value, page: undefined }),
    });
  };
  return (
    <>
      <Button
        variant="secondary"
        leadingIcon={<ChevronLeft aria-hidden="true" />}
        onClick={() => {
          go(addDays(week, -7));
        }}
      >
        {t("scheduling.plan.previousWeek")}
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          go(addDays(week, 7));
        }}
        leadingIcon={<ChevronRight aria-hidden="true" />}
      >
        {t("scheduling.plan.nextWeek")}
      </Button>
    </>
  );
}
