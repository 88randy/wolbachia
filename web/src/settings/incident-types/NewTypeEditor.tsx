import { useTranslation } from "react-i18next";
import { useToast } from "../../ui/toast-context";
import { TypeEditor } from "./TypeEditor";
import type { useW06 } from "./use-w-06";
export function NewTypeEditor({ controller }: { controller: ReturnType<typeof useW06> }) {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <TypeEditor
      scope={controller.scope}
      isReady
      onClose={controller.close}
      onReview={() => Promise.resolve(undefined)}
      onSaved={(item) => {
        toast.showToast({ message: t("incidentTypes.form.saved"), tone: "success" });
        controller.edit(item.code);
      }}
    />
  );
}
