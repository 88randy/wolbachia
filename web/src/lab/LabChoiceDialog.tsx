import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { LabChoiceForm } from "./LabChoiceForm";

interface LabChoiceDialogProps {
  id: string;
  title: string;
  description: string;
  triggerLabel: string;
  icon: LucideIcon;
  fieldLabel: string;
  submitLabel: string;
  options: readonly { value: string; label: string }[];
  initial: string;
  isBusy: boolean;
  /** Receives the chosen value and a `close` to call when the command succeeded. */
  onSubmit: (value: string, close: () => void) => void;
}

/** Row action that opens a dialog asking for one choice, then runs a command. */
export function LabChoiceDialog(props: LabChoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(props.initial);
  const close = () => {
    setOpen(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={props.title}
      description={props.description}
      trigger={<ChoiceTrigger icon={props.icon} label={props.triggerLabel} />}
    >
      <LabChoiceForm
        id={props.id}
        label={props.fieldLabel}
        value={value}
        options={props.options}
        submitLabel={props.submitLabel}
        isBusy={props.isBusy}
        onChange={setValue}
        onSubmit={() => {
          props.onSubmit(value, close);
        }}
        onCancel={close}
      />
    </Dialog>
  );
}

function ChoiceTrigger({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <Button size="sm" variant="secondary" leadingIcon={<Icon aria-hidden="true" />}>
      {label}
    </Button>
  );
}
