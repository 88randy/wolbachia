import { lightTheme } from "@wolbachia/tokens";

/**
 * Color of text and icons on the navy top bar. The bar is navy in both themes and its content is
 * white in both. `packages/tokens` has no role for it yet (proposed in the PR #6 description); the
 * light theme's surface is the same white.
 */
export const ON_CHROME_COLOR = lightTheme.color.surface;
