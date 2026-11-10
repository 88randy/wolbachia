/* eslint-disable max-lines-per-function, complexity -- page composition: one query and its widgets. */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ApiError } from "@wolbachia/api-client";
import { useApiClient } from "../api/ApiClientProvider";
import { HomeDashboard } from "../components/templates/HomeDashboard";
import { HubGrid } from "../components/templates/HubGrid";
import { homeSummaryOptions } from "../discovery/discovery-query";
import { ownScreen } from "../discovery/record-links";
import { useMe } from "../session/use-me";
import { useSessionIdentity } from "../session/use-session-identity";
import { displayNameOf } from "../shell/user-display";
import { Banner } from "../ui/Banner";
import { ErrorState } from "../ui/ErrorState";
import { HomeAttention } from "./HomeAttention";
import { HomeKpis } from "./HomeKpis";
import { useHomeCards } from "./use-home-cards";
import { useHomeShortcuts } from "./use-home-shortcuts";

/**
 * W2 Home. A greeting, a red band when something critical is open, "Lo que tienes pendiente" cards
 * that open the action directly, today's numbers and the areas the user can open.
 */
export function HomePage() {
  const { t } = useTranslation();
  const { user } = useMe();
  const shortcuts = useHomeShortcuts();
  const identity = useSessionIdentity();
  const summary = useQuery(homeSummaryOptions(useApiClient(), identity));
  const data = summary.data;
  const { pending, all } = useHomeCards(data);
  const isForbidden = summary.error instanceof ApiError && summary.error.status === 403;
  const first = data?.critical[0];
  const target = first ? ownScreen(first.type, first.code) : null;
  return (
    <HomeDashboard
      title={t("hub.home.greeting", { name: displayNameOf(user) })}
      description={t("hub.home.subtitle")}
      pending={data ? pending : undefined}
      isLoading={summary.isPending}
      alert={
        first && target ? (
          <Banner
            tone="critical"
            action={
              <Link {...target} className="text-[13px] font-semibold text-critical-fg underline">
                {t("discovery.home.openIncident", { code: first.code })}
              </Link>
            }
          >
            <p className="font-semibold">
              {t("discovery.home.criticalBanner", { count: data.critical.length })}
            </p>
          </Banner>
        ) : undefined
      }
    >
      {summary.isError && data === undefined && !isForbidden && (
        <ErrorState
          message={t("discovery.home.loadError")}
          onRetry={() => {
            void summary.refetch();
          }}
        />
      )}
      {data?.support && (
        <Banner tone="info">
          <p>{t("discovery.home.support", { contact: data.support.contact })}</p>
        </Banner>
      )}
      <HomeKpis items={all} />
      {data && <HomeAttention summary={data} />}
      <section aria-labelledby="home-shortcuts" className="flex flex-col gap-3">
        <h2 id="home-shortcuts" className="m-0 text-base font-semibold">
          {t("hub.home.shortcuts")}
        </h2>
        <HubGrid items={shortcuts} label={t("hub.home.shortcuts")} />
      </section>
    </HomeDashboard>
  );
}
