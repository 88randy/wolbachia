import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { AnnotationViewerContent } from "./AnnotationViewerContent";
import type { LabScope } from "./lab-query";

export function EggAnnotationViewer({ scope, countId }: { scope: LabScope; countId: string }) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  return (
    <Dialog
      open={isOpen}
      onOpenChange={setOpen}
      title={t("labAnnotation.editor.viewer")}
      description={t("labAnnotation.editor.readOnly")}
      trigger={<Button variant="ghost">{t("labAnnotation.editor.viewer")}</Button>}
    >
      {isOpen && <AnnotationViewerContent scope={scope} countId={countId} />}
    </Dialog>
  );
}
