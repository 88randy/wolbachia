import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { CatalogChoices } from "../ovitrap-lifecycle/CatalogChoices.tsx";
import { ShrinkagePhoto } from "./ShrinkagePhoto.tsx";
import type { ReconcileDraft } from "./domain.ts";
import type { ShrinkageLine } from "./ShrinkageField.tsx";
import type { M14Model } from "./use-m-14.ts";

interface Props {
  readonly model: M14Model;
  readonly supply: ReconcileDraft;
  readonly line: ShrinkageLine;
  readonly edit: (patch: Partial<ShrinkageLine>) => void;
}
function shrinkageActions(edit: Props["edit"]) {
  return {
    choose: (reasonCode: string) => {
      edit({ reasonCode });
    },
    changeReason: (reason: string) => {
      edit({ reason });
    },
  };
}
export function ShrinkageEvidenceFields({ model, supply, line, edit }: Props) {
  const t = useT();
  const actions = shrinkageActions(edit);
  return (
    <>
      <CatalogChoices
        items={model.state?.reasons ?? []}
        code={line.reasonCode}
        isBusy={model.isBusy}
        choose={actions.choose}
      />
      <ShiftField
        label={t("mobile.shiftClose.reason")}
        value={line.reason}
        disabled={model.isBusy}
        onChange={actions.changeReason}
      />
      <ShrinkagePhoto model={model} supply={supply} />
    </>
  );
}
