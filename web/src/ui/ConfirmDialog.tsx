import * as Primitive from "@radix-ui/react-dialog";
import { useState } from "react";
import type { ReactNode } from "react";
import { ConfirmDialogContent } from "./ConfirmDialogContent";
import { OVERLAY_CLASS } from "./overlay-classes";
interface ConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  consequence: string;
  actionLabel: string;
  onConfirm: () => void;
}
/** High-impact actions start on Cancel; the consequence and action must be named by the caller. */
export function ConfirmDialog({
  trigger,
  title,
  consequence,
  actionLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  function confirmAction() {
    onConfirm();
    setIsOpen(false);
  }
  return (
    <Primitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Overlay className={OVERLAY_CLASS} />
        <ConfirmDialogContent
          title={title}
          consequence={consequence}
          actionLabel={actionLabel}
          onConfirm={confirmAction}
        />
      </Primitive.Portal>
    </Primitive.Root>
  );
}
