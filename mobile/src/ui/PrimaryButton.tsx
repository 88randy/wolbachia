import { KitButton } from "./KitButton.tsx";
import type { KitButtonProps } from "./KitButton.tsx";

export type PrimaryButtonProps = KitButtonProps & {
  /** `danger` is only for irreversible or safety actions (for example "Retirar ovitrampa"). */
  readonly tone?: "default" | "danger";
};

/** The one main action of a screen: filled blue, icon plus verb, at least 56 dp high. */
export function PrimaryButton({ tone = "default", ...props }: PrimaryButtonProps) {
  return <KitButton variant={tone === "danger" ? "danger" : "primary"} {...props} />;
}
