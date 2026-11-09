import { act, waitFor } from "@testing-library/react";
import { expect } from "vitest";
import type { Query, QueryClient } from "@tanstack/react-query";
import type { Me } from "../session/me";
import { currentRevision, isSessionKnown } from "../session/session-revision";
import { authorizationKey } from "../centers/center-selection";
import type { HistoryTab } from "../fleet/fleet-history-table";
export interface FleetRead {
  request: Request;
  revision: number;
  response?: Response;
  body?: ReturnType<typeof observeFleetBody>;
}
export type FleetReadTarget =
  | { kind: "list"; params?: Readonly<Record<string, string>> }
  | { kind: "record"; code: string; id: string }
  | { kind: "history"; id: string; tab: HistoryTab };
interface CurrentRead {
  client: QueryClient;
  me: Me;
  reads: FleetRead[];
  since: number;
  target: FleetReadTarget;
  center?: string;
}
function observedParser<T>(read: () => Promise<T>, complete: () => void) {
  return async () => {
    try {
      return await read();
    } finally {
      complete();
    }
  };
}
/** Observe only the real consumer's parser completion. Never call it to force a body or alter data. */
export function observeFleetBody(response: Response) {
  let consumed = false;
  let complete: () => void = () => undefined;
  const parsed = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const done = () => {
    consumed = true;
    complete();
  };
  response.json = observedParser(response.json.bind(response), done);
  response.text = observedParser(response.text.bind(response), done);
  return { response, parsed, isConsumed: () => consumed };
}
function isFleetRead(request: Request) {
  const path = new URL(request.url).pathname;
  return (
    request.method === "GET" &&
    (/^\/api\/v1\/motorcycles\//.test(path) ||
      ["/api/v1/fuel-loads/", "/api/v1/incidents/"].includes(path))
  );
}
/** Trace the natural fetch boundary; never consume, replace, deliver or force a response body. */
export function traceFleetReads(
  fetcher: (request: Request) => Promise<Response>,
  reads: FleetRead[],
) {
  return async (request: Request) => {
    if (!isFleetRead(request)) return fetcher(request);
    const read: FleetRead = { request, revision: currentRevision() };
    reads.push(read);
    const response = await fetcher(request);
    read.response = response;
    read.body = observeFleetBody(response);
    return response;
  };
}
function targetMatches(query: Query, target: FleetReadTarget) {
  if (query.queryKey[4] !== target.kind) return false;
  if (target.kind === "list") return true;
  if (target.kind === "record") return query.queryKey[5] === target.code;
  const value = query.queryKey[5];
  return (
    typeof value === "object" &&
    value !== null &&
    "motorcycle" in value &&
    value.motorcycle === target.id &&
    "tab" in value &&
    value.tab === target.tab
  );
}
function currentMe(options: CurrentRead) {
  const me = options.client.getQueryData<Me>(["me"]);
  return (
    isSessionKnown() &&
    me !== undefined &&
    me.user.id === options.me.user.id &&
    me.organization?.slug === options.me.organization?.slug &&
    authorizationKey(me) === authorizationKey(options.me)
  );
}
function currentCandidates(options: CurrentRead) {
  if (!currentMe(options)) return [];
  const prefix = ["org", options.me.user.id, options.me.organization?.slug, "fleet"];
  const queries = options.client
    .getQueryCache()
    .getAll()
    .filter(
      (query) =>
        prefix.every((part, index) => query.queryKey[index] === part) &&
        query.meta?.["revision"] === currentRevision() &&
        query.meta["authorization"] === authorizationKey(options.me) &&
        query.meta["center"] === (options.center ?? "") &&
        query.getObserversCount() > 0 &&
        targetMatches(query, options.target),
    );
  return queries;
}
function currentQuery(options: CurrentRead) {
  const queries = currentCandidates(options);
  expect(queries.length).toBeLessThanOrEqual(1);
  return queries[0];
}
function matchesPath(request: Request, target: FleetReadTarget) {
  const url = new URL(request.url);
  if (target.kind === "list")
    return (
      url.pathname === "/api/v1/motorcycles/" &&
      !url.searchParams.has("code") &&
      Object.entries(target.params ?? {}).every(
        ([key, value]) => url.searchParams.get(key) === value,
      )
    );
  if (target.kind === "record") return url.pathname === `/api/v1/motorcycles/${target.id}/`;
  return matchesHistory(url, target);
}
function matchesHistory(url: URL, target: Extract<FleetReadTarget, { kind: "history" }>) {
  if (target.tab === "fuel")
    return (
      url.pathname === "/api/v1/fuel-loads/" && url.searchParams.get("motorcycle") === target.id
    );
  if (target.tab === "incidents")
    return (
      url.pathname === "/api/v1/incidents/" &&
      url.searchParams.get("kind") === "fleet" &&
      url.searchParams.get("motorcycle") === target.id
    );
  const suffix = target.tab === "services" ? "services" : "responsibility-letters";
  return url.pathname === `/api/v1/motorcycles/${target.id}/${suffix}/`;
}
function requestOrganization(read: FleetRead, me: Me) {
  const header = read.request.headers.get("X-Organization");
  if (header !== null) return header === me.organization?.slug;
  return me.organizations.length === 1 && me.organizations[0]?.slug === me.organization?.slug;
}
function consumedRead(options: CurrentRead) {
  return options.reads
    .slice(options.since)
    .find(
      (read) =>
        read.revision === currentRevision() &&
        requestOrganization(read, options.me) &&
        !read.request.signal.aborted &&
        read.response?.ok === true &&
        read.response.bodyUsed &&
        read.body?.isConsumed() === true &&
        matchesPath(read.request, options.target),
    );
}
function inspectAccepted(options: CurrentRead, query: Query) {
  if (currentQuery(options) !== query) return false;
  if (query.state.fetchStatus !== "idle") return false;
  if (query.state.status === "error")
    throw new Error("Current fleet read failed", { cause: query.state.error });
  if (!consumedRead(options)) return false;
  expect(query.state.status).toBe("success");
  expect(query.state.data).toBeDefined();
  if (options.target.kind === "record") {
    expect(query.state.data).toHaveProperty("id", options.target.id);
    expect(query.state.data).toHaveProperty("code", options.target.code);
  }
  return true;
}
function accepted(options: CurrentRead) {
  return new Promise<Query>((resolve, reject) => {
    const inspect = () => {
      try {
        const query = currentQuery(options);
        if (!query) return;
        if (!inspectAccepted(options, query)) return;
        unsubscribe();
        resolve(query);
      } catch (error) {
        unsubscribe();
        reject(error instanceof Error ? error : new Error("Fleet readiness failed"));
      }
    };
    const unsubscribe = options.client.getQueryCache().subscribe(inspect);
    inspect();
  });
}
/** Follow natural active-observer replacement; never reuse an earlier actor, body or query instance. */
export async function acceptFleetRead(options: CurrentRead) {
  await waitFor(() => {
    expect(currentCandidates(options).length).toBeGreaterThan(0);
  });
  let query: Query;
  do {
    query = await act(async () => accepted(options));
  } while (!inspectAccepted(options, query));
  return query.state.data;
}
