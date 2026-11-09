import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import { Button } from "../ui/Button";
import type { incidentFailure } from "./incident-command";
export function IncidentCommandNotice({ failure, onReview }: { failure: ReturnType<typeof incidentFailure> | null; onReview: () => void }) {
 const { t } = useTranslation();
 if (!failure) return null;
 return <InlineNotice tone="warning" action={<Button variant="secondary" onClick={onReview}>{t("incidents.workspace.review")}</Button>}>
 {t(`incidents.failure.${failure}`)}
 </InlineNotice>;
}
