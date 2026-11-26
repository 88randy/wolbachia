import { CloudOff, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { StateFrame } from "../ui/StateFrame";

export function PortalLoading() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("portal.state.loading")} className="flex flex-col gap-4">
      <Skeleton />
      <Skeleton shape="chart" />
    </div>
  );
}

export function PortalError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <StateFrame role="alert" tone="critical" icon={CloudOff} message={t("portal.state.error")}>
      <Button variant="secondary" onClick={onRetry}>
        {t("portal.state.retry")}
      </Button>
    </StateFrame>
  );
}

export function PortalMissing({ title }: { title?: string }) {
  const { t } = useTranslation();
  return (
    <StateFrame icon={Lock} message={title ?? t("portal.state.notFound.title")}>
      <p className="m-0 max-w-md text-[13px] text-ink-2">{t("portal.state.notFound.body")}</p>
    </StateFrame>
  );
}
