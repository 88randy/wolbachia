import { useCan } from "../session/use-can";
import { NoPermissionState } from "../states/NoPermissionState";
import { useParams } from "@tanstack/react-router";
import { useSessionIdentity } from "../session/use-session-identity";
import { NotFoundState } from "../states/NotFoundState";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { ShiftRecord } from "./ShiftRecord";
import { useShiftReference } from "./use-shift-reference";

const CODE = /^[A-Za-z0-9-]{1,50}$/;

/**
 * W29 opens a shift by its human code (`JOR-0128`). An old link that carries the id still works;
 * the code is resolved to the id with a scoped lookup, so a code of another organization is unknown.
 */
export function W29Page() {
  const { code } = useParams({ strict: false });
  const identity = useSessionIdentity();
  const can = useCan();
  if (!can("shift.read")) return <NoPermissionState areaId="operations" />;
  if (!code || !CODE.test(code)) return <NotFoundState />;
  return (
    <ShiftReference
      key={[identity.userId, identity.organizationSlug, identity.authorization, code].join(":")}
      reference={code}
    />
  );
}

function ShiftReference({ reference }: { reference: string }) {
  const resolved = useShiftReference(reference);
  if (resolved.state === "loading") return <CardSkeleton />;
  if (resolved.state === "error") return <ErrorState onRetry={resolved.retry} />;
  if (resolved.state === "unknown") return <NotFoundState />;
  return <ShiftRecord id={resolved.id} reference={reference} />;
}
