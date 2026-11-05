import { useEffect, useState } from "react";

import { useServices } from "../app/services-context.ts";
import { buildInboxModel } from "./inbox-model.ts";
import type { InboxModel } from "./inbox-model.ts";
import { useSyncSnapshot } from "./use-sync.ts";

/** How many problem events the inbox lists. More than a courier can read; the rest stay stored. */
const PROBLEM_LIMIT = 100;

/**
 * The inbox contents. They are read from the outbox again every time the counts change, so the
 * screen follows the sync worker without polling.
 */
export function useInbox(): InboxModel | null {
  const { outbox } = useServices();
  const { counts } = useSyncSnapshot();
  const [model, setModel] = useState<InboxModel | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void Promise.all([
      outbox.listProblems(PROBLEM_LIMIT),
      outbox.groupByType(["pending", "sending"]),
      outbox.groupByType(["sent"]),
    ])
      .then(([problems, onPhone, sent]) => {
        if (isCurrent) setModel(buildInboxModel(problems, onPhone, sent));
      })
      .catch((error: unknown) => {
        // Keep showing what we had: the events are safe in the outbox.
        console.warn("inbox.load_failed", error instanceof Error ? error.name : "unknown");
      });
    return () => {
      isCurrent = false;
    };
  }, [outbox, counts]);

  return model;
}
