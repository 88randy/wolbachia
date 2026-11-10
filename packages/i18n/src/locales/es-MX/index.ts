import { shift } from "./shift.ts";
import { incidents } from "./incidents.ts";
import { inventory } from "./inventory.ts";
import { ui } from "./ui.ts";
import { analytics } from "./analytics.ts";
import { refresh } from "./refresh.ts";
import { orgAdmin } from "./orgAdmin.ts";
import { geography } from "./geography.ts";
import { catalogs } from "./catalogs.ts";
/**
 * Mexican Spanish catalog: the SOURCE of the key list. `MessageKey` is derived from it and
 * `../en` must provide the same keys. One file per area; see the package README.
 */
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

export const esMX = {
  ...shift,
  ...incidents,
  ...inventory,
  ...ui,
  ...analytics,
  ...refresh,
  ...orgAdmin,
  ...geography,
  ...catalogs,
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
} as const;

/** Every key of the catalog. */
export type MessageKey = keyof typeof esMX;
