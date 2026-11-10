import { Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import { useCan } from "../../session/use-can";
import { Button } from "../../ui/Button";
import { LABEL_KINDS, LABEL_KIND_SPECS } from "./label-kinds";
import { LabelControls } from "./LabelControls";
import { LabelPicker } from "./LabelPicker";
import { LabelSheet } from "./LabelSheet";
import { useLabelSheet } from "./use-label-sheet";

function PrintButton({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  return (
    <Button
      leadingIcon={<Printer aria-hidden="true" />}
      disabled={disabled}
      title={disabled ? t("inventory.labels.printDisabled") : undefined}
      onClick={() => {
        window.print();
      }}
    >
      {t("inventory.labels.print")}
    </Button>
  );
}

/** W19: pick records of one type and print their QR labels on a real-size sheet. */
export function W19Page() {
  const { t } = useTranslation();
  const can = useCan();
  const kinds = LABEL_KINDS.filter((kind) => can(LABEL_KIND_SPECS[kind].permission));
  const model = useLabelSheet(kinds[0] ?? "lots");
  return (
    <ListPage
      title={t("inventory.labels.title")}
      description={t("inventory.labels.description")}
      actions={<PrintButton disabled={model.selected.length === 0} />}
    >
      <LabelControls
        kinds={kinds}
        kind={model.kind}
        onKind={model.chooseKind}
        size={model.size}
        onSize={model.setSize}
      />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <LabelPicker model={model} />
        <LabelSheet kind={model.kind} size={model.size} items={model.selected} />
      </div>
    </ListPage>
  );
}
