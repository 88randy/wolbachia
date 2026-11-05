import { messages } from "@wolbachia/i18n";
import { useMemo } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { VoidDialog, useVoidLimits } from "../../void";
import type { VoidChoice } from "../../void";
interface Props {
  code: string;
  onEvidence: (text: string) => void;
  onClose: () => void;
}
/** Reuse the shared catalog reason and focus lifecycle; recording evidence does not publish. */
export function RetirementDialog({ code, onEvidence, onClose }: Props) {
  const { i18n, t } = useTranslation();
  const limits = useVoidLimits();
  const language = useMemo(() => {
    const local = i18n.cloneInstance({ forkResourceStore: true });
    local.addResources(i18n.language, "translation", {
      "voiding.dialog.title":
        messages[i18n.language === "en" ? "en" : "es-MX"]["geography.retire.dialogTitle"],
      "voiding.dialog.hint": t("geography.retire.hint"),
      "voiding.dialog.confirm": t("geography.retire.confirm"),
    });
    return local;
  }, [i18n, t]);
  const submit = ({ reasonCode, reason }: VoidChoice) => {
    onEvidence(reason ? reason : reasonCode);
    return Promise.resolve({ ok: true } as const);
  };
  return (
    <I18nextProvider i18n={language}>
      <VoidDialog
        record={code}
        limits={limits}
        submit={submit}
        onVoided={onClose}
        onCancel={onClose}
      />
    </I18nextProvider>
  );
}
