import { useRef } from "react";
import { View } from "react-native";
import type Svg from "react-native-svg";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import { nativeSignaturePort } from "./native-signature.ts";
import { SignatureActions } from "./SignatureActions.tsx";
import { SignatureCanvas } from "./SignatureCanvas.tsx";
import { isMeaningfulSignature } from "./signature-path.ts";
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
      <SignatureActions
        canClear={!props.disabled && props.strokes.length > 0}
        canKeep={!props.disabled && !capture.path && isMeaningfulSignature(props.strokes)}
        onClear={() => {
          props.onChange(props.strokes.slice(0, -1));
        }}
        onKeep={() => {
          props.onSign(nativeSignaturePort(svg.current));
        }}
      />
    </View>
  );
}
