import type { Page } from "@playwright/test";
import type { Actor } from "./support/actor";
import type { StepScript } from "./support/record-step";

/**
 * Clip scripts of the inventory tutorials. Keys are `<tutorial>/<step>` (same ids as
 * `src/tutorials/definitions/inventory.ts`). NONE of them saves anything: each one opens a form,
 * fills it, and stops before the final button, so the shared demo data is not touched.
 */
const USER = "demo-warehouse";

/** Opens a combobox by its label and picks its first option. */
async function pickFirst(actor: Actor, label: RegExp | string): Promise<void> {
  const { page } = actor;
  await actor.click(page.getByRole("combobox", { name: label }).first());
  await actor.click(page.getByRole("option").first());
}

/** Opens the first row of the list that has the given quick filter, e.g. "Por enviar". */
async function openFirstRow(actor: Actor, quickFilter: RegExp): Promise<void> {
  await actor.click(actor.page.getByRole("button", { name: quickFilter }));
  await actor.click(actor.page.locator("tbody a").first());
}

const heading = (page: Page, name: string | RegExp) => page.getByRole("heading", { name }).first();

export const INVENTORY_STEPS: Record<string, StepScript> = {
  "receiveSupplies/open": {
    user: USER,
    start: "/inventory/lots",
    run: async (a) => {
      await a.point(a.page.getByRole("button", { name: "Nuevo lote" }));
    },
  },
  "receiveSupplies/new": {
    user: USER,
    start: "/inventory/lots",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Nuevo lote" }));
    },
  },
  "receiveSupplies/supply": {
    user: USER,
    start: "/inventory/lots/new",
    run: async (a) => {
      await pickFirst(a, /Insumo/);
    },
  },
  "receiveSupplies/place": {
    user: USER,
    start: "/inventory/lots/new",
    run: async (a) => {
      await pickFirst(a, /Centro/);
      await pickFirst(a, /Ubicación inicial/);
      await a.type(a.page.getByLabel("Cantidad inicial", { exact: true }), "40");
    },
  },
  "receiveSupplies/save": {
    user: USER,
    start: "/inventory/lots/new",
    run: async (a) => {
      await a.point(a.page.getByRole("button", { name: "Guardar borrador" }));
    },
  },

  "moveTransfer/prepare": {
    user: USER,
    start: "/inventory/transfers",
    run: async (a) => {
      await a.click(a.page.getByRole("link", { name: "Nuevo envío" }));
      await pickFirst(a, /Sale de/);
      await pickFirst(a, /Llega a/);
    },
  },
  "moveTransfer/items": {
    user: USER,
    start: "/inventory/transfers/new",
    run: async (a) => {
      await pickFirst(a, /Sale de/);
      await pickFirst(a, /Lote/);
    },
  },
  "moveTransfer/sign": {
    user: USER,
    start: "/inventory/transfers",
    run: async (a) => {
      await openFirstRow(a, /^Por enviar/);
      await a.point(a.page.getByRole("button", { name: "Firmar y despachar" }).last());
    },
  },
  "moveTransfer/receive": {
    user: USER,
    start: "/inventory/transfers",
    run: async (a) => {
      await openFirstRow(a, /^En camino/);
      await a.point(heading(a.page, "Confirmar recepción"));
      await a.point(a.page.getByRole("button", { name: "Confirmar recepción" }).last());
    },
  },

  "resolveDiscrepancy/open": {
    user: USER,
    start: "/inventory/discrepancies",
    run: async (a) => {
      await a.click(a.page.locator("tbody a").first());
    },
  },
  "resolveDiscrepancy/review": {
    user: USER,
    start: "/inventory/discrepancies",
    run: async (a) => {
      await a.click(a.page.locator("tbody a").first());
      await a.point(heading(a.page, /Manifiestos e historial/));
    },
  },
  "resolveDiscrepancy/outcome": {
    user: USER,
    start: "/inventory/discrepancies",
    run: async (a) => {
      await a.click(a.page.locator("tbody a").first());
      await a.point(a.page.getByText(/Cómo se resolvió/).first());
    },
  },
  "resolveDiscrepancy/reason": {
    user: USER,
    start: "/inventory/discrepancies",
    run: async (a) => {
      await a.click(a.page.locator("tbody a").first());
      await a.point(a.page.getByText(/Motivo de la resolución/).first());
    },
  },
  "resolveDiscrepancy/sign": {
    user: USER,
    start: "/inventory/discrepancies",
    run: async (a) => {
      await a.click(a.page.locator("tbody a").first());
      await a.point(a.page.getByText(/firma de recibido/i).first());
    },
  },
  "resolveDiscrepancy/confirm": {
    user: USER,
    start: "/inventory/discrepancies",
    run: async (a) => {
      await a.click(a.page.locator("tbody a").first());
      await a.point(a.page.getByRole("button", { name: "Resolver" }).first());
    },
  },

  "courierDelivery/prepare": {
    user: USER,
    start: "/inventory/assignments",
    run: async (a) => {
      await a.click(a.page.getByRole("link", { name: "Nueva entrega" }));
      await pickFirst(a, /Repartidor/);
    },
  },
  "courierDelivery/sign": {
    user: USER,
    start: "/inventory/assignments/new",
    run: async (a) => {
      await pickFirst(a, /Repartidor/);
      await a.point(a.page.getByText(/firma/i).first());
    },
  },
  "courierDelivery/reconcile": {
    user: USER,
    start: "/inventory/reconciliations",
    run: async (a) => {
      await a.point(a.page.getByRole("button", { name: "Justificar" }).first());
    },
  },
  "courierDelivery/void": {
    user: USER,
    start: "/inventory/assignments",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: /^Entregada/ }));
      await a.click(a.page.getByRole("button", { name: "Más opciones" }).first());
    },
  },
  "courierDelivery/justify": {
    user: USER,
    start: "/inventory/reconciliations",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Justificar" }).first());
      await a.click(a.page.getByRole("combobox", { name: /Motivo/ }));
    },
  },

  "writeOffs/open": {
    user: USER,
    start: "/inventory/write-offs",
    run: async (a) => {
      await a.point(a.page.getByRole("button", { name: "Registrar una baja" }));
    },
  },
  "writeOffs/new": {
    user: USER,
    start: "/inventory/write-offs",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Registrar una baja" }));
    },
  },
  "writeOffs/find": {
    user: USER,
    start: "/inventory/write-offs",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Registrar una baja" }));
      await pickFirst(a, /Lote/);
    },
  },
  "writeOffs/fill": {
    user: USER,
    start: "/inventory/write-offs",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Registrar una baja" }));
      await pickFirst(a, /Lote/);
      await pickFirst(a, /Motivo/);
    },
  },
  "writeOffs/save": {
    user: USER,
    start: "/inventory/write-offs",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Registrar una baja" }));
      await a.point(a.page.getByRole("button", { name: "Dar de baja" }).last());
    },
  },

  "createLocation/open": {
    user: USER,
    start: "/inventory/locations",
    run: async (a) => {
      await a.point(a.page.getByRole("button", { name: "Nueva ubicación" }));
    },
  },
  "createLocation/new": {
    user: USER,
    start: "/inventory/locations",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Nueva ubicación" }));
    },
  },
  "createLocation/data": {
    user: USER,
    start: "/inventory/locations",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Nueva ubicación" }));
      await a.type(a.page.getByLabel("Nombre", { exact: true }), "TUT-Almacén de ejemplo");
      await pickFirst(a, /Tipo de ubicación/);
      await pickFirst(a, /Centro/);
    },
  },
  "createLocation/place": {
    user: USER,
    start: "/inventory/locations",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Nueva ubicación" }));
      await a.point(a.page.getByText(/Lugar en el mapa/).first());
    },
  },
  "createLocation/save": {
    user: USER,
    start: "/inventory/locations",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Nueva ubicación" }));
      await a.point(a.page.getByRole("button", { name: "Crear registro" }));
    },
  },

  "suppliesCatalog/open": {
    user: USER,
    start: "/inventory/supplies",
    run: async (a) => {
      await a.point(a.page.getByRole("button", { name: "Nuevo insumo" }));
    },
  },
  "suppliesCatalog/new": {
    user: USER,
    start: "/inventory/supplies",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Nuevo insumo" }));
    },
  },
  "suppliesCatalog/identity": {
    user: USER,
    start: "/inventory/supplies",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Nuevo insumo" }));
      await a.type(a.page.getByLabel("Nombre del insumo"), "TUT-Insumo de ejemplo");
      await a.type(a.page.getByLabel("Código", { exact: true }), "TUT-001");
    },
  },
  "suppliesCatalog/rules": {
    user: USER,
    start: "/inventory/supplies",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Nuevo insumo" }));
      await a.point(a.page.getByText("Requiere caducidad").first());
    },
  },
  "suppliesCatalog/save": {
    user: USER,
    start: "/inventory/supplies",
    run: async (a) => {
      await a.click(a.page.getByRole("button", { name: "Nuevo insumo" }));
      await a.point(a.page.getByRole("button", { name: "Crear registro" }));
    },
  },
};
