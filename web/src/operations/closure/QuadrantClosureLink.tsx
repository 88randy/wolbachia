import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
export function QuadrantClosureLink({ code }: { code: string }) {
  const { t } = useTranslation();
  return (
    <Link to="/quadrants/$code/closure" params={{ code }}>
      {t("closure.actions.close")}
    </Link>
  );
}
