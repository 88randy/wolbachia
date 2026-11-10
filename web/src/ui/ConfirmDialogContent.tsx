import * as Primitive from "@radix-ui/react-dialog";
import { useRef } from "react";
import { ConfirmActions } from "./ConfirmActions";
import { DIALOG_CLASS, DIALOG_DESCRIPTION_CLASS, DIALOG_TITLE_CLASS } from "./overlay-classes";
interface ConfirmDialogContentProps {
  title: string;
  consequence: string;
  actionLabel: string;
  onConfirm: () => void;
}
export function ConfirmDialogContent({
  title,
  consequence,
  actionLabel,
  onConfirm,
}: ConfirmDialogContentProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Primitive.Content
      className={DIALOG_CLASS}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        cancelRef.current?.focus();
      }}
    >
      <Primitive.Title className={DIALOG_TITLE_CLASS}>{title}</Primitive.Title>
      <Primitive.Description className={DIALOG_DESCRIPTION_CLASS}>
        {consequence}
      </Primitive.Description>
      <ConfirmActions cancelRef={cancelRef} actionLabel={actionLabel} onConfirm={onConfirm} />
    </Primitive.Content>
  );
}
