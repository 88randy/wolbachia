import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/Dialog";
import { AnnotationSummaryActions } from "./AnnotationSummaryActions";
import { CountFeedback } from "./CountFeedback";
import type { AnnotationMark } from "./annotation-state";
import type { LabScope } from "./lab-query";
import type { useLabWrite } from "./use-lab-write";
export interface AnnotationSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marks: AnnotationMark[];
  code: string;
  scope: LabScope;
  write: ReturnType<typeof useLabWrite>;
  onSubmit: (confirmed: boolean) => void;
}
function useSummaryDialog(props: AnnotationSummaryProps) {
  const { t } = useTranslation();
  const boxes = props.marks.filter((mark) => mark.kind === "box").length;
  const kind = props.write.failure?.kind;
  return {
    open: props.open,
    onOpenChange: (open: boolean) => {
      if (!props.write.isBusy && kind !== "uncertain") props.onOpenChange(open);
    },
    trigger: null,
    title: t("labAnnotation.summary.title", { code: props.code }),
    description: t("labAnnotation.summary.description", {
      count: props.marks.length,
      boxes,
      points: props.marks.length - boxes,
    }),
  };
}

export function AnnotationSummaryDialog(props: AnnotationSummaryProps) {
  const dialog = useSummaryDialog(props);
  return (
    <Dialog {...dialog}>
      <CountFeedback scope={props.scope} code={props.code} failure={props.write.failure} />
      <AnnotationSummaryActions {...props} />
    </Dialog>
  );
}
