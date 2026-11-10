import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";

interface Props {
  readonly label: MessageKey;
  readonly value: string | number | null | undefined;
}
export function TrainingFact({ label, value }: Props) {
  const t = useT();
  return value === null || value === undefined || value === "" ? null : (
    <AppText variant="caption">
      {t(label)}
      {" · "}
      {value}
    </AppText>
  );
}
