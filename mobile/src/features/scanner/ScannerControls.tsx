import { Search } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { CameraControls } from "./CameraControls.tsx";
import { InvalidCode } from "./InvalidCode.tsx";
import type { M07Model } from "./use-m-07.ts";

/**
 * Under the camera: problems in plain words, the torch, and, only if the sticker is damaged, a
 * hidden way to write the code that is shown when the courier asks for it.
 */
export function ScannerControls({ model }: { readonly model: M07Model }) {
  const t = useT();
  const [isManual, setManual] = useState(false);
  return (
    <View className="gap-3">
      {model.error ? <InvalidCode reason={model.error} /> : null}
      <CameraControls model={model} />
      {isManual ? (
        <>
          <ShiftField
            label={t("field.scan.codeLabel")}
            value={model.code}
            onChange={model.setCode}
            disabled={model.isBusy}
          />
          <SecondaryButton
            icon={Search}
            label={t("field.scan.useCode")}
            disabled={model.isBusy || !model.code.trim()}
            onPress={() => {
              void model.read(model.code, true);
            }}
          />
        </>
      ) : (
        <SecondaryButton
          label={t("field.scan.damaged")}
          onPress={() => {
            setManual(true);
          }}
        />
      )}
    </View>
  );
}
