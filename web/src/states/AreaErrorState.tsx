import type { ErrorComponentProps } from "@tanstack/react-router";
import { ForbiddenError } from "../router/guards";
import { NoPermissionState } from "./NoPermissionState";
import { RouteErrorState } from "./RouteErrorState";

/**
 * Error component of the area routes: a missing permission is the "no permission" state;
 * anything else is a real failure and gets the generic error state.
 */
export function AreaErrorState(props: ErrorComponentProps) {
  if (props.error instanceof ForbiddenError)
    return <NoPermissionState areaId={props.error.areaId} />;
  return <RouteErrorState {...props} />;
}
