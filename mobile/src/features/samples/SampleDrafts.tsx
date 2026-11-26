import { FileText } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SampleDrafts({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  if (model.hasDraft || model.drafts.length === 0) return null;
  return (
    <>
      <SectionTitle title={t("mobile.sample.savedCaptures")} />
      {model.drafts.map((draft) => (
        <SecondaryButton
          key={draft.id}
          icon={FileText}
          label={draft.label}
          disabled={model.isBusy}
          onPress={() => {
            model.openDraft(draft.id);
          }}
        />
      ))}
    </>
  );
}
