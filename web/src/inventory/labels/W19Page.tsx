import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import {
  LABEL_KINDS,
  canPrintKind,
  isLabelKind,
  labelsSearchSchema,
} from "../../labels/label-kinds";
import { toLabelRecord } from "../../labels/label-records";
import { LabelPrintPanel } from "../../labels/LabelPrintPanel";
import { useLabelText } from "../../labels/use-label-text";
import { useCan } from "../../session/use-can";
import { LabelControls } from "./LabelControls";
import { LabelPicker } from "./LabelPicker";
import { NewOvitrapLabels } from "./NewOvitrapLabels";
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
    <ListPage title={t("inventory.labels.title")} description={t("inventory.labels.description")}>
      <LabelControls kinds={kinds} kind={model.kind} onKind={model.chooseKind} />
      {model.canMint && <NewOvitrapLabels model={model.newLabels} />}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <LabelPicker model={model} />
        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <LabelPrintPanel records={model.selected.map((source) => toLabelRecord(source, text))} />
        </div>
      </div>
    </ListPage>
  );
}

/** Reads the kind the user may print and the optional deep link (`?kind=lot&code=L-0001`). */
export function W19Page() {
  const can = useCan();
  const search = labelsSearchSchema.parse(useSearch({ strict: false }));
  const kinds = LABEL_KINDS.filter((kind) => canPrintKind(can, kind));
  const asked = isLabelKind(search.kind) && kinds.includes(search.kind) ? search.kind : undefined;
  const first = kinds[0];
  if (first === undefined) return null;
  const start = asked === undefined ? { kind: first } : { kind: asked, code: search.code };
  return <LabelTool start={start} kinds={kinds} />;
}
