import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";

type Signal = AbortSignal | undefined;

export interface NewPerson {
  username: string;
  display_name: string;
  center_id: string;
  work_email?: string;
}

export function requestCreateUser(client: ApiClient, body: NewPerson, signal: Signal) {
  return client.POST("/api/v1/users/", { body, signal }).then(unwrap);
}

export function requestMembership(client: ApiClient, id: string, signal: Signal) {
  return client.GET("/api/v1/memberships/{id}/", { params: { path: { id } }, signal }).then(unwrap);
}

interface Assignment {
  membershipId: string;
  profiles: string[];
  scope: Schemas["MeScope"];
  isActive?: boolean;
}

/** Reads the current revision first: a retry never holds a stale one. */
export async function requestAssignment(client: ApiClient, change: Assignment, signal: Signal) {
  const current = await requestMembership(client, change.membershipId, signal);
  return client
    .POST("/api/v1/memberships/{id}/change-scope/", {
      params: { path: { id: change.membershipId } },
      body: {
        expected_revision: current.revision,
        profiles: change.profiles,
        scope: change.scope,
        ...(change.isActive === undefined ? {} : { is_active: change.isActive }),
      },
      signal,
    })
    .then(unwrap);
}

/** Reactivation keeps the profiles and scope the membership already has. */
export async function requestReactivate(client: ApiClient, membershipId: string, signal: Signal) {
  const current = await requestMembership(client, membershipId, signal);
  return client
    .POST("/api/v1/memberships/{id}/change-scope/", {
      params: { path: { id: membershipId } },
      body: {
        expected_revision: current.revision,
        profiles: current.profiles,
        scope: current.scope,
        is_active: true,
      },
      signal,
    })
    .then(unwrap);
}

export function requestTemporaryPassword(client: ApiClient, id: string, signal: Signal) {
  return client
    .POST("/api/v1/users/{id}/temporary-password/", { params: { path: { id } }, signal })
    .then(unwrap);
}

export function requestDeactivate(
  client: ApiClient,
  target: { id: string; revision: number; reason: string },
  signal: Signal,
) {
  return client
    .POST("/api/v1/users/{id}/deactivate/", {
      params: { path: { id: target.id } },
      body: { expected_revision: target.revision, reason: target.reason },
      signal,
    })
    .then(unwrap);
}

export function requestCopyProfile(
  client: ApiClient,
  body: Schemas["ProfileCopyRequest"],
  signal: Signal,
) {
  return client.POST("/api/v1/roles/", { body, signal }).then(unwrap);
}
