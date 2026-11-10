import { useTranslation } from "react-i18next";
export function TrainingVersionReference({ id }: { id: string | null }) {
  const { t } = useTranslation();
  return <span>{id ?? t("trainings.state.unconfigured")}</span>;
}
