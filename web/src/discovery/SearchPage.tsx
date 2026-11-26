/* eslint-disable max-lines-per-function, complexity -- page composition: one query, one input and its result states. */
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { PageFrame } from "../components/templates/PageFrame";
import { PageHeader } from "../components/templates/PageHeader";
import { SearchField } from "../forms/SearchField";
import { useSessionIdentity } from "../session/use-session-identity";
import { useDocumentTitle } from "../shell/use-document-title";
import { Button } from "../ui/Button";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { StateFrame } from "../ui/StateFrame";
import { Switch } from "../ui/Switch";
import { searchOptions } from "./discovery-query";
import { SearchGroupCard } from "./SearchGroupCard";
import {
  FULL_PAGE_SIZE,
  MIN_QUERY_LENGTH,
  SUMMARY_PAGE_SIZE,
  readSearchState,
  toSearchParams,
} from "./search-state";
import type { SearchState } from "./search-state";
import { useDebouncedValue } from "./use-debounced-value";

const DEBOUNCE_MS = 350;

/** W3 Universal search: results grouped by record type; a group can be opened in full. */
export function SearchPage() {
  const { t } = useTranslation();
  const title = t("discovery.search.title");
  useDocumentTitle(title);
  const client = useApiClient();
  const identity = useSessionIdentity();
  const navigate = useNavigate();
  const state = readSearchState(useSearch({ strict: false }));
  const [draft, setDraft] = useState(state.q);
  const settled = useDebouncedValue(draft.trim(), DEBOUNCE_MS);
  const go = (next: SearchState) => {
    void navigate({ to: "/search", search: toSearchParams(next), replace: true });
  };
  useEffect(() => {
    if (settled !== state.q) go({ ...state, q: settled, page: 1 });
    // The address follows the settled text only; `state` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);
  useEffect(() => {
    // The address changed from outside (the command palette): show it in the field.
    if (state.q !== settled) setDraft(state.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.q]);
  const isReady = state.q.length >= MIN_QUERY_LENGTH;
  const query = useQuery({
    ...searchOptions(client, identity, {
      ...state,
      pageSize: state.type === undefined ? SUMMARY_PAGE_SIZE : FULL_PAGE_SIZE,
    }),
    enabled: identity.isSettled && isReady,
  });
  const groups = (query.data?.groups ?? []).filter((group) => group.count > 0);
  const total = groups.find((group) => group.type === state.type)?.count ?? 0;
  return (
    <PageFrame width="narrow">
      <PageHeader title={title} description={t("discovery.search.description")} />
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-64 flex-1">
          <SearchField
            id="record-search"
            label={t("discovery.search.label")}
            placeholder={t("discovery.search.placeholder")}
            value={draft}
            maxLength={50}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
          />
        </div>
        <Switch
          label={t("discovery.search.includeVoided")}
          isOn={state.includeVoided}
          onChange={(isOn) => {
            go({ ...state, includeVoided: isOn, page: 1 });
          }}
        />
      </div>
      {state.type !== undefined && (
        <div>
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => {
              go({ ...state, type: undefined, page: 1 });
            }}
          >
            {t("discovery.search.allTypes")}
          </Button>
        </div>
      )}
      <div aria-live="polite" className="flex flex-col gap-4">
        {!isReady && <StateFrame icon={Search} message={t("discovery.search.minChars")} />}
        {isReady && query.isError && (
          <ErrorState
            message={t("discovery.search.loadError")}
            onRetry={() => {
              void query.refetch();
            }}
          />
        )}
        {isReady && query.data === undefined && !query.isError && <CardSkeleton />}
        {isReady && query.data && groups.length === 0 && (
          <StateFrame icon={Search} message={t("discovery.search.empty", { q: state.q })}>
            <p className="m-0 text-[13px] text-ink-2">{t("discovery.search.emptyHint")}</p>
          </StateFrame>
        )}
        {groups.map((group) => (
          <SearchGroupCard
            key={group.type}
            group={group}
            onShowAll={
              state.type === undefined
                ? () => {
                    go({ ...state, type: group.type, page: 1 });
                  }
                : undefined
            }
          />
        ))}
        {state.type !== undefined && total > FULL_PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              disabled={state.page <= 1}
              onClick={() => {
                go({ ...state, page: state.page - 1 });
              }}
            >
              {t("discovery.search.prev")}
            </Button>
            <span className="text-[13px] text-ink-2">
              {t("discovery.search.page", { page: state.page })}
            </span>
            <Button
              variant="secondary"
              disabled={state.page * FULL_PAGE_SIZE >= total}
              onClick={() => {
                go({ ...state, page: state.page + 1 });
              }}
            >
              {t("discovery.search.next")}
            </Button>
          </div>
        )}
      </div>
    </PageFrame>
  );
}
