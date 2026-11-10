/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { DialogFooter } from "../ui/DialogFooter";
import { InlineNotice } from "../ui/InlineNotice";

export interface FormDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  submitLabel: string;
  /** Called with `close`; the caller closes the dialog when the server accepted. */
  onSubmit: (close: () => void) => void;
  canSubmit: boolean;
  isBusy: boolean;
  hasFailed: boolean;
  destructive?: boolean;
  onReset?: () => void;
  children: ReactNode;
}

/** A form inside a dialog: Cancel and one action, the failure shown above them, focus handled by Radix. */
export function FormDialog(props: FormDialogProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const close = () => {
    setIsOpen(false);
    props.onReset?.();
  };
  return (
    <Dialog
      trigger={props.trigger}
      title={props.title}
      description={props.description}
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) props.onReset?.();
      }}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (props.canSubmit && !props.isBusy) props.onSubmit(close);
        }}
      >
        {props.children}
        {props.hasFailed && (
          <InlineNotice tone="critical">{t("regulatory.common.failed")}</InlineNotice>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={close}>
            {t("regulatory.common.cancel")}
          </Button>
          <Button
            type="submit"
            variant={props.destructive ? "destructive" : "primary"}
            loading={props.isBusy}
            aria-disabled={!props.canSubmit || undefined}
          >
            {props.submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
