import { useState } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";

export function DayErrorDetails({ code }: { readonly code: string | null }) {
  const [isExpanded, setExpanded] = useState(false);
  const t = useT();
  if (code === null) return null;
  return (
    <>
      <Button
        variant="text"
        label={t(isExpanded ? "mobile.day.hideDetails" : "mobile.day.showDetails")}
        onPress={() => {
          setExpanded(!isExpanded);
        }}
      />
      {isExpanded ? <AppText selectable>{t("mobile.day.errorCode", { code })}</AppText> : null}
    </>
  );
}
