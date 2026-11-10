import { KitButton } from "./KitButton.tsx";
import type { KitButtonProps } from "./KitButton.tsx";

/** A secondary action: blue outline on white, icon plus verb, at least 56 dp high. */
export function SecondaryButton(props: KitButtonProps) {
  return <KitButton variant="secondary" {...props} />;
}
