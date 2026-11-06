import { useState } from "react";
import { useScopeCodeRequest } from "./use-scope-code-request";
import { useScopeLookupTask } from "./use-scope-lookup-task";
import type { BeginScopeLookup, ScopeLookupIntent } from "./scope-types";
/** Unknown and foreign codes share one result. Stale searches cannot publish to the draft. */
export function useScopeCode(
  dimension: "centers" | "quadrants",
  editor: ScopeLookupIntent,
  beginLookup: BeginScopeLookup,
) {
  const request = useScopeCodeRequest(dimension);
  const run = useScopeLookupTask(beginLookup);
  const [code, setCode] = useState("");
  const [isMissing, setMissing] = useState(false);
  async function add() {
    const expectedIntent = editor.intentRevision;
    await run(async () => {
      setMissing(false);
      const reply = await request.resolve(code);
      if (!reply || reply.guard.isStale()) return;
      const { item } = reply;
      if (item === null) setMissing(true);
      if (!item) return;
      editor.applyLookup(expectedIntent, item.id);
      setCode("");
    });
  }
  const unavailable = isMissing || request.error !== null;
  return { code, setCode, add, isMissing: unavailable, isBusy: request.isBusy };
}
