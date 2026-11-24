import type { RefObject } from "react";
import { View, StyleSheet } from "react-native";
import type Svg from "react-native-svg";
import { spacing, radius } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import type { useSignature } from "./use-signature.ts";
import { SignatureRaster } from "./SignatureRaster.tsx";
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    pad: {
      height: spacing[5] * 4,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: theme.color.border.strong,
      backgroundColor: theme.color.surface,
      // box-only: the pad, not the Svg inside it, is the touch target, so locationX/Y are pad-relative.
      pointerEvents: "box-only",
    },
  });
interface Props {
  readonly svg: RefObject<Svg | null>;
  readonly capture: ReturnType<typeof useSignature>;
  readonly strokes: readonly string[];
  readonly disabled: boolean;
}
export function SignatureCanvas({ svg, capture, strokes, disabled }: Props) {
  const styles = useStyles(createStyles);
  const t = useT();
  return (
    <View
      style={styles.pad}
      accessibilityLabel={t("mobile.supplyReceipt.signatureHint")}
      onLayout={({ nativeEvent: { layout } }) => {
        capture.dimensions.current = { width: layout.width, height: layout.height };
      }}
      onStartShouldSetResponder={() => !disabled}
      onResponderMove={capture.add}
      onResponderGrant={(event) => {
        capture.add(event);
        return true; // true blocks the native parent ScrollView from stealing the stroke
      }}
      onResponderRelease={capture.finish}
      onResponderTerminationRequest={() => false}
      onResponderTerminate={capture.finish}
    >
      <SignatureRaster svg={svg} strokes={[...strokes, capture.path]} />
    </View>
  );
}
