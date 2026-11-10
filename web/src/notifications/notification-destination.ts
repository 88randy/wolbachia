import type { LinkProps } from "@tanstack/react-router";
import type { Notification } from "./notification-query";

const PERMISSIONS = {
  incident: "incident.read",
  motorcycle: "motorcycle.read",
  review_item: "review_item.read",
} as const;
/** No destination can be assembled from unavailable or unauthorized object metadata. */
export function notificationDestination(
  reference: Notification["object_ref"],
  permissions: readonly string[],
): LinkProps | undefined {
  if (!reference?.available || !permissions.includes(PERMISSIONS[reference.kind])) return undefined;
  if (reference.kind === "review_item")
    return reference.id ? { to: "/operations/reviews", search: { item: reference.id } } : undefined;
  if (!reference.code) return undefined;
  return {
    to: reference.kind === "incident" ? "/incidents/$code" : "/fleet/motorcycles/$code",
    params: { code: reference.code },
  };
}
