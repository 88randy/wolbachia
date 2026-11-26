/** P33 calendar tab and P33b day route (#373). */
declare module "../../navigation/feature-routes.ts" {
  interface FeatureRouteParams {
    calendar: NoParams;
    calendarTrack: { readonly date: string };
  }
}

export {};
