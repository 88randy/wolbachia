import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import {
  LABEL_KINDS,
  LABEL_KIND_SPECS,
  isLabelKind,
  labelsSearchSchema,
} from "../../labels/label-kinds";
import { toLabelRecord } from "../../labels/label-records";
import { PrintLabelsButton } from "../../labels/PrintLabelsButton";
import { useLabelText } from "../../labels/use-label-text";
import { useCan } from "../../session/use-can";
import { LabelControls } from "./LabelControls";
import { LabelPicker } from "./LabelPicker";
import { useLabelPicker } from "./use-label-picker";
import type { LabelPickerStart } from "./use-label-picker";

/** W19: the one place to print QR labels. Pick a kind, tick records, print with format and copies. */
function LabelTool({
  start,
  kinds,
}: {
  start: LabelPickerStart;
  kinds: LabelPickerStart["kind"][];
}) {
  const { t } = useTranslation();
  const text = useLabelText();
  const model = useLabelPicker(start);
  return (
    <ListPage
      title={t("inventory.labels.title")}
      description={t("inventory.labels.description")}
      actions={
        <PrintLabelsButton
          variant="primary"
          records={model.selected.map((source) => toLabelRecord(source, text))}
        />
      }
    >
      <LabelControls kinds={kinds} kind={model.kind} onKind={model.chooseKind} />
      <LabelPicker model={model} />
    </ListPage>
  );
}

/** Reads the kind the user may print and the optional deep link (`?kind=lot&code=L-0001`). */
export function W19Page() {
  const can = useCan();
  const search = labelsSearchSchema.parse(useSearch({ strict: false }));
  const kinds = LABEL_KINDS.filter((kind) => can(LABEL_KIND_SPECS[kind].permission));
  const asked = isLabelKind(search.kind) && kinds.includes(search.kind) ? search.kind : undefined;
  const first = kinds[0];
  if (first === undefined) return null;
  const start = asked === undefined ? { kind: first } : { kind: asked, code: search.code };
  return <LabelTool start={start} kinds={kinds} />;
}
