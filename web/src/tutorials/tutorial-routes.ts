/**
 * The only part of the tutorials code that ships in the main bundle: which route has which
 * tutorial. Definitions, the modal and the clips load when the modal opens.
 *
 * To add a tutorial: add its id here, its definition in `definitions/`, its copy in
 * `packages/i18n` (area `tutorials`) and its clips under `public/tutorials/`.
 */
export const TUTORIAL_IDS = [
  // Inventory
  "receiveSupplies",
  "moveTransfer",
  "resolveDiscrepancy",
  "courierDelivery",
  "writeOffs",
  "createLocation",
  "suppliesCatalog",
  "inventoryHub",
  // Other modules
  "fleetMotos",
  "fleetHub",
  "scheduleWeek",
  "registerIntervention",
  "importRisk",
  "labReceive",
  "labCount",
  "labPcr",
  "trainings",
  "evaluations",
  "users",
  "quadrantList",
  "quadrantVersions",
  "quadrantMap",
  "incidentFlow",
  "centers",
  "roles",
  "rules",
] as const;

export type TutorialId = (typeof TUTORIAL_IDS)[number];

/** Route pattern (as in the router, with `$param`) to its tutorial. */
export const TUTORIAL_ROUTES: Readonly<Record<string, TutorialId>> = {
  "/inventory": "inventoryHub",
  "/fleet": "fleetHub",
  "/inventory/lots": "receiveSupplies",
  "/inventory/lots/new": "receiveSupplies",
  "/inventory/transfers": "moveTransfer",
  "/inventory/transfers/new": "moveTransfer",
  "/inventory/transfers/$code": "moveTransfer",
  "/inventory/discrepancies": "resolveDiscrepancy",
  "/inventory/discrepancies/$code": "resolveDiscrepancy",
  "/inventory/assignments": "courierDelivery",
  "/inventory/assignments/new": "courierDelivery",
  "/inventory/reconciliations": "courierDelivery",
  "/inventory/write-offs": "writeOffs",
  "/inventory/locations": "createLocation",
  "/inventory/supplies": "suppliesCatalog",
  "/fleet/motorcycles": "fleetMotos",
  "/fleet/motorcycles/$code": "fleetMotos",
  "/scheduling": "scheduleWeek",
  "/scheduling/risk": "scheduleWeek",
  "/scheduling/assignments": "scheduleWeek",
  "/scheduling/plan": "scheduleWeek",
  "/scheduling/interventions": "registerIntervention",
  "/scheduling/risk/import": "importRisk",
  "/lab/bags": "labReceive",
  "/lab/egg-counts": "labCount",
  "/lab/pcr": "labPcr",
  "/people/trainings": "trainings",
  "/people/evaluations": "evaluations",
  "/settings/users": "users",
  "/settings/users/$id": "users",
  "/quadrants": "quadrantList",
  "/quadrants/$code/versions": "quadrantVersions",
  "/quadrants/editor": "quadrantMap",
  "/incidents": "incidentFlow",
  "/incidents/$code": "incidentFlow",
  "/settings/organization/centers": "centers",
  "/settings/organization/centers/$code": "centers",
  "/settings/organization/centers/$code/close": "centers",
  "/settings/roles": "roles",
  "/settings/rule-parameters": "rules",
  "/settings/rule-parameters/$key": "rules",
};
