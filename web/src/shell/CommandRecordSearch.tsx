/* eslint-disable max-lines-per-function -- presentational/composition unit; splitting it into one-use fragments would hurt readability. */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { searchOptions } from "../discovery/discovery-query";
import { openRecord } from "../discovery/record-links";
import { MIN_QUERY_LENGTH, SUMMARY_PAGE_SIZE } from "../discovery/search-state";
import { useDebouncedValue } from "../discovery/use-debounced-value";
import { can } from "../session/can";
import { useMe } from "../session/use-me";
import { useSessionIdentity } from "../session/use-session-identity";
import { MAIN_ID } from "./ids";

const DEBOUNCE_MS = 300;

interface CommandRecordSearchProps {
  query: string;
  onClose: (isNavigation?: boolean) => void;
}

/** Records found by code while typing in the palette (W3 in miniature), with a link to all of them. */
export function CommandRecordSearch({ query, onClose }: CommandRecordSearchProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const identity = useSessionIdentity();
  const allowed = can(useMe(), "home.read");
  const q = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const isReady = allowed && q.length >= MIN_QUERY_LENGTH;
  const result = useQuery({
    ...searchOptions(useApiClient(), identity, {
      q,
      type: undefined,
      includeVoided: false,
      page: 1,
      pageSize: SUMMARY_PAGE_SIZE,
    }),
    enabled: identity.isSettled && isReady,
  });
  if (!isReady) return null;
  const hits = (result.data?.groups ?? []).flatMap((group) => group.hits);
  const go = (open: () => Promise<void>) => {
    onClose(true);
    void open().then(() => document.getElementById(MAIN_ID)?.focus());
  };
  return (
    <Command.Group heading={t("discovery.search.paletteHeading")} forceMount>
      {hits.map((hit) => (
        <Command.Item
          key={`${hit.type}-${hit.id}`}
          forceMount
          value={`record ${hit.type} ${hit.code}`}
          onSelect={() => {
            go(() => navigate(openRecord(hit.type, hit.code)));
          }}
        >
          <span className="font-mono">{hit.code}</span>
          <span className="ml-2 text-xs opacity-70">{t(`discovery.typeOne.${hit.type}`)}</span>
        </Command.Item>
      ))}
      <Command.Item
        forceMount
        value={`records all ${q}`}
        onSelect={() => {
          go(() => navigate({ to: "/search", search: { q } }));
        }}
      >
        {t("discovery.search.paletteAll", { q })}
      </Command.Item>
    </Command.Group>
  );
}
