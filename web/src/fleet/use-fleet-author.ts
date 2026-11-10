import { useTranslation } from "react-i18next";
/** The contract supplies audit ids, not names. Show the reference honestly. */
export function useFleetAuthor() {
  const { t } = useTranslation();
  return (id: string | null) => (id === null ? t("fleet.summary.system") : "—");
}
