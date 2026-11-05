import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { DraftMemory } from "./draft-memory";
import type { RetainedDraft } from "./draft-memory";
import type { GeographyScope } from "./use-w-15";
import { coversRecord } from "./permissions";
/** Memory only, keyed by user/organization/code. Narrowed access destroys inaccessible draft content. */
export function DraftMemoryProvider({
  scope,
  children,
}: {
  scope: GeographyScope;
  children: ReactNode;
}) {
  const memory = useRef<RetainedDraft | null>(null);
  useLayoutEffect(() => {
    if (memory.current && (!scope.canPublish || !coversRecord(scope.me, memory.current.record)))
      memory.current = null;
  }, [scope.context, scope.canPublish, scope.me]);
  return <DraftMemory.Provider value={memory}>{children}</DraftMemory.Provider>;
}
