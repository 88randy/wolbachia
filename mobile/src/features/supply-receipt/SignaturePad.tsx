import { useRef } from "react";
import { View, StyleSheet } from "react-native";
import type Svg from "react-native-svg";
import { spacing } from "@wolbachia/tokens";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import { useSignature } from "./use-signature.ts";
import { SignatureCanvas } from "./SignatureCanvas.tsx";
import { nativeSignaturePort } from "./native-signature.ts";
const styles = StyleSheet.create({ content: { gap: spacing[1] } });
interface Props {
  readonly strokes: readonly string[];
  readonly onChange: (strokes: readonly string[]) => void;
  readonly onSign: (port: EvidencePort) => void;
  readonly disabled: boolean;
}
export function SignaturePad(props: Props) {
  const svg = useRef<Svg>(null);
  const t = useT();
  const capture = useSignature(props);
  return (
    <View style={styles.content}>
      <AppText variant="button">{t("mobile.supplyReceipt.signatureTitle")}</AppText>
      <AppText>{t("mobile.supplyReceipt.signatureHint")}</AppText>
      <SignatureCanvas {...props} svg={svg} capture={capture} />
      <Button
        label={t("mobile.supplyReceipt.undo")}
        variant="outline"
        disabled={props.disabled || !props.strokes.length}
        onPress={() => {
          props.onChange(props.strokes.slice(0, -1));
        }}
      />
      <Button
        label={t("mobile.supplyReceipt.signatureCapture")}
        disabled={props.disabled || !props.strokes.length || Boolean(capture.path)}
        onPress={() => {
          props.onSign(nativeSignaturePort(svg.current));
        }}
      />
    </View>
  );
}
