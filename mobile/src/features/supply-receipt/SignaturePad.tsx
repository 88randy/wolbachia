import { Check, Eraser } from "lucide-react-native";
import { useRef } from "react";
import { View } from "react-native";
import type Svg from "react-native-svg";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import { nativeSignaturePort } from "./native-signature.ts";
import { SignatureCanvas } from "./SignatureCanvas.tsx";
import { useSignature } from "./use-signature.ts";

interface Props {
  readonly strokes: readonly string[];
  readonly onChange: (strokes: readonly string[]) => void;
  readonly onSign: (port: EvidencePort) => void;
  readonly disabled: boolean;
}

/** Finger signature: draw, "Borrar" to undo the last stroke, "Guardar firma" to keep it. */
export function SignaturePad(props: Props) {
  const svg = useRef<Svg>(null);
  const t = useT();
  const capture = useSignature(props);
  return (
    <View className="gap-3">
      <AppText tone="secondary">{t("field.receipt.signHint")}</AppText>
      <SignatureCanvas {...props} svg={svg} capture={capture} />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <SecondaryButton
            icon={Eraser}
            label={t("field.receipt.signClear")}
            disabled={props.disabled || !props.strokes.length}
            onPress={() => {
              props.onChange(props.strokes.slice(0, -1));
            }}
          />
        </View>
        <View className="flex-1">
          <SecondaryButton
            icon={Check}
            label={t("field.receipt.signKeep")}
            disabled={props.disabled || !props.strokes.length || Boolean(capture.path)}
            onPress={() => {
              props.onSign(nativeSignaturePort(svg.current));
            }}
          />
        </View>
      </View>
    </View>
  );
}
