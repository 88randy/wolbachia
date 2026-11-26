import { FileText } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
import type { IncidentKind } from "./types.ts";
import type { M12Model } from "./use-m-12.ts";

export function IncidentDrafts({
  model,
  kind,
}: {
  readonly model: M12Model;
  readonly kind: IncidentKind;
}) {
  const t = useT();
  const drafts = model.state?.drafts.filter((draft) => draft.kind === kind) ?? [];
  const currentId = model.state?.draft?.eventId;
  const others = drafts.filter((draft) => draft.eventId !== currentId);
  if (!others.length) return null;
  return (
    <>
      <SectionTitle title={t("mobile.incidents.onPhone")} />
      {others.map((draft) => (
        <SecondaryButton
          key={draft.eventId}
          icon={FileText}
          label={`${draft.type?.label ?? t("mobile.incidents.accident")} · ${draft.deviceTime}`}
          disabled={model.isBusy}
          onPress={() => {
            void model.recover(() => model.service.select(draft.eventId));
          }}
        />
      ))}
    </>
  );
}
