import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { InvalidCode } from "./InvalidCode.tsx";
import { CameraControls } from "./CameraControls.tsx";
import type { M07Model } from "./use-m-07.ts";

export function ScannerControls({ model }: { readonly model: M07Model }) {
  const t = useT();
  return (
    <View>
      {model.error ? <InvalidCode reason={model.error} /> : null}
      <CameraControls model={model} />
      <Notice tone="info" icon="phone" message={t("mobile.scanner.damaged")} />
      <ShiftField
        label={t("mobile.scanner.code")}
        value={model.code}
        onChange={model.setCode}
        disabled={model.isBusy}
      />
      <ShiftAction
        label={t("mobile.scanner.lookup")}
        disabled={model.isBusy || !model.code.trim()}
        onPress={() => {
          void model.read(model.code, true);
        }}
      />
      {model.error ? (
        <ShiftAction
          label={t("mobile.scanner.retry")}
          disabled={model.isBusy && model.error !== "storage"}
          onPress={model.retry}
        />
      ) : null}
    </View>
  );
}
