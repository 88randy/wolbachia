import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { ButtonProps } from "../ui/Button";

type CorrectCountTriggerProps = ButtonProps & { canReadReasons: boolean };

export function CorrectCountTrigger({ canReadReasons, ...trigger }: CorrectCountTriggerProps) {
  const { t } = useTranslation();
  return (
    <Button
      {...trigger}
      variant="secondary"
      aria-disabled={!canReadReasons}
      title={!canReadReasons ? t("lab.correction.catalogPermission") : undefined}
    >
      {t("lab.correction.title")}
    </Button>
  );
}
