import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";

export function ReleaseLoading() {
  const t = useT();
  return (
    <Card>
      <AppText>{t("mobile.release.loading")}</AppText>
      <Skeleton />
      <Skeleton />
      <Skeleton isShort />
    </Card>
  );
}
