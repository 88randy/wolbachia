import { expect, test } from "vitest";
import { transferRouteScope } from "./transfer-route-scope";
test.each(["transfers", "discrepancies"] as const)(
  "%s observers and writes must own the exact current route before starting",
  (resource) => {
    const scope = {
      identity: { userId: "test-user", organizationSlug: "test-org", revision: 1, isSettled: true },
      pathname: `/inventory/${resource}/CODE-NEW`,
      isCurrentRead: () => true,
    };
    const obsolete = transferRouteScope(scope, resource, "CODE-OLD");
    expect(obsolete.identity.isSettled).toBe(false);
    expect(obsolete.isCurrentRead()).toBe(false);
    expect(transferRouteScope(scope, resource).identity.isSettled).toBe(false);
    expect(transferRouteScope(scope, resource, "CODE-NEW").isCurrentRead()).toBe(true);
  },
);
