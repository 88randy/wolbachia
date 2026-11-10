import { useTranslation } from "react-i18next";
import { Select } from "../forms/Select";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/DialogFooter";

export interface LabChoiceFormProps {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  submitLabel: string;
  isBusy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/** A dialog body with one required choice, a Cancel and a primary action. */
export function LabChoiceForm(props: LabChoiceFormProps) {
  const { t } = useTranslation();
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    props.onSubmit();
  };
  const change = (event: { target: { value: string } }) => {
    props.onChange(event.target.value);
  };
  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <Select {...pick(props)} onChange={change} />
      <DialogFooter>
        <Button variant="secondary" onClick={props.onCancel}>
          {t("common.actions.cancel")}
        </Button>
        <Button type="submit" loading={props.isBusy}>
          {props.submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function pick({ id, label, value, options }: LabChoiceFormProps) {
  return { id, label, value, options };
}
