import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
const MODE_KEYS = {
  none: "orgAdmin.scope.none",
  selected: "orgAdmin.scope.selected",
  all: "orgAdmin.scope.all",
} as const satisfies Record<Schemas["ModeEnum"], MessageKey>;
/** Empty selected has the same access meaning as none, never an implicit all grant. */
export function scopeModeLabel(dimension: Schemas["ScopeDimension"]): MessageKey {
  const mode =
    dimension.mode === "selected" && dimension.ids.length === 0 ? "none" : dimension.mode;
  return MODE_KEYS[mode];
}
