import { expect, test as base } from "@playwright/test";
import type { Route } from "@playwright/test";

/** What the e2e "server" attests for every answer (`X-Session-Identity`, docs/api-conventions.md). */
export const E2E_IDENTITY = "e2e-session-identity";
const IDENTITY_HEADER = "x-session-identity";

type FulfillOptions = Parameters<Route["fulfill"]>[0];

/** A route whose `fulfill` attests the answer, like the real server does for every 2xx answer. */
function attested(route: Route): Route {
  return new Proxy(route, {
    get(target, property) {
      if (property === "fulfill") {
        return (options: FulfillOptions = {}) =>
          target.fulfill({
            ...options,
            headers: { [IDENTITY_HEADER]: E2E_IDENTITY, ...options.headers },
          });
      }
      const value: unknown = Reflect.get(target, property);
      return typeof value === "function" ? (value as () => unknown).bind(target) : value;
    },
  });
}

/**
 * `test` whose `page.route` handlers answer as an attesting server: the web client rejects an
 * org-scoped answer that is not attested (#82), so every fake answer carries the identity header.
 * Specs import `test` and `expect` from here.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const original = page.route.bind(page);
    page.route = ((
      url: Parameters<typeof original>[0],
      handler: Parameters<typeof original>[1],
      options?: Parameters<typeof original>[2],
    ) =>
      original(
        url,
        async (route, request) => {
          await handler(attested(route), request);
        },
        options,
      )) as typeof page.route;
    await provide(page);
  },
});

export { expect };
