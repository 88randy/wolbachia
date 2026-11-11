import { DEV_TOOLS_ENABLED } from "../../config/build-config.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";

/** The point is not in today's work. Test builds also show the code of why (counts, no personal data). */
export function ScopeNotice({ code }: { readonly code: string | null }) {
  const t = useT();
  return (
    <>
      <InfoNotice tone="warning" message={t("field.capture.notYours")} />
      {DEV_TOOLS_ENABLED && code ? (
        <AppText variant="caption" tone="tertiary">
          {t("field.capture.diagnosticCode", { code })}
        </AppText>
      ) : null}
    </>
  );
}
