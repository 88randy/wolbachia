import { useTranslation } from "react-i18next";
import type { ComponentPropsWithoutRef } from "react";
import { Button } from "../ui/Button";
export function ReceptionMissingTrigger({
  isReady,
  ...props
}: ComponentPropsWithoutRef<"button"> & { isReady: boolean }) {
  const { t } = useTranslation();
  return (
    <Button
      {...props}
      variant="secondary"
      aria-disabled={!isReady}
      title={!isReady ? t("labReception.scan.reviewHint") : undefined}
    >
      {t("labReception.action.markMissing")}
    </Button>
  );
}
