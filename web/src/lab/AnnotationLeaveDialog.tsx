import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/DialogFooter";
import { ModalDialog } from "../ui/ModalDialog";
import type { useAnnotationNavigation } from "./use-annotation-navigation";

export function AnnotationLeaveDialog({
  blocker,
  hasDraftFailure,
}: {
  blocker: ReturnType<typeof useAnnotationNavigation>["blocker"];
  hasDraftFailure: boolean;
}) {
  const { t } = useTranslation();
  if (blocker.status !== "blocked") return null;
  return (
    <ModalDialog title={t("labAnnotation.leave.title")} onClose={blocker.reset}>
      <p>
        {t(hasDraftFailure ? "labAnnotation.leave.draftFailed" : "labAnnotation.leave.description")}
      </p>
      <DialogFooter>
        <Button variant="secondary" onClick={blocker.reset}>
          {t("labAnnotation.summary.cancel")}
        </Button>
        <Button onClick={blocker.proceed}>{t("labAnnotation.leave.accept")}</Button>
      </DialogFooter>
    </ModalDialog>
  );
}
