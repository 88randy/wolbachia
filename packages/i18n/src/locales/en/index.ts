/** English catalog: exactly the keys of `../es-MX`, composed from one file per area. */
import type { MessageKey } from "../es-MX/index.ts";
import { auth } from "./auth.ts";
import { common } from "./common.ts";
import { errors } from "./errors.ts";
import { shell } from "./shell.ts";
import { states } from "./states.ts";
import { sync } from "./sync.ts";

export const en: Record<MessageKey, string> = {
  ...common,
  ...errors,
  ...shell,
  ...states,
  ...auth,
  ...sync,
};
