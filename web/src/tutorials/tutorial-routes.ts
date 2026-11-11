/**
 * The only part of the tutorials code that ships in the main bundle: which route has which
 * tutorial. Definitions, the modal and the clips load when the modal opens.
 *
 * To add a tutorial: add its id here, its definition in `definitions/`, its copy in
 * `packages/i18n` (area `tutorials`) and its clips under `public/tutorials/`.
 */
export const TUTORIAL_IDS = [
  "receiveSupplies",
  "moveTransfer",
  "resolveDiscrepancy",
  "courierDelivery",
  "writeOffs",
  "createLocation",
  "suppliesCatalog",
] as const;

export type TutorialId = (typeof TUTORIAL_IDS)[number];

/** Route pattern (as in the router, with `$param`) to its tutorial. */
export const TUTORIAL_ROUTES: Readonly<Record<string, TutorialId>> = {
  "/inventory/lots": "receiveSupplies",
  "/inventory/lots/new": "receiveSupplies",
  "/inventory/transfers": "moveTransfer",
  "/inventory/transfers/new": "moveTransfer",
  "/inventory/transfers/$code": "moveTransfer",
  "/inventory/discrepancies": "resolveDiscrepancy",
  "/inventory/discrepancies/$code": "resolveDiscrepancy",
  "/inventory/assignments": "courierDelivery",
  "/inventory/reconciliations": "courierDelivery",
  "/inventory/write-offs": "writeOffs",
  "/inventory/locations": "createLocation",
  "/inventory/supplies": "suppliesCatalog",
};
