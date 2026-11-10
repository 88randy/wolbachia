import { useTranslation } from "react-i18next";
import { TypeWriteNotice } from "./TypeWriteNotice";
import { InlineNotice } from "../../ui/InlineNotice";
import type { TypeFormController } from "./use-type-form";
export function TypeFormStatus({
  controller,
  isBlocked,
}: {
  controller: TypeFormController;
  isBlocked: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <TypeWriteNotice controller={controller} />
      {isBlocked && <InlineNotice tone="warning">{t("incidentTypes.error.terminal")}</InlineNotice>}
      <p role="status" aria-live="polite">
        {controller.isSaved ? t("incidentTypes.form.saved") : ""}
      </p>
      <p>
        {t("incidentTypes.form.revision")} <output>{controller.draft.expected_revision}</output>
      </p>
    </>
  );
}
