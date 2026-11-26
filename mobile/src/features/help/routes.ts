/** Help tab route (reference example of the feature-route convention, see navigation/feature-routes.ts).
 * Inside the augmentation, the module's own exports such as NoParams are in scope without an import. */
declare module "../../navigation/feature-routes.ts" {
  interface FeatureRouteParams {
    help: NoParams;
  }
}

export {};
