import { useTranslation } from "react-i18next";

/** An empty table or fact value: a muted dash on screen, "Sin dato" for screen readers. */
export function EmptyValue() {
  const { t } = useTranslation();
  return (
    <span className="text-ink-3">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t("ui.states.noValue")}</span>
    </span>
  );
}
