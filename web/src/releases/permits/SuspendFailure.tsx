import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { FormAlert } from "../../forms/FormAlert";

/** Why the suspension did not go through; the typed reason is kept in the form. */
export function SuspendFailure({ failure }: { failure: MessageKey | undefined }) {
  const { t } = useTranslation();
  const id = useId();
  if (failure === undefined) return null;
  return <FormAlert id={id} title={t("permits.suspend.failure")} text={t(failure)} />;
}
