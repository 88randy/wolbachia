import { Keyboard, Search } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { CameraControls } from "./CameraControls.tsx";
import { InvalidCode } from "./InvalidCode.tsx";
import type { M07Model } from "./use-m-07.ts";

/**
 * Under the camera: problems in plain words, the torch, and always a way to type the code (the
 * label may be damaged or the camera may not work). It opens by itself when the camera has a problem.
 * A typed code goes through the same check as a scanned one.
 */
export function ScannerControls({ model }: { readonly model: M07Model }) {
  const t = useT();
  const [isTyping, setTyping] = useState(false);
  const isManual = isTyping || model.cameraError !== null;
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
          icon={Keyboard}
          label={t("field.scan.typeCode")}
          onPress={() => {
            setTyping(true);
          }}
        />
      )}
    </View>
  );
}
