import { can } from "./can";
import { useMe } from "./use-me";

/** `useCan()(permission)`: whether the signed-in user holds a permission code. */
export function useCan(): (permission: string) => boolean {
  const me = useMe();
  return (permission) => can(me, permission);
}
