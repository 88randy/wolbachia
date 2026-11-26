import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LabChoiceForm } from "./LabChoiceForm";

export interface LabChoiceDialogProps {
  id: string;
  title: string;
  description: string;
  fieldLabel: string;
  submitLabel: string;
  options: readonly { value: string; label: string }[];
  initial: string;
  isBusy: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the chosen value and a `close` to call when the command succeeded. */
  onSubmit: (value: string, close: () => void) => void;
}

/** A dialog asking for one choice, opened from a row "⋯" menu, then runs a command. */
export function LabChoiceDialog(props: LabChoiceDialogProps) {
  const [value, setValue] = useState(props.initial);
  const close = () => {
    props.onOpenChange(false);
  };
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
