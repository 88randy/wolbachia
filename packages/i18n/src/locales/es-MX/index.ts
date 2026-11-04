/**
 * Mexican Spanish catalog: the SOURCE of the key list. `MessageKey` is derived from it and
 * `../en` must provide the same keys. One file per area; see the package README.
 */
import { auth } from "./auth.ts";
import { common } from "./common.ts";
import { errors } from "./errors.ts";
import { shell } from "./shell.ts";
import { phones } from "./phones.ts";
import { states } from "./states.ts";
import { sync } from "./sync.ts";
import { table } from "./table.ts";
import { voiding } from "./voiding.ts";

export const esMX = {
  ...common,
  ...errors,
  ...shell,
  ...states,
  ...auth,
  ...sync,
  ...table,
  ...phones,
  ...voiding,
} as const;

/** Every key of the catalog. */
export type MessageKey = keyof typeof esMX;
