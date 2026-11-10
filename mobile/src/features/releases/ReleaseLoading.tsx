import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";

export function ReleaseLoading() {
  const t = useT();
  return (
    <>
      <AppText variant="body" tone="secondary">
        {t("mobile.release.loading")}
      </AppText>
      <Skeleton />
      <Skeleton />
      <Skeleton isShort />
    </>
  );
}
