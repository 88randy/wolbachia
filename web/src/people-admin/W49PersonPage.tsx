/* eslint-disable max-lines-per-function, complexity -- fast mode (demo 2026-11-20): one declarative record page. */
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useApiClient } from "../api/ApiClientProvider";
import { DetailPage } from "../components/templates/DetailPage";
import { useSessionIdentity } from "../session/use-session-identity";
import { useCan } from "../session/use-can";
import { NotFoundState } from "../states/NotFoundState";
import { Card } from "../ui/Card";
import { CardSkeleton } from "../ui/CardSkeleton";
import { InlineNotice } from "../ui/InlineNotice";
import { StatusPill } from "../ui/StatusPill";
import { personQueryOptions } from "./users-query";
import { usePeopleLookups } from "./use-people-lookups";
import { RfcField } from "./RfcField";
import { RevokeSessionsButton } from "./RevokeSessionsButton";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="m-0 text-right text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

/** W49 person record: data, masked RFC with logged "Show", and phone sign-out. */
export function W49PersonPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const can = useCan();
  const lookups = usePeopleLookups();
  const query = useQuery(personQueryOptions(client, identity, id));
  if (query.isPending) return <CardSkeleton />;
  if (!query.data) return <NotFoundState />;
  const person = query.data;
  const profiles = lookups.profilesOf(person.membership_id);
  return (
    <DetailPage
      code={
        <Link to="/settings/users" className="text-action hover:underline">
          {t("users.page.title")}
        </Link>
      }
      title={person.display_name}
      status={
        <StatusPill tone={person.is_active ? "success" : "neutral"}>
          {t(person.is_active ? "users.status.active" : "users.status.inactive")}
        </StatusPill>
      }
      subtitle={profiles}
      centerId={person.center_id}
      actions={
        can("user.revoke_device_sessions") && person.is_active ? (
          <RevokeSessionsButton personId={person.id} name={person.display_name} />
        ) : undefined
      }
      aside={
        <Card title={t("users.record.summary")}>
          <InlineNotice tone="info">{t("users.revoke.help")}</InlineNotice>
        </Card>
      }
    >
      <Card title={t("users.record.data")}>
        <dl className="m-0">
          <Fact label={t("users.column.name")}>{person.display_name}</Fact>
          <Fact label={t("users.column.rfc")}>
            <RfcField
              personId={person.id}
              hasRfc={person.has_rfc}
              canReveal={can("user.reveal_rfc")}
            />
          </Fact>
          {lookups.hasProfiles && <Fact label={t("users.column.profiles")}>{profiles || "—"}</Fact>}
          <Fact label={t("users.record.email")}>{person.work_email || "—"}</Fact>
          <Fact label={t("users.record.phone")}>{person.work_phone || "—"}</Fact>
        </dl>
        <p className="m-0 pt-3 text-xs text-ink-2">{t("users.record.privacy")}</p>
      </Card>
    </DetailPage>
  );
}
