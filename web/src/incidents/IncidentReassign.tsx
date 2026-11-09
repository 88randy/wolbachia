import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import { Select } from "../forms/Select";
import { TextField } from "../forms/TextField";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/ErrorState";
import type { IncidentScope } from "./incidents-query";
import type { IncidentActionProps } from "./IncidentComment";
function ownerOptions(scope: IncidentScope, target: { id: string; page: number; search: string; isOpen: boolean }) {
 return { ...orgScopedQueryOptions(scope.identity, { key: ["incidents", "owners", target],
 queryFn: async ({ signal }) => unwrap(await scope.client.GET("/api/v1/incidents/{id}/owner-options/", {
 params: { path: { id: target.id }, query: { page: target.page, page_size: 25, search: target.search } }, signal,
 })), }), placeholderData: undefined, enabled: scope.identity.isSettled && target.isOpen };
}
export function IncidentReassign({ scope, incident, isBlocked, isBusy, submit }: IncidentActionProps & { scope: IncidentScope }) {
 const { t } = useTranslation();
 const [owner, setOwner] = useState("");
 const [search, setSearch] = useState("");
 const [page, setPage] = useState(1);
 const query = useQuery(ownerOptions(scope, { id: incident.id, page, search, isOpen: incident.action_prerequisites?.is_open === true }));
 return <fieldset disabled={isBusy}>
 <TextField id="incident-owner-search" label={t("incidents.workspace.ownerSearch")} value={search} onChange={event => { setSearch(event.target.value); setOwner(""); setPage(1); }} />
 {query.isError && <ErrorState onRetry={() => { void query.refetch(); }} />}
 <Select id="incident-owner" label={t("incidents.workspace.owner")} value={owner} onChange={event => { setOwner(event.target.value); }} options={[{ value: "", label: t("incidents.workspace.selectOwner") }, ...(query.data?.results.map(item => ({ value: item.membership_id, label: item.label })) ?? [])]} />
 <Button variant="secondary" aria-disabled={page <= 1 || query.isFetching} onClick={() => { setOwner(""); setPage(page - 1); }}>{t("incidents.workspace.previous")}</Button>
 <Button variant="secondary" aria-disabled={!query.data?.next || query.isFetching} onClick={() => { setOwner(""); setPage(page + 1); }}>{t("incidents.workspace.next")}</Button>
 <Button aria-disabled={isBlocked || !owner || !query.data?.results.some(item => item.membership_id === owner)} onClick={() => { void submit({ action: "reassign", body: { expected_revision: incident.revision, owner_id: owner } }); }}>{t("incidents.workspace.reassign")}</Button>
 </fieldset>;
}
