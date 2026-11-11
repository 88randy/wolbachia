import type { TutorialId } from "../tutorial-routes";
import type { Tutorial } from "../types";
import { INVENTORY_TUTORIALS } from "./inventory";

/** Every definition. Another module adds its file here and its ids to `tutorial-routes.ts`. */
export const TUTORIALS: Readonly<Record<TutorialId, Tutorial>> = {
  ...INVENTORY_TUTORIALS,
};
