import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import type { SessionGuard } from "../../session/use-session-guard";
import { useSessionGuard } from "../../session/use-session-guard";
import { pointCodeOptions } from "./geography-query";
import type { GeographyScope } from "./use-w-15";
type Attempt = Schemas["SamplingPointCreateRequest"];
type Point = Schemas["SamplingPoint"];
type Message = "geography.points.unconfirmed" | "geography.points.checkFailed";
/** An ambiguous POST reserves its slot/code until an explicit scoped read confirms the exact point. */
export function usePointReconciliation(scope: GeographyScope, onConfirmed: (point: Point) => void) {
  const queryClient = useQueryClient();
  const begin = useSessionGuard();
  const pending = useRef<Attempt | null>(null);
  const checking = useRef(false);
  const [uncertain, setUncertain] = useState<Attempt | null>(null);
  const [isChecking, setChecking] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const mark = (attempt: Attempt | null) => {
    pending.current = attempt;
    setUncertain(attempt);
    setMessage(null);
  };
  const reconcile = async () => {
    const attempt = pending.current;
    if (!attempt || checking.current || !scope.identity.isSettled || !scope.canCreatePoint) return;
    const guard = begin();
    if (guard.isStale()) return;
    checking.current = true;
    setChecking(true);
    await confirmAttempt({ scope, attempt, queryClient, guard, onConfirmed, mark, setMessage });
    checking.current = false;
    if (!guard.signal.aborted) setChecking(false);
  };
  const state = { uncertain, isChecking, message };
  return { ...state, mark, reconcile, hasUncertain: () => pending.current !== null };
}
interface Confirmation {
  scope: GeographyScope;
  attempt: Attempt;
  queryClient: ReturnType<typeof useQueryClient>;
  guard: SessionGuard;
  onConfirmed: (point: Point) => void;
  mark: (attempt: Attempt | null) => void;
  setMessage: (message: Message | null) => void;
}
async function confirmAttempt(options: Confirmation) {
  const { scope, attempt, queryClient, guard, onConfirmed, mark, setMessage } = options;
  try {
    const answer = await queryClient.query({
      ...pointCodeOptions(scope, attempt.code),
      staleTime: 0,
      retry: false,
    });
    if (guard.isStale()) return;
    const point = answer.count === 1 ? answer.results[0] : undefined;
    if (!matchesAttempt(point, attempt)) {
      setMessage("geography.points.unconfirmed");
      return;
    }
    onConfirmed(point);
    mark(null);
    setMessage(null);
  } catch (caught) {
    if (guard.isStale()) return;
    console.error("Point creation reconciliation failed", caught);
    setMessage("geography.points.checkFailed");
  }
}
function matchesAttempt(point: Point | undefined, attempt: Attempt): point is Point {
  const version = point?.current_version;
  return (
    point?.code === attempt.code &&
    point.block === attempt.block &&
    version !== null &&
    version !== undefined &&
    !version.is_retired &&
    version.location.length === attempt.location.length &&
    version.location.every((coordinate, index) => coordinate === attempt.location[index])
  );
}
