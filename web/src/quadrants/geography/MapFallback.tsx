import { useTranslation } from "react-i18next";
export function MapFallback() {
  const { t } = useTranslation();
  return <p role="status">{t("geography.map.fallback")}</p>;
}
