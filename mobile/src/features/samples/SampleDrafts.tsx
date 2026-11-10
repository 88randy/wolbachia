import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SampleDrafts({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  if (model.hasDraft || model.drafts.length === 0) return null;
  return (
    <Card>
      <AppText variant="bodyStrong">{t("mobile.sample.savedCaptures")}</AppText>
      {model.drafts.map((draft) => (
        <Button
          key={draft.id}
          variant="outline"
          label={draft.label}
          disabled={model.isBusy}
          onPress={() => {
            model.openDraft(draft.id);
          }}
        />
      ))}
    </Card>
  );
}
