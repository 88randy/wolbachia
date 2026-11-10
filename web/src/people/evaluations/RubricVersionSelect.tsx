import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import type { RubricVersion } from "./evaluation-query";
interface Props {
  version: RubricVersion;
  onSelect: (version: RubricVersion) => void;
  isBlocked: boolean;
}
export function RubricVersionSelect({ version, onSelect, isBlocked }: Props) {
  const { t } = useTranslation();
  return (
    <Button
      aria-disabled={isBlocked}
      onClick={() => {
        if (!isBlocked) onSelect(version);
      }}
    >
      {t("evaluations.rubric.select")}
    </Button>
  );
}
