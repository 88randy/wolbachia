import { geography } from "./geography.ts";
/** English catalog: exactly the keys of `../es-MX`, composed from one file per area. */
import type { MessageKey } from "../es-MX/index.ts";
import { fleet } from "./fleet.ts";
import { auth } from "./auth.ts";
import { common } from "./common.ts";
import { errors } from "./errors.ts";
import { mobile } from "./mobile.ts";
import { shell } from "./shell.ts";
import { phones } from "./phones.ts";
import { rules } from "./rules.ts";
import { states } from "./states.ts";
import { sync } from "./sync.ts";
import { table } from "./table.ts";
import { voiding } from "./voiding.ts";

export const en: Record<MessageKey, string> = {
  ...geography,
  ...fleet,
  ...common,
  ...errors,
  ...mobile,
  ...shell,
  ...states,
  ...auth,
  ...sync,
  ...table,
  ...phones,
  ...rules,
  ...voiding,
};
