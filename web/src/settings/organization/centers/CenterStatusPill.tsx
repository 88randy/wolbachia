import { useTranslation } from "react-i18next";
import { StatusPill } from "../../../ui/StatusPill";

/** Activo / Inactivo, with color and text. */
export function CenterStatusPill({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={isActive ? "success" : "neutral"}>
      {t(isActive ? "centersAdmin.status.active" : "centersAdmin.status.inactive")}
    </StatusPill>
  );
}
