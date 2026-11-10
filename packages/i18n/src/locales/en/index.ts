import { regulatory } from "./regulatory.ts";
import { portal } from "./portal.ts";
import { notifications } from "./notifications.ts";
import { transfers } from "./transfers.ts";
import { allocation } from "./allocation.ts";
import { permitDocument } from "./permitDocument.ts";
import { permits } from "./permits.ts";
import { releases } from "./releases.ts";
import { community } from "./community.ts";
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
/** English catalog: exactly the keys of `../es-MX`, composed from one file per area. */
import type { MessageKey } from "../es-MX/index.ts";
import { fleet } from "./fleet.ts";
import { hub } from "./hub.ts";
import { perm } from "./perm.ts";
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
import { mapPicker } from "./mapPicker.ts";
import { users } from "./users.ts";
import { rules } from "./rules.ts";
import { states } from "./states.ts";
import { sync } from "./sync.ts";
import { table } from "./table.ts";
import { voiding } from "./voiding.ts";

import { discrepancies } from "./discrepancies.ts";
export const en: Record<MessageKey, string> = {
  ...conditions,
  ...incidentTypes,
  ...notifications,
  ...transfers,
  ...allocation,
  ...discrepancies,
  ...transferEvidence,
  ...permitDocument,
  ...permits,
  ...releases,
  ...community,

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
  ...perm,
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
  ...mapPicker,
  ...users,
  ...rules,
  ...voiding,
};
