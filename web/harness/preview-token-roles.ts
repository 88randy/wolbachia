import { lightTheme, web } from "@wolbachia/tokens";
export interface PreviewColorRole {
  name: string;
  cssName: string;
}
export function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
function collectRoles(group: object, prefix: string): PreviewColorRole[] {
  return Object.entries(group).flatMap(([name, value]: [string, unknown]) => {
    const cssName = `${prefix}-${kebabCase(name)}`;
    if (typeof value === "string") return [{ name: cssName.slice(2), cssName }];
    return typeof value === "object" && value !== null ? collectRoles(value, cssName) : [];
  });
}
// Both themes share the same role names. CSS resolves the current theme, including live switches.
export const PREVIEW_COLOR_ROLES = [
  ...collectRoles(lightTheme.color, "--color"),
  ...collectRoles(web.light, "--web"),
];
