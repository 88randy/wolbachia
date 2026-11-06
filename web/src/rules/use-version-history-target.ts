import { useCallback, useState } from "react";
import type { RuleParameterVersion } from "./rules-query";
/** Only the disclosure target and success notice live here; the API still owns all mutations. */
export function useVersionHistoryTarget() {
  const [target, setTarget] = useState<RuleParameterVersion>();
  const [isDone, setIsDone] = useState(false);
  const open = useCallback((version: RuleParameterVersion) => {
    setIsDone(false);
    setTarget(version);
  }, []);
  const cancel = () => {
    setTarget(undefined);
  };
  const complete = () => {
    setTarget(undefined);
    setIsDone(true);
  };
  return { target, isDone, open, cancel, complete };
}
