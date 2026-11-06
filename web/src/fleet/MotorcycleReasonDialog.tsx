import { I18nextProvider } from "react-i18next";
import { VoidDialog, useVoidLimits } from "../void";
import type { Motorcycle } from "./fleet-query";
import { useMotorcycleAction } from "./use-motorcycle-action";
import { useActionDialogLanguage } from "./use-action-dialog-language";
interface Props {
  motorcycle: Motorcycle;
  onDone: () => void;
  onCancel: () => void;
}
export function MotorcycleReasonDialog({ motorcycle, onDone, onCancel }: Props) {
  const language = useActionDialogLanguage();
  const limits = useVoidLimits();
  const submit = useMotorcycleAction(motorcycle.id, "void");
  return (
    <I18nextProvider i18n={language}>
      <VoidDialog
        record={motorcycle.code}
        limits={limits}
        submit={submit}
        onVoided={onDone}
        onCancel={onCancel}
      />
    </I18nextProvider>
  );
}
