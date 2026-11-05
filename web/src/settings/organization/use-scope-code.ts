import { useState } from "react";
import { useScopeCodeRequest } from "./use-scope-code-request";
import { useScopeLookupTask } from "./use-scope-lookup-task";
import type { BeginScopeLookup } from "./scope-types";
/** Unknown and foreign codes share one result. Stale searches cannot publish to the draft. */
export function useScopeCode(
  dimension: "centers" | "quadrants",
  onAdd: (id: string) => void,
  beginLookup: BeginScopeLookup,
) {
  const request = useScopeCodeRequest(dimension);
  const run = useScopeLookupTask(beginLookup);
  const [code, setCode] = useState("");
  const [isMissing, setMissing] = useState(false);
  async function add() {
    await run(async () => {
      setMissing(false);
      const item = await request.resolve(code);
      if (item === null) setMissing(true);
      if (!item) return;
      onAdd(item.id);
      setCode("");
    });
  }
  return {
    code,
    setCode,
    add,
    isMissing: isMissing || request.error !== null,
    isBusy: request.isBusy,
  };
}
