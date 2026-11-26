/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { useApiClient } from "../api/ApiClientProvider";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { useAdminWrite } from "../settings/organization/use-admin-write";
import { requestAssignment, requestCreateUser } from "./people-requests";
import { useNewUserForm } from "./use-new-user-form";

/**
 * Two writes: create the login (no profile, no scope), then assign profile and scope. When the
 * second fails the person exists, so a retry repeats only the assignment.
 */
export function useNewUser() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const writer = useAdminWrite();
  const form = useNewUserForm();
  const [created, setCreated] = useState<Schemas["Personnel"] | null>(null);
  const [isAssigned, setAssigned] = useState(false);

  async function refreshLists() {
    await Promise.all([
      invalidateOrgScoped(queryClient, "users"),
      invalidateOrgScoped(queryClient, "administration"),
    ]);
  }
  async function assign(person: Schemas["Personnel"]) {
    const result = await writer.run((guard) =>
      requestAssignment(
        client,
        {
          membershipId: person.membership_id,
          profiles: [form.values.profileId],
          scope: form.scope,
        },
        guard.signal,
      ),
    );
    if (result) setAssigned(true);
    await refreshLists();
  }
  async function submit() {
    if (!form.isComplete || !form.hasScope) return;
    let person = created;
    if (!person) {
      const { displayName, username, email, centerId } = form.values;
      person =
        (await writer.run((guard) =>
          requestCreateUser(
            client,
            {
              display_name: displayName.trim(),
              username: username.trim(),
              center_id: centerId,
              ...(email.trim() ? { work_email: email.trim() } : {}),
            },
            guard.signal,
          ),
        )) ?? null;
      if (!person) return;
      setCreated(person);
    }
    await assign(person);
  }
  async function retry() {
    if (created) await assign(created);
  }
  return { form, writer, created, isAssigned, submit, retry };
}

export type NewUserFlow = ReturnType<typeof useNewUser>;
