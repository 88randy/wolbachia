import { View } from "react-native";
import { AppText } from "./AppText.tsx";
import { KitButton } from "./KitButton.tsx";
import type { KitButtonProps } from "./KitButton.tsx";

export type PrimaryButtonProps = KitButtonProps & {
  /** `danger` is only for irreversible or safety actions (for example "Retirar ovitrampa"). */
  readonly tone?: "default" | "danger";
  /** One short line shown under the button while it is disabled: what is missing. */
  readonly disabledReason?: string;
};

/** The one main action of a screen: filled blue, icon plus verb, at least 56 dp high. */
export function PrimaryButton({ tone = "default", disabledReason, ...props }: PrimaryButtonProps) {
  const button = <KitButton variant={tone === "danger" ? "danger" : "primary"} {...props} />;
  if (!props.disabled || !disabledReason) return button;
  return (
    <View className="gap-2">
      {button}
      <AppText variant="caption" tone="secondary" style={{ textAlign: "center" }}>
        {disabledReason}
      </AppText>
    </View>
  );
}
