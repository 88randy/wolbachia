import { ArrowRight, Bike, RotateCw } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { MotorcycleList } from "./MotorcycleList.tsx";
import { MotorcycleScanner } from "./MotorcycleScanner.tsx";
import { OpenFrame } from "./OpenFrame.tsx";
import { useCatalogDownload } from "./use-catalog-download.ts";
import type { M04Model } from "./use-m-04.ts";

const NO_OPTIONS: readonly never[] = [];

/** Step 1 of 4: pick the motorcycle from the list or scan its QR. Nobody types a code. */
export function P4Screen({ model }: { readonly model: M04Model }) {
  const t = useT();
  const download = useCatalogDownload(model);
  const draft = model.state?.draft;
  const options = model.state?.catalog?.motorcycles ?? NO_OPTIONS;
  if (!draft) return null;
  const hasList = options.length > 0;
  return (
    <OpenFrame
      model={model}
      step="motorcycle"
      footer={
        <PrimaryButton
          icon={ArrowRight}
          label={t("field.action.next")}
          disabled={model.isBusy || !draft.motorcycle_code.trim()}
          disabledReason={t("field.hint.pickMotorcycle")}
          onPress={() => {
            void model.run(() => model.service.update({ step: "checklist" }));
          }}
        />
      }
    >
      <StepQuestion
        title={t("field.open.motorcycleQuestion")}
        hint={t("field.open.motorcycleHint")}
      />
      {hasList ? (
        <>
          <MotorcycleScanner
            options={options}
            onFound={(option) => {
              if (!option.isBlocked) model.edit({ motorcycle_code: option.code });
            }}
          />
          <MotorcycleList
            options={options}
            selectedCode={draft.motorcycle_code}
            onSelect={(option) => {
              model.edit({ motorcycle_code: option.code });
            }}
          />
        </>
      ) : download.isLoading ? (
        <Skeleton />
      ) : (
        <EmptyState
          icon={Bike}
          title={t("field.open.noMotorcycles")}
          message={t("field.open.noMotorcyclesHint")}
          actionLabel={t("field.action.retry")}
          actionIcon={RotateCw}
          onAction={download.retry}
        />
      )}
    </OpenFrame>
  );
}
