import { useCan } from "../session/use-can";
import { NoPermissionState } from "../states/NoPermissionState";
import { useParams } from "@tanstack/react-router";
import { useSessionIdentity } from "../session/use-session-identity";
import { NotFoundState } from "../states/NotFoundState";
import { ShiftRecord } from "./ShiftRecord";
/** The API has no shift human code. Use its real UUID, without synthesizing an identity. */
export function W29Page() {
  const { id } = useParams({ strict: false });
  const identity = useSessionIdentity();
  const can = useCan();
  if (!can("shift.read")) return <NoPermissionState areaId="operations" />;
  if (!id || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return <NotFoundState />;
  return <ShiftRecord key={[identity.userId, identity.organizationSlug, identity.authorization, id].join(":")} id={id} />;
}
