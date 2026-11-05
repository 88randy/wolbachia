import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionGuard } from "../../session/use-session-guard";
import type { SessionGuard } from "../../session/use-session-guard";
import { useAdminWriteState } from "./use-admin-write-state";
import { runAdminWrite } from "./run-admin-write";
/** Reauthentication never resumes this callback; a ref lock prevents same-frame duplicates. */
export function useAdminWrite() {
  const begin = useSessionGuard();
  const queryClient = useQueryClient();
  const lock = useRef(false);
  const state = useAdminWriteState();
  function run<T>(request: (guard: SessionGuard) => Promise<T>): Promise<T | undefined> {
    return runAdminWrite({ request, begin, state, queryClient, lock });
  }
  return {
    run,
    isBusy: state.isBusy,
    error: state.error,
    needsReview: state.needsReview,
    reviewed: state.reviewed,
  };
}
