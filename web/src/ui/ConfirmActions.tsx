import * as Primitive from "@radix-ui/react-dialog";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { DialogFooter } from "./DialogFooter";
import { Button } from "./Button";
import styles from "./ui.module.css";
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
        <button ref={cancelRef} className={styles.cancel}>
          {t("common.actions.cancel")}
        </button>
      </Primitive.Close>
      <Button className={styles.destructive} onClick={onConfirm}>
        {actionLabel}
      </Button>
    </DialogFooter>
  );
}
