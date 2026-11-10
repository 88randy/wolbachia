/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "../../ui/Button";

/** Warns before leaving the page (link, back button, tab close) while changes are unsaved. */
export function LeaveGuard({ pendingCount }: { pendingCount: number }) {
  const { t } = useTranslation();
  const blocker = useBlocker({
    shouldBlockFn: () => pendingCount > 0,
    enableBeforeUnload: () => pendingCount > 0,
    withResolver: true,
  });
  return (
    <Dialog
      open={blocker.status === "blocked"}
      onOpenChange={(open) => {
        if (!open && blocker.status === "blocked") blocker.reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("mapEditor.leave.title")}</DialogTitle>
          <DialogDescription>
            {t("mapEditor.leave.body", { count: pendingCount })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="tertiary"
            onClick={() => {
              if (blocker.status === "blocked") blocker.proceed();
            }}
          >
            {t("mapEditor.leave.go")}
          </Button>
          <Button
            onClick={() => {
              if (blocker.status === "blocked") blocker.reset();
            }}
          >
            {t("mapEditor.leave.stay")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
