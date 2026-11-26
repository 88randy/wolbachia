import { KitButton } from "./KitButton.tsx";
import type { KitButtonProps } from "./KitButton.tsx";

/** A secondary action: blue outline on white, icon plus verb, at least 56 dp high. */
export function SecondaryButton({
  tone = "default",
  ...props
}: KitButtonProps & { readonly tone?: "default" | "danger" }) {
  return <KitButton variant={tone === "danger" ? "dangerOutline" : "secondary"} {...props} />;
}
