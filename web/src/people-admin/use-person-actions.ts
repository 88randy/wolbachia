/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useApiClient } from "../api/ApiClientProvider";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { useAdminWrite } from "../settings/organization/use-admin-write";
import { useToast } from "../ui/toast-context";
import { requestDeactivate, requestMembership, requestReactivate } from "./people-requests";

/** Deactivate, reactivate and load the membership to edit; one guarded write at a time. */
export function usePersonActions(person: Schemas["Personnel"]) {
  const { t } = useTranslation();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const writer = useAdminWrite();
  const [membership, setMembership] = useState<Schemas["Membership"] | null>(null);
  const [isPasswordOpen, setPasswordOpen] = useState(false);

  async function refresh() {
    await Promise.all([
      invalidateOrgScoped(queryClient, "users"),
      invalidateOrgScoped(queryClient, "administration"),
    ]);
  }
  async function deactivate() {
    const done = await writer.run((guard) => requestDeactivate(client, person, guard.signal));
    if (!done) return;
    showToast({
      message: t("users.deactivate.done", { name: person.display_name }),
      tone: "success",
    });
    await refresh();
  }
  async function reactivate() {
    const done = await writer.run((guard) =>
      requestReactivate(client, person.membership_id, guard.signal),
    );
    if (!done) return;
    showToast({
      message: t("users.reactivate.done", { name: person.display_name }),
      tone: "success",
    });
    await refresh();
  }
  /** Always the current revision: the membership is read when the dialog opens. */
  async function openScope() {
    const current = await writer.run((guard) =>
      requestMembership(client, person.membership_id, guard.signal),
    );
    if (current) setMembership(current);
  }
  async function scopeSaved() {
    setMembership(null);
    await refresh();
  }
  return {
    writer,
    membership,
    closeScope: () => {
      setMembership(null);
    },
    scopeSaved,
    isPasswordOpen,
    setPasswordOpen,
    deactivate,
    reactivate,
    openScope,
  };
}
