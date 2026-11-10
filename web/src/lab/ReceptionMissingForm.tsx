import { useTranslation } from "react-i18next";
import { TextField } from "../forms/TextField";
import type { ReceptionActions } from "./use-reception-command";
import type { MissingReceptionForm } from "./use-missing-reception";
import { ReceptionMissingFooter } from "./ReceptionMissingFooter";
import { ReceptionFeedback } from "./ReceptionFeedback";

interface ReceptionMissingFormProps {
  id: string;
  form: MissingReceptionForm;
  actions: ReceptionActions;
}
export function ReceptionMissingForm({ id, form, actions }: ReceptionMissingFormProps) {
  const { t } = useTranslation();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.submit();
      }}
    >
      <TextField
        id={`missing-${id}`}
        label={t("labReception.action.reason")}
        value={form.reason}
        maxLength={1000}
        onChange={(event) => {
          form.setReason(event.target.value);
        }}
      />
      <ReceptionFeedback result={form.feedback} />
      <ReceptionMissingFooter form={form} actions={actions} />
    </form>
  );
}
