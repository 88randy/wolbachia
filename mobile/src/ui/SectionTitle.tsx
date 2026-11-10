import { AppText } from "./AppText.tsx";

/** Small heading that groups the cards of a screen. */
export function SectionTitle({ title }: { readonly title: string }) {
  return (
    <AppText variant="bodyStrong" tone="secondary" accessibilityRole="header">
      {title}
    </AppText>
  );
}
