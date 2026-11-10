import { useTranslation } from "react-i18next";
import { ApiError } from "@wolbachia/api-client";
import { InlineNotice } from "../../ui/InlineNotice";
export function TrainingCommandError({ error }: { error: unknown }) {
  const { t } = useTranslation();
  return (
    <InlineNotice tone="critical">
      {t("trainings.form.failed")}
      {error instanceof ApiError && (
        <details>
          <summary>{t("ui.actions.details")}</summary>
          <code>{error.code}</code>
        </details>
      )}
    </InlineNotice>
  );
}
