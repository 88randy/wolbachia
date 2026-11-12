import type { TutorialId } from "../tutorial-routes";
import type { Tutorial } from "../types";
import { INVENTORY_TUTORIALS } from "./inventory";
import { MODULE_TUTORIALS } from "./modules";

/** Every definition. Another module adds its tutorials to `modules.ts` and its ids to `tutorial-routes.ts`. */
export const TUTORIALS: Readonly<Record<TutorialId, Tutorial>> = {
  ...INVENTORY_TUTORIALS,
  ...MODULE_TUTORIALS,
};
