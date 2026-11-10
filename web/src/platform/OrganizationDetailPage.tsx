/* eslint-disable max-lines-per-function -- presentational JSX of the organization record. */
import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { Ellipsis, ListRestart, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DetailPage } from "../components/templates/DetailPage";
import { useFormatDate } from "../format/use-formatters";
import { useBreadcrumbLabel } from "../shell/breadcrumb-labels";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ErrorState } from "../ui/ErrorState";
import { CardSkeleton } from "../ui/CardSkeleton";
import { StatusPill } from "../ui/StatusPill";
import { Facts } from "./Facts";
import { LogoCard } from "./LogoCard";
import { AddAdminDialog, AddCenterDialog, SuspendDialog } from "./OrganizationDialogs";
import { OrganizationStatus } from "./OrganizationStatus";
import { platformDetailOptions } from "./platform-queries";
import { usePlatformAction, usePlatformScope } from "./use-platform";
import { zoneLabel } from "./wizard/timezones";

const LIST = "m-0 flex list-none flex-col divide-y divide-line p-0";
const ROW = "flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0";

export function OrganizationDetailPage({
  slug,
  highlightLogo,
}: {
  slug: string;
  highlightLogo: boolean;
}) {
  const { t } = useTranslation();
  const scope = usePlatformScope();
  const formatDate = useFormatDate();
  const query = useQuery({
    ...platformDetailOptions(scope, slug),
    enabled: scope.identity.isSettled,
  });
  const organization = query.data;
  useBreadcrumbLabel(`/platform/${slug}`, organization?.name);
  const defaults = usePlatformAction({
    successKey: "platform.toast.defaultsApplied",
    run: async (_: undefined, signal) =>
      unwrap(
        await scope.client.POST("/api/v1/platform/organizations/{slug}/apply-defaults/", {
          params: { path: { slug } },
          signal,
        }),
      ),
  });
  if (!organization) {
    return (
      <DetailPage title={t("platform.list.title")}>
        {query.isError ? (
          <ErrorState
            message={t("platform.detail.notFound")}
            onRetry={() => {
              void query.refetch();
            }}
          />
        ) : (
          <CardSkeleton />
        )}
      </DetailPage>
    );
  }
  const country = t(`platform.country.${organization.country as "MX"}`, {
    defaultValue: organization.country,
  });
  return (
    <DetailPage
      title={organization.name}
      code={organization.slug}
      status={<OrganizationStatus isActive={organization.is_active} />}
      description={t("platform.detail.isolation")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SuspendDialog organization={organization} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                aria-label={t("platform.action.more")}
                leadingIcon={<Ellipsis aria-hidden="true" />}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={defaults.isBusy}
                onSelect={() => {
                  defaults.submit(undefined);
                }}
              >
                <ListRestart aria-hidden="true" />
                {t("platform.action.applyDefaults")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
      aside={
        <>
          <LogoCard organization={organization} highlight={highlightLogo} />
          <Card title={t("platform.detail.history")}>
            {organization.history.length === 0 ? (
              <p className="m-0 text-sm text-ink-3">{t("platform.detail.noHistory")}</p>
            ) : (
              <ol className={LIST}>
                {organization.history.map((entry, index) => (
                  <li
                    key={`${entry.created_at}-${String(index)}`}
                    className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm font-semibold text-ink">
                      {t(`platform.history.${entry.action}`, { defaultValue: entry.action })}
                    </span>
                    <span className="text-xs text-ink-2">
                      {[entry.actor_name, formatDate(entry.created_at)].filter(Boolean).join(" · ")}
                    </span>
                    {entry.reason && <span className="text-xs text-ink-2">“{entry.reason}”</span>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </>
      }
    >
      <Card title={t("platform.detail.summary")}>
        <Facts
          items={[
            { label: t("platform.detail.country"), value: country },
            { label: t("platform.detail.timezone"), value: zoneLabel(organization.timezone) },
            {
              label: t("platform.detail.epiWeek"),
              value: t(
                organization.epi_week === "mmwr"
                  ? "platform.field.epiWeekMmwr"
                  : "platform.field.epiWeekIso",
              ),
            },
            {
              label: t("platform.detail.languages"),
              value: organization.languages
                .map((language) =>
                  t(`platform.language.${language as "en"}`, { defaultValue: language }),
                )
                .join(", "),
            },
            { label: t("platform.detail.address"), value: organization.slug },
            { label: t("platform.detail.created"), value: formatDate(organization.created_at) },
          ]}
        />
      </Card>
      <Card
        title={t("platform.detail.centers")}
        actions={<AddCenterDialog organization={organization} />}
      >
        {organization.centers.length === 0 ? (
          <p className="m-0 text-sm text-ink-3">{t("platform.detail.noCenters")}</p>
        ) : (
          <ul className={LIST}>
            {organization.centers.map((center) => (
              <li key={center.code} className={ROW}>
                <span className="flex items-center gap-3">
                  <span className="rounded-md bg-tint px-2 py-0.5 text-xs font-semibold text-action">
                    {center.code}
                  </span>
                  <span className="text-sm text-ink">{center.name}</span>
                </span>
                {!center.is_active && (
                  <StatusPill tone="neutral">{t("platform.detail.inactiveCenter")}</StatusPill>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card
        title={t("platform.detail.admins")}
        actions={<AddAdminDialog organization={organization} />}
      >
        {organization.admins.length === 0 ? (
          <p className="m-0 text-sm text-ink-3">{t("platform.detail.noAdmins")}</p>
        ) : (
          <ul className={LIST}>
            {organization.admins.map((admin) => (
              <li key={admin.username} className={ROW}>
                <span className="flex items-center gap-3">
                  <span className="flex size-9 flex-none items-center justify-center rounded-full bg-tint text-action">
                    <ShieldCheck aria-hidden="true" className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-ink">
                      {[admin.first_name, admin.last_name].filter(Boolean).join(" ") ||
                        admin.username}
                    </span>
                    <span className="text-xs text-ink-2">
                      {admin.username} · {admin.email}
                    </span>
                  </span>
                </span>
                {!admin.is_active && (
                  <StatusPill tone="neutral">{t("platform.detail.adminInactive")}</StatusPill>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </DetailPage>
  );
}
