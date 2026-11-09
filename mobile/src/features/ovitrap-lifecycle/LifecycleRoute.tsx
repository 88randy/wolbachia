import { LifecycleScreen } from "./LifecycleScreen.tsx";
import type { Route } from "../../navigation/routes.ts";
const KINDS = {
  ovitrapReplace: "replace",
  ovitrapRelocate: "relocate",
  ovitrapRemove: "remove",
} as const;
export function LifecycleRoute({
  route,
}: {
  readonly route: Extract<Route, { readonly ovitrapId: string }>;
}) {
  return (
    <LifecycleScreen
      kind={KINDS[route.name]}
      ovitrapId={route.ovitrapId}
      manualCapture={route.manualCapture}
    />
  );
}
