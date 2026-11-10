import type { Me } from "../../session/me";
import { isAwareInstant, UUID_PATTERN } from "./training-input";
export interface PersonContext {
  subject: string;
  center: string;
  quadrant: string;
  action: string;
  at: string;
}
export function readPersonContext(search: Readonly<Record<string, unknown>>): PersonContext {
  const read = (key: string) => (typeof search[key] === "string" ? search[key] : "");
  return {
    subject: read("subject"),
    center: read("center"),
    quadrant: read("quadrant"),
    action: read("action"),
    at: read("at"),
  };
}
function permitsDimension(dimension: Me["scope"]["centers"], id: string): boolean {
  return dimension.mode === "all" || (dimension.mode === "selected" && dimension.ids.includes(id));
}
/** Context preferences cannot expand explicit scope, including empty selected dimensions. */
export function canReadPersonContext(me: Pick<Me, "scope">, context: PersonContext): boolean {
  return (
    UUID_PATTERN.test(context.subject) &&
    (!context.at || isAwareInstant(context.at)) &&
    canReadTrainingContext(me, context)
  );
}
export function canReadTrainingContext(
  me: Pick<Me, "scope">,
  context: Pick<PersonContext, "center" | "quadrant">,
): boolean {
  return (
    UUID_PATTERN.test(context.center) &&
    (!context.quadrant || UUID_PATTERN.test(context.quadrant)) &&
    permitsDimension(me.scope.centers, context.center) &&
    (!context.quadrant || permitsDimension(me.scope.quadrants, context.quadrant))
  );
}
