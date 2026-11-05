import { useMe } from "../../session/use-me";
import { authorizationKey } from "../../centers/center-selection";
import { OrganizationScreen } from "./OrganizationScreen";
/** Organization drafts belong to the actor and grants. The shell center is only a filter. */
export function W68Page() {
  const me = useMe();
  return (
    <OrganizationScreen
      key={`${me.user.id}|${me.organization?.slug ?? ""}|${authorizationKey(me)}`}
    />
  );
}
