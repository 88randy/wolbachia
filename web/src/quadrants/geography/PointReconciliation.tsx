import { useTranslation } from "react-i18next";
import type { FourPoints } from "./use-four-points";
export function PointReconciliation({ form }: { form: FourPoints }) {
  const { t } = useTranslation();
  const reconciliation = form.reconciliation;
  if (!reconciliation.uncertain) return null;
  return (
    <div>
      <p role="status">
        {t("geography.points.uncertain")} {reconciliation.uncertain.code}
      </p>
      <button
        type="button"
        disabled={reconciliation.isChecking}
        onClick={() => {
          void reconciliation.reconcile();
        }}
      >
        {t("geography.points.reconcile")}
      </button>
      {reconciliation.message && <p role="alert">{t(reconciliation.message)}</p>}
    </div>
  );
}
