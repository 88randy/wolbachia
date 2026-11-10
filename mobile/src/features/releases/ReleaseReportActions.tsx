import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseReportActions({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  return (
    <>
      <Button
        variant="outline"
        label={t("mobile.release.reportDevice")}
        onPress={model.reportDevice}
      />
      <Button
        variant="outline"
        label={t("mobile.release.reportSupervisor")}
        onPress={model.reportSupervisor}
      />
    </>
  );
}
