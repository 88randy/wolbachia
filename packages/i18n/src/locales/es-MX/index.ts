import { regulatory } from "./regulatory.ts";
import { portal } from "./portal.ts";
import { notifications } from "./notifications.ts";
import { transfers } from "./transfers.ts";
import { allocation } from "./allocation.ts";
import { permitDocument } from "./permitDocument.ts";
import { permits } from "./permits.ts";
import { transferEvidence } from "./transferEvidence.ts";

import { trainings } from "./trainings.ts";
import { evaluations } from "./evaluations.ts";
import { labReception } from "./labReception.ts";
import { lab } from "./lab.ts";
import { conditions } from "./conditions.ts";
import { incidentTypes } from "./incidentTypes.ts";
import { shift } from "./shift.ts";
import { scheduling } from "./scheduling.ts";
import { live } from "./live.ts";
import { incidents } from "./incidents.ts";
import { reviews } from "./reviews.ts";
import { relocations } from "./relocations.ts";
import { closure } from "./closure.ts";
import { inventory } from "./inventory.ts";
import { ui } from "./ui.ts";
import { analytics } from "./analytics.ts";
import { discovery } from "./discovery.ts";
import { refresh } from "./refresh.ts";
import { orgAdmin } from "./orgAdmin.ts";
import { geography } from "./geography.ts";
import { catalogs } from "./catalogs.ts";
/**
 * Mexican Spanish catalog: the SOURCE of the key list. `MessageKey` is derived from it and
 * `../en` must provide the same keys. One file per area; see the package README.
 */
import { fleet } from "./fleet.ts";
import { hub } from "./hub.ts";
import { auth } from "./auth.ts";
import { common } from "./common.ts";
import { errors } from "./errors.ts";
import { mobile } from "./mobile.ts";
import { courier } from "./courier.ts";
import { field } from "./field.ts";
import { courierFlow } from "./courierFlow.ts";
import { shell } from "./shell.ts";
import { phones } from "./phones.ts";
import { mapEditor } from "./mapEditor.ts";
import { users } from "./users.ts";
import { rules } from "./rules.ts";
import { states } from "./states.ts";
import { sync } from "./sync.ts";
import { table } from "./table.ts";
import { voiding } from "./voiding.ts";

import { discrepancies } from "./discrepancies.ts";
export const esMX = {
  ...conditions,
  ...incidentTypes,
  ...notifications,
  ...transfers,
  ...allocation,
  ...discrepancies,
  ...transferEvidence,
  ...permitDocument,
  ...permits,

  ...trainings,
  ...evaluations,
  ...lab,
  ...regulatory,
  ...portal,
  ...shift,
  ...scheduling,
  ...live,
  ...reviews,
  ...relocations,
  ...closure,
  ...labReception,
  ...incidents,
  ...inventory,
  ...ui,
  ...analytics,
  ...discovery,
  ...refresh,
  ...orgAdmin,
  ...geography,
  ...catalogs,
  ...fleet,
  ...hub,
  ...common,
  ...errors,
  ...mobile,
  ...courier,
  ...field,
  ...courierFlow,
  ...shell,
  ...states,
  ...auth,
  ...sync,
  ...table,
  ...phones,
  ...mapEditor,
  ...users,
  ...rules,
  ...voiding,
} as const;

/** Every key of the catalog. */
export type MessageKey = keyof typeof esMX;
