/**
 * Route params added by feature folders, without editing routes.ts (avoids merge collisions).
 *
 * Convention (one feature = one folder, two small files):
 *
 * 1. `features/<feature>/routes.ts` declares its routes by augmenting this interface:
 *
 *    ```ts
 *    declare module "../../navigation/feature-routes.ts" {
 *      interface FeatureRouteParams {
 *        releaseDetail: { readonly taskId: string };   // params of the route
 *        releaseDone: NoParams;                        // a route without params
 *      }
 *    }
 *    export {};
 *    ```
 *
 * 2. `features/<feature>/screens.ts` registers the components with `registerScreen` (see
 *    screen-registry.ts), and gets ONE import line in navigation/feature-screens.ts.
 *
 * Then any screen can call `push({ name: "releaseDetail", taskId })`, fully typed.
 * Two routes with the same params are the same screen: pushing it twice does not stack it.
 */
// The interface is intentionally empty here: feature folders fill it through declaration merging.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FeatureRouteParams {}

export type FeatureRouteName = keyof FeatureRouteParams;

/** Params of a feature route that takes none: `myScreen: NoParams`. */
export interface NoParams {
  readonly params?: undefined;
}

export type FeatureRoute = {
  [Name in FeatureRouteName]: { readonly name: Name } & FeatureRouteParams[Name];
}[FeatureRouteName];
