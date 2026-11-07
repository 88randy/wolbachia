import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { CatalogChoices } from "./CatalogChoices.tsx";
import { useLifecycleCorrection } from "./use-lifecycle-correction.ts";
import type { LifecycleProps } from "./model.ts";
import { Notice } from "../../ui/Notice.tsx";
export function LifecycleCorrection(props: LifecycleProps) {
  const { model } = props;
  const t = useT();
  const correction = useLifecycleCorrection(props);
  if (correction.isBlocked) return null;
  return (
    <View>
      <CatalogChoices
        items={model.state?.correctionReasons ?? []}
        code={correction.reasonCode}
        isBusy={model.isBusy}
        choose={correction.setCode}
      />
      <Notice tone="info" icon="alert" message={limitMessage(correction.policy, t)} />
      <ShiftField
        label={t("mobile.lifecycle.correctionReason")}
        value={correction.reason}
        disabled={model.isBusy}
        onChange={correction.setReason}
      />
      <ShiftAction
        label={t("mobile.lifecycle.correct")}
        disabled={correction.disabled}
        onPress={correction.correct}
      />
    </View>
  );
}

function limitMessage(
  policy: ReturnType<typeof import("./domain.ts").correctionPolicy>,
  t: ReturnType<typeof useT>,
) {
  return policy
    ? t("mobile.lifecycle.reasonLimits", {
        min: policy.minimum,
        max: policy.maximum,
      })
    : t("mobile.lifecycle.limitsUnavailable");
}
