import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { useTraining } from "./use-training.ts";

type Model = ReturnType<typeof useTraining>;
function readNotices(model: Model): MessageKey[] {
  const keys: MessageKey[] = [];
  if (model.hasLocalError) keys.push("trainings.mobile.unavailable");
  if (model.hasRefreshError) keys.push("trainings.mobile.failed");
  if (model.isRefreshing) keys.push("trainings.mobile.refreshing");
  return keys;
}
function accessNotices({ source }: Model): MessageKey[] {
  if (!source) return [];
  const keys: MessageKey[] = [];
  if (!source.eligibility.length) keys.push("trainings.mobile.empty");
  if (!source.canReadTraining) keys.push("trainings.mobile.trainingDenied");
  if (!source.canReadEvaluations) keys.push("trainings.mobile.privateDenied");
  if (!source.records) keys.push("trainings.mobile.notDownloaded");
  if (source.records?.hasMoreCertificates || source.records?.hasMoreEvaluations)
    keys.push("trainings.mobile.partial");
  return keys;
}
export function TrainingNotices({ model }: { readonly model: Model }) {
  const t = useT();
  return [...readNotices(model), ...accessNotices(model)].map((key) => (
    <InfoNotice key={key} tone="info" message={t(key)} />
  ));
}
