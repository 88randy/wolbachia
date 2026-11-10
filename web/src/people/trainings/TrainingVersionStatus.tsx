import { useTranslation } from "react-i18next";
import { StatusPill } from "../../ui/StatusPill";
export function TrainingVersionStatus({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={isActive ? "success" : "neutral"}>
      {t(isActive ? "trainings.state.active" : "trainings.state.inactive")}
    </StatusPill>
  );
}
