import { useQuery } from "@tanstack/react-query";
import { ApiError, unwrap } from "@wolbachia/api-client";
import { useReceptionScope } from "./use-reception-scope";
import { labScopeOptions } from "./reception-query";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../format/use-format-date-time";

type ReceptionScope = ReturnType<typeof useReceptionScope>;
interface MetadataQuery {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

function queryState(queries: readonly MetadataQuery[], permissions: readonly string[] = []) {
  const error = queries.find((query) => query.isError)?.error;
  return {
    isLoading: queries.some((query) => query.isLoading),
    isRefreshing: queries.some((query) => query.isFetching && !query.isLoading),
    isLimited: ["reading.read", "ovitrap.read", "quadrant.read"].some(
      (permission) => !permissions.includes(permission),
    ),
    error,
    errorCode: error instanceof ApiError ? error.code : undefined,
    retry: () => {
      queries.forEach((query) => {
        if (query.isError) void query.refetch();
      });
    },
  };
}

function readingOptions(scope: ReceptionScope, id: string) {
  return {
    ...labScopeOptions(scope, ["metadata", "reading", id], async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/readings/{id}/", {
          params: { path: { id } },
          signal,
        }),
      ),
    ),
    enabled:
      scope.identity.isSettled && scope.identity.permissions?.includes("reading.read") === true,
  };
}

function bagOptions(scope: ReceptionScope, id: string | null | undefined) {
  return {
    ...labScopeOptions(scope, ["metadata", "bag", id], async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/bags/{id}/", {
          params: { path: { id: id ?? "" } },
          signal,
        }),
      ),
    ),
    enabled:
      Boolean(id) &&
      scope.identity.isSettled &&
      scope.identity.permissions?.includes("reading.read") === true,
  };
}

function ovitrapOptions(scope: ReceptionScope, id: string | undefined) {
  return {
    ...labScopeOptions(scope, ["metadata", "ovitrap", id], async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/ovitraps/{id}/", {
          params: { path: { id: id ?? "" } },
          signal,
        }),
      ),
    ),
    enabled:
      Boolean(id) &&
      scope.identity.isSettled &&
      scope.identity.permissions?.includes("ovitrap.read") === true &&
      scope.identity.permissions.includes("quadrant.read"),
  };
}

function pointOptions(scope: ReceptionScope, id: string | undefined) {
  return {
    ...labScopeOptions(scope, ["metadata", "point", id], async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/sampling-points/{id}/", {
          params: { path: { id: id ?? "" } },
          signal,
        }),
      ),
    ),
    enabled:
      Boolean(id) &&
      scope.identity.isSettled &&
      scope.identity.permissions?.includes("quadrant.read") === true,
  };
}

function blockOptions(scope: ReceptionScope, id: string | undefined) {
  return {
    ...labScopeOptions(scope, ["metadata", "block", id], async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/blocks/{id}/", {
          params: { path: { id: id ?? "" } },
          signal,
        }),
      ),
    ),
    enabled:
      Boolean(id) &&
      scope.identity.isSettled &&
      scope.identity.permissions?.includes("quadrant.read") === true,
  };
}

/** Optional display metadata never broadens the receipt's action authority. */
export function useReceptionMetadata(readingId: string, bagId?: string | null) {
  const scope = useReceptionScope();
  const reading = useQuery(readingOptions(scope, readingId));
  const bag = useQuery(bagOptions(scope, bagId));
  const ovitrap = useQuery(ovitrapOptions(scope, reading.data?.ovitrap));
  const point = useQuery(pointOptions(scope, ovitrap.data?.sampling_point));
  const block = useQuery(blockOptions(scope, point.data?.block));
  const queries = [reading, bag, ovitrap, point, block];
  return {
    reading: reading.data,
    bag: bag.data,
    point: point.data,
    block: block.data,
    ...queryState(queries, scope.identity.permissions),
  };
}

/** The laboratory keeps the courier's boolean observations separate from numeric counts. */
export function useReceptionMetadataFacts(
  metadata: ReturnType<typeof useReceptionMetadata>,
  readingId: string,
) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const unknown = t("labReception.table.unknown");
  const labels = { unknown, yes: t("labReception.table.yes"), no: t("labReception.table.no") };
  const [reading, date, collector] = readingFacts(metadata, readingId, { format, unknown });
  return [
    reading,
    ...geographyFacts(metadata, unknown),
    date,
    collector,
    ["paddlePresent", booleanLabel(metadata.reading?.paddle_present, labels)],
    ["hasEggs", booleanLabel(metadata.reading?.has_eggs, labels)],
  ] as const;
}

type Metadata = ReturnType<typeof useReceptionMetadata>;
function readingFacts(
  metadata: Metadata,
  readingId: string,
  display: {
    format: ReturnType<typeof useFormatDateTime>;
    unknown: string;
  },
) {
  return [
    ["reading", metadata.reading?.code ?? readingId],
    ["date", metadata.reading ? display.format(metadata.reading.device_time) : display.unknown],
    ["collector", metadata.bag?.collector ?? metadata.reading?.created_by ?? display.unknown],
  ] as const;
}

function geographyFacts(metadata: Metadata, unknown: string) {
  return [
    ["block", metadata.block?.code ?? metadata.point?.block ?? unknown],
    ["point", metadata.point?.code ?? unknown],
  ] as const;
}

function booleanLabel(
  value: boolean | null | undefined,
  labels: { yes: string; no: string; unknown: string },
) {
  if (value == null) return labels.unknown;
  return value ? labels.yes : labels.no;
}
