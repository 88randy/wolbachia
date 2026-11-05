import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { reconcileSession } from "./session-reconcile";

/** Asks `/me/` again after a failed session check (the explicit retry of the blocking state). */
export function useRetrySession() {
  const queryClient = useQueryClient();
  const client = useApiClient();
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const retry = async (): Promise<void> => {
    if (isBusy) return;
    setIsBusy(true);
    if (await reconcileSession(queryClient, client)) await router.invalidate();
    setIsBusy(false);
  };
  return { retry, isBusy };
}
