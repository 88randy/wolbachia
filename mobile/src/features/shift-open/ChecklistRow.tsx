import { useLocale } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import type { Check, ChecklistItem } from "./domain.ts";
import { CheckResults } from "./CheckResults.tsx";
import { ChecklistNote } from "./ChecklistNote.tsx";
interface Props {
  readonly item: ChecklistItem;
  readonly check?: Check;
  readonly onChange: (check: Check) => void;
}
export function ChecklistRow({ item, check, onChange }: Props) {
  const locale = useLocale();
  return (
    <Card>
      <AppText variant="button">
        {locale === "en" && item.label_en ? item.label_en : item.label_es}
      </AppText>
      <CheckResults
        check={check}
        onSelect={(result) => {
          onChange({
            item: item.code,
            result,
            ...(check?.note === undefined ? {} : { note: check.note }),
          });
        }}
      />
      {check === undefined ? null : <ChecklistNote item={item} check={check} onChange={onChange} />}
    </Card>
  );
}
