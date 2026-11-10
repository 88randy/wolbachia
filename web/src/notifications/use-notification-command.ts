import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useSessionGuard } from "../session/use-session-guard";
import { reportSessionError } from "../session/session-events";
import { useOnlineStatus } from "../shell/use-online-status";
import { markNotificationsRead } from "./notification-state";
import { notificationOwner } from "./use-notification-scope";
import type { useNotificationScope } from "./use-notification-scope";
import type { NotificationPage, Preference, Preferences } from "./notification-query";

type Scope = ReturnType<typeof useNotificationScope>;
type Command = { type: "read"; id: string } | { type: "preference"; preference: Preference };
type Cached = NotificationPage | Preferences;
type Snapshot = [QueryKey, Cached | undefined][];
interface CommandRuntime {
  scope: Scope;
  cache: QueryClient;
  command: Command;
  signal: AbortSignal;
}
const locks = new WeakMap<QueryClient, Set<string>>();

function filtersFor(scope: Scope) {
  return {
    predicate: (query: { queryKey: readonly unknown[]; meta?: Record<string, unknown> }) =>
      query.queryKey[1] === scope.identity.userId &&
      query.queryKey[2] === scope.identity.organizationSlug &&
      query.queryKey[3] === "notifications" &&
      query.meta?.["authorization"] === scope.identity.authorization &&
      query.meta?.["center"] === scope.identity.activeCenter,
  };
}
function applyCommand(previous: Cached, command: Command): Cached {
  if (command.type === "read")
    return "results" in previous ? markNotificationsRead(previous, command.id) : previous;
  if (!("preferences" in previous)) return previous;
  return {
    preferences: previous.preferences.map((row) =>
      row.kind === command.preference.kind ? command.preference : row,
    ),
  };
}
async function sendCommand({ scope, command, signal }: CommandRuntime): Promise<void> {
  if (command.type === "preference") {
    const { kind, in_app, email } = command.preference;
    unwrap(
      await scope.client.PATCH("/api/v1/me/notification-preferences/", {
        body: { preferences: [{ kind, in_app, email }] },
        signal,
      }),
    );
  } else if (command.id === "all") {
    unwrap(await scope.client.POST("/api/v1/notifications/read-all/", { signal }));
  } else {
    unwrap(
      await scope.client.POST("/api/v1/notifications/{id}/read/", {
        params: { path: { id: command.id } },
        signal,
      }),
    );
  }
}
function restore(cache: QueryClient, snapshot: Snapshot, provisional: Snapshot): void {
  snapshot.forEach(([key, previous], index) => {
    if (previous && cache.getQueryData(key) === provisional[index]?.[1])
      cache.setQueryData(key, previous);
  });
}
function acquire(cache: QueryClient, owner: string): (() => void) | undefined {
  const active = locks.get(cache) ?? new Set<string>();
  if (active.has(owner)) return undefined;
  active.add(owner);
  locks.set(cache, active);
  return () => {
    active.delete(owner);
  };
}
interface Attempt {
  runtime: Omit<CommandRuntime, "signal">;
  guard: ReturnType<ReturnType<typeof useSessionGuard>>;
  isCurrent: () => boolean;
  setStatus: (value: "saved" | "failed" | "busy") => void;
}
async function performCommand(attempt: Attempt): Promise<void> {
  const { runtime, guard, isCurrent, setStatus } = attempt;
  const filters = filtersFor(runtime.scope);
  await runtime.cache.cancelQueries(filters);
  if (!isCurrent()) return;
  const { snapshot, provisional } = stageCommand(runtime);
  try {
    await sendCommand({ ...runtime, signal: guard.signal });
    if (!isCurrent()) return;
    setStatus("saved");
    await runtime.cache.invalidateQueries(filters);
  } catch (error) {
    if (!isCurrent()) return;
    restore(runtime.cache, snapshot, provisional);
    setStatus("failed");
    reportSessionError(error, runtime.cache);
  }
}
function stageCommand(runtime: Omit<CommandRuntime, "signal">) {
  const filters = filtersFor(runtime.scope);
  const snapshot = runtime.cache.getQueriesData<Cached>(filters);
  runtime.cache.setQueriesData<Cached>(
    filters,
    (previous) => previous && applyCommand(previous, runtime.command),
  );
  const provisional: Snapshot = snapshot.map(([key]) => [
    key,
    runtime.cache.getQueryData<Cached>(key),
  ]);
  return { snapshot, provisional };
}

interface Status {
  owner: string;
  revision: number;
  value: "busy" | "saved" | "failed";
}
function useCommandRuntime(scope: Scope) {
  const cache = useQueryClient();
  const begin = useSessionGuard();
  const isOnline = useOnlineStatus();
  const owner = notificationOwner(scope);
  const current = useRef(owner);
  const lastCommand = useRef<Command | null>(null);
  current.current = owner;
  const [status, setStatus] = useState<Status | null>(null);
  return { cache, begin, isOnline, owner, current, lastCommand, status, setStatus, scope };
}
function canIssue(runtime: ReturnType<typeof useCommandRuntime>, command: Command): boolean {
  if (!runtime.isOnline || !runtime.scope.identity.isSettled) return false;
  return (
    command.type !== "preference" ||
    runtime.scope.identity.permissions?.includes("notification_preference.update") === true
  );
}
async function issueCommand(runtime: ReturnType<typeof useCommandRuntime>, command: Command) {
  const { cache, owner, current, lastCommand, begin, scope } = runtime;
  if (!canIssue(runtime, command)) return;
  const release = acquire(cache, owner);
  if (!release) return;
  lastCommand.current = command;
  const guard = begin();
  const isCurrent = () => !guard.isStale() && current.current === owner;
  const update = (value: Status["value"]) => {
    runtime.setStatus({ owner, revision: scope.identity.revision, value });
  };
  update("busy");
  try {
    await performCommand({
      runtime: { scope, cache, command },
      guard,
      isCurrent,
      setStatus: update,
    });
  } finally {
    release();
  }
}
/** One command per identity at a time; never retry a write automatically after reauthentication. */
export function useNotificationCommand(scope: Scope) {
  const runtime = useCommandRuntime(scope);
  const { owner, status, lastCommand, isOnline } = runtime;
  const issue = (command: Command) => issueCommand(runtime, command);
  const retry = () => {
    if (status?.owner === owner && lastCommand.current) void issue(lastCommand.current);
  };
  return {
    issue,
    retry,
    isOnline,
    status:
      status?.owner === owner && status.revision === scope.identity.revision ? status.value : null,
  };
}
