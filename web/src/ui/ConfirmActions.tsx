import * as Primitive from "@radix-ui/react-dialog";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { DialogFooter } from "./DialogFooter";
import { Button } from "./Button";
interface ConfirmActionsProps {
  cancelRef: RefObject<HTMLButtonElement | null>;
  actionLabel: string;
  onConfirm: () => void;
}
export function ConfirmActions({ cancelRef, actionLabel, onConfirm }: ConfirmActionsProps) {
  const { t } = useTranslation();
  return (
    <DialogFooter>
      <Primitive.Close asChild>
        <Button ref={cancelRef} variant="tertiary">
          {t("common.actions.cancel")}
        </Button>
      </Primitive.Close>
      <Button variant="destructive" onClick={onConfirm}>
        {actionLabel}
      </Button>
    </DialogFooter>
  );
}
