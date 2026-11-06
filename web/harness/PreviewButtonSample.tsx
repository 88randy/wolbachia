import { useTranslation } from "react-i18next";
import { Button } from "../src/ui/Button";
import type { ButtonProps } from "../src/ui/Button";
import type { PreviewButtonState, PreviewButtonVariant } from "./preview-button-options";
interface PreviewButtonSampleProps {
  entry: PreviewButtonVariant;
  state: PreviewButtonState;
  size: ButtonProps["size"];
}
export function PreviewButtonSample({ entry, state, size }: PreviewButtonSampleProps) {
  const { t } = useTranslation();
  const Icon = entry.icon;
  return (
    <Button
      variant={entry.variant}
      size={size}
      leadingIcon={state === "icon" ? <Icon strokeWidth={1.5} aria-hidden="true" /> : undefined}
      disabled={state === "disabled"}
      loading={state === "loading"}
      aria-describedby={state === "disabled" ? "preview-disabled-reason" : undefined}
    >
      {t(`refresh.preview.${entry.key}`)}
    </Button>
  );
}
