import { useT } from "../../i18n/I18nProvider.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
import { IncidentEvidenceActions } from "./IncidentEvidenceActions.tsx";
import { IncidentEvidenceMinimum } from "./IncidentEvidenceMinimum.tsx";
import { IncidentPhoto } from "./IncidentPhoto.tsx";
import type { M12Model } from "./use-m-12.ts";

export function IncidentEvidence({ model }: { readonly model: M12Model }) {
  const t = useT();
  const draft = model.state?.draft;
  if (!draft) return null;
  return (
    <>
      <SectionTitle title={t("mobile.incidents.evidence")} />
      <IncidentEvidenceMinimum draft={draft} />
      {draft.evidence.map((photo) => (
        <IncidentPhoto key={photo.id} fileRef={photo.fileRef} />
      ))}
      <IncidentEvidenceActions model={model} />
    </>
  );
}
