import { useState } from "react";

import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../AppText.tsx";
import { Button } from "../Button.tsx";
import { Card } from "../Card.tsx";
import { Notice } from "../Notice.tsx";

export function PreviewRetry() {
  const t = useT();
  const [hasRetried, setHasRetried] = useState(false);
  return (
    <Card isCritical={!hasRetried}>
      <AppText variant="h2">{t("mobile.preview.partial")}</AppText>
      <Notice
        tone={hasRetried ? "info" : "critical"}
        icon={hasRetried ? "check" : "noSignal"}
        message={t(hasRetried ? "mobile.preview.retryResult" : "mobile.preview.error")}
      />
      <Button
        variant="outline"
        label={t("common.actions.retry")}
        onPress={() => {
          setHasRetried(true);
        }}
      />
    </Card>
  );
}
