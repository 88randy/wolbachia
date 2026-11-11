/* eslint-disable max-lines-per-function, complexity -- fast mode (demo 2026-11-20): one declarative record page. */
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useApiClient } from "../api/ApiClientProvider";
import { DescriptionGrid } from "../components/templates/DescriptionGrid";
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
import { PersonActions } from "./PersonActions";
import { RevokeSessionsButton } from "./RevokeSessionsButton";

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
        <>
          <PersonActions person={person} />
          {can("user.revoke_device_sessions") && person.is_active && (
            <RevokeSessionsButton personId={person.id} name={person.display_name} />
          )}
        </>
      }
      aside={
        <Card title={t("users.record.summary")}>
          {!person.is_active && (
            <InlineNotice tone="warning">{t("users.action.blockedInactive")}</InlineNotice>
          )}
          {person.deactivation_reason && (
            <dl className="m-0">
              <Fact label={t("users.record.deactivationReason")}>
                <span className="whitespace-pre-line">{person.deactivation_reason}</span>
              </Fact>
            </dl>
          )}
          <InlineNotice tone="info">{t("users.revoke.help")}</InlineNotice>
        </Card>
      }
    >
      <Card title={t("users.record.data")}>
        <DescriptionGrid
          columns={2}
          items={[
            { label: t("users.column.name"), value: person.display_name },
            {
              label: t("users.column.rfc"),
              value: (
                <RfcField
                  personId={person.id}
                  hasRfc={person.has_rfc}
                  canReveal={can("user.reveal_rfc")}
                />
              ),
            },
            ...(lookups.hasProfiles
              ? [{ label: t("users.column.profiles"), value: profiles || null }]
              : []),
            { label: t("users.record.email"), value: person.work_email || null },
            { label: t("users.record.phone"), value: person.work_phone || null },
          ]}
        />
        <p className="m-0 pt-4 text-xs text-ink-2">{t("users.record.privacy")}</p>
      </Card>
    </DetailPage>
  );
}
