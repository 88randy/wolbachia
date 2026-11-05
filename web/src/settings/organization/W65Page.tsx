import { useMe } from "../../session/use-me";
import { useActiveCenter } from "../../centers/use-active-center";
import { authorizationKey } from "../../centers/center-selection";
import { RolesScreen } from "./RolesScreen";
/** Authorization changes discard sensitive drafts; same-identity reauthentication retains them. */
export function W65Page() {
  const me = useMe();
  const center = useActiveCenter();
  return (
    <RolesScreen
      key={`${me.user.id}|${me.organization?.slug ?? ""}|${authorizationKey(me)}|${center}`}
    />
  );
}
