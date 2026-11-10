import * as Primitive from "@radix-ui/react-dialog";
import { ConfirmDialogContent } from "../ui/ConfirmDialogContent";
import { OVERLAY_CLASS } from "../ui/overlay-classes";

/** A confirmation that a wizard opens from its own Next button, and that names the consequence. */
export function ConfirmApply({
  open,
  onOpenChange,
  title,
  consequence,
  actionLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  consequence: string;
  actionLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className={OVERLAY_CLASS} />
        <ConfirmDialogContent
          title={title}
          consequence={consequence}
          actionLabel={actionLabel}
          onConfirm={() => {
            onOpenChange(false);
            onConfirm();
          }}
        />
      </Primitive.Portal>
    </Primitive.Root>
  );
}
