import { PreviewRetry } from "./PreviewRetry.tsx";

import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../AppText.tsx";
import { Card } from "../Card.tsx";
import { Notice } from "../Notice.tsx";
import { Skeleton } from "../Skeleton.tsx";

export function PreviewStates() {
  const t = useT();
  return (
    <>
      <Card>
        <AppText variant="overline" tone="secondary">
          {t("mobile.preview.loading")}
        </AppText>
        <Skeleton />
        <Skeleton isShort />
      </Card>
      <Card>
        <AppText variant="h2">{t("mobile.preview.empty")}</AppText>
        <Notice tone="info" icon="list" message={t("mobile.inbox.empty")} />
      </Card>
      <PreviewRetry />
    </>
  );
}
