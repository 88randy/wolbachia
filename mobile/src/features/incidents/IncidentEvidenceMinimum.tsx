import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { IncidentDraft } from "./types.ts";
export function IncidentEvidenceMinimum({ draft }: { readonly draft: IncidentDraft }) {
  const t = useT();
  if (!draft.type) return null;
  const minimum = draft.type.report_evidence_min;
  return (
    <View>
      <AppText>{t("mobile.incidents.evidenceMinimum")}</AppText>
      <AppText isMonospace>{minimum}</AppText>
      {draft.evidence.length < minimum ? (
        <Notice tone="warning" icon="alert" message={t("mobile.incidents.evidenceMissing")} />
      ) : null}
    </View>
  );
}
