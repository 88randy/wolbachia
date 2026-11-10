import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";

export function CountHistoryLink({ code }: { code: string }) {
  const { t } = useTranslation();
  const canRead = useCan()("egg_count.read");
  if (!canRead) return null;
  return (
    <Link to="/lab/count-history" search={{ code }}>
      {t("lab.history.link")}
    </Link>
  );
}
