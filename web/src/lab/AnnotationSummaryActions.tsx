import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/DialogFooter";
import type { AnnotationSummaryProps } from "./AnnotationSummaryDialog";

type Props = Pick<AnnotationSummaryProps, "write" | "onOpenChange" | "onSubmit">;

function submitLabel(
  kind: Props["write"]["failure"],
): "lab.count.confirm" | "lab.count.retry" | "labAnnotation.summary.save" {
  return kind?.kind === "confirm"
    ? "lab.count.confirm"
    : kind?.kind === "uncertain"
      ? "lab.count.retry"
      : "labAnnotation.summary.save";
}

export function AnnotationSummaryActions(props: Props) {
  const { t } = useTranslation();
  const kind = props.write.failure?.kind;
  const label = submitLabel(props.write.failure);
  return (
    <DialogFooter>
      <Button
        variant="secondary"
        aria-disabled={props.write.isBusy || kind === "uncertain"}
        onClick={() => {
          props.onOpenChange(false);
        }}
      >
        {t("labAnnotation.summary.cancel")}
      </Button>
      <Button
        loading={props.write.isBusy}
        aria-disabled={kind === "conflict"}
        onClick={() => {
          props.onSubmit(kind === "confirm");
        }}
      >
        {t(label)}
      </Button>
    </DialogFooter>
  );
}
