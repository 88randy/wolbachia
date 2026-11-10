import { areaHomeRoute } from "../router/area-route";
import { AreaPlaceholder } from "./AreaPlaceholder";

/**
 * Areas with no screen yet. They are hidden from the sidebar (`hidden` in `router/areas.ts`);
 * the address keeps answering so old links do not break. When an area gets its first screen,
 * move it to `web/src/<area>/routes.tsx` and drop `hidden`.
 */
export const placeholderRoutes = [
  areaHomeRoute("regulatory", () => <AreaPlaceholder areaId="regulatory" />),
];
