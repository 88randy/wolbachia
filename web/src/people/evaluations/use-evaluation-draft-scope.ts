import { useLayoutEffect, useRef } from "react";
import type { EvaluationDraft } from "./evaluation-domain";
interface Options {
  context: string;
  draft: EvaluationDraft;
  isAllowed: boolean;
  retire: () => void;
}
/** Keep still-authorized RAM input; retire a newly denied original context before paint. */
export function useEvaluationDraftScope(options: Options) {
  const { context, draft, isAllowed, retire } = options;
  const center = draft.center;
  const previous = useRef(context);
  useLayoutEffect(() => {
    const hasChanged = previous.current !== context;
    previous.current = context;
    if (hasChanged && center && !isAllowed) retire();
  }, [context, center, isAllowed, retire]);
}
