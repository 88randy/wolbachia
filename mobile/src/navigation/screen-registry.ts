import type { ComponentType } from "react";

import type { FeatureRoute, FeatureRouteName } from "./feature-routes.ts";

/** Props every registered screen receives: its own typed route (params included). */
export interface FeatureScreenProps<Name extends FeatureRouteName> {
  readonly route: Extract<FeatureRoute, { readonly name: Name }>;
}

type AnyScreen = ComponentType<{ readonly route: FeatureRoute }>;

const screens = new Map<string, AnyScreen>();

/**
 * Registers the component of a feature route. Call it at module level in
 * `features/<feature>/screens.ts`; registering a name twice is a programming error.
 */
export function registerScreen<Name extends FeatureRouteName>(
  name: Name,
  screen: ComponentType<FeatureScreenProps<Name>>,
): void {
  if (screens.has(name)) throw new Error(`Screen "${name}" is registered twice.`);
  screens.set(name, screen as unknown as AnyScreen);
}

/** The registered component of a route name, or null for core routes handled by ScreenRouter. */
export function registeredScreen(name: string): AnyScreen | null {
  return screens.get(name) ?? null;
}
