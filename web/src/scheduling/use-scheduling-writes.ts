import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { useApiClient } from "../api/ApiClientProvider";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { useToast } from "../ui/toast-context";
import { useTranslation } from "react-i18next";

const CONFLICT = 409;

/** Plain-language reason of a failed write: somebody else changed it first, or a generic one. */
export function failureKey(error: unknown): MessageKey {
  if (error instanceof ApiError && error.status === CONFLICT) return "scheduling.error.changed";
  if (error instanceof ApiError && error.status === 403) return "scheduling.error.forbidden";
  return "errors.api.generic";
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["schedule", "assignments", "risk", "interventions"].map((resource) =>
        invalidateOrgScoped(queryClient, resource),
      ),
    );
}

export function useReassignPending(onDone: () => void) {
  const client = useApiClient();
  const refresh = useRefresh();
  const { showToast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (body: Schemas["ReassignRequestRequest"]) =>
      unwrap(await client.POST("/api/v1/schedule/reassign-pending/", { body })),
    onSuccess: async () => {
      await refresh();
      showToast({ message: t("scheduling.reassign.done"), tone: "success" });
      onDone();
    },
    onError: async (error) => {
      showToast({ message: t(failureKey(error)), tone: "critical" });
      await refresh();
    },
  });
}

export function useGenerateWeek() {
  const client = useApiClient();
  const refresh = useRefresh();
  const { showToast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (week: string) =>
      unwrap(await client.POST("/api/v1/schedule/generate/", { body: { week } })),
    onSuccess: async (result) => {
      await refresh();
      showToast({
        message: t("scheduling.generate.done", { count: result.created }),
        tone: "success",
      });
    },
    onError: (error) => {
      showToast({ message: t(failureKey(error)), tone: "critical" });
    },
  });
}

export function useMoveQuadrant() {
  const client = useApiClient();
  const refresh = useRefresh();
  const { showToast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (body: Schemas["AssignmentRequestRequest"]) =>
      unwrap(await client.PUT("/api/v1/quadrant-assignments/", { body })),
    onSuccess: async () => {
      await refresh();
      showToast({ message: t("scheduling.assign.moved"), tone: "success" });
    },
    onError: async (error) => {
      showToast({ message: t(failureKey(error)), tone: "critical" });
      await refresh();
    },
  });
}
