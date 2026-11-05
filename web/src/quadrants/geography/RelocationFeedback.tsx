import { useTranslation } from "react-i18next";
import type { PointRelocation } from "./use-point-relocation";
import { WriteNotice } from "./WriteNotice";
import { PointWriteWarnings } from "./PointWriteWarnings";
export function RelocationFeedback({ form }: { form: PointRelocation }) {
  const { t } = useTranslation();
  return (
    <>
      {form.current?.is_retired && <p>{t("geography.status.retired")}</p>}
      {form.failure && <p role="alert">{t(form.failure)}</p>}
      <WriteNotice outcome={form.write.outcome} />
      <PointWriteWarnings outcome={form.write.outcome} points={form.existing.data ?? []} />
    </>
  );
}
