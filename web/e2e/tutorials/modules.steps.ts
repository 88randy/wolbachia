import type { Page } from "@playwright/test";
import type { Actor } from "./support/actor";
import type { StepScript } from "./support/record-step";

/**
 * Clip scripts of the non-inventory tutorials (`<tutorial>/<step>`, same ids as
 * `src/tutorials/definitions/modules.ts`). NONE of them saves anything: each opens a screen or a form,
 * fills it at most, and stops before the final button. Elements that may not exist for the demo
 * user are pointed at only when visible (`pointIfThere`).
 */
const SUP = "demo-supervisor";
const ENTO = "demo-entomologist";
const ADMIN = "demo-admin";

const button = (page: Page, name: string | RegExp) => page.getByRole("button", { name });
const link = (page: Page, name: string | RegExp) => page.getByRole("link", { name });
const firstRow = (page: Page) => page.locator("tbody a").first();

/** Same screen for every step: the script of a step points at what that step is about. */
function screen(user: string, start: string, run: StepScript["run"]): StepScript {
  return { user, start, run };
}

/** Clicks points of the map canvas given as fractions of its size. */
async function clickMap(a: Actor, points: [number, number][]): Promise<void> {
  const box = await a.page.locator("canvas").first().boundingBox();
  if (!box) throw new Error("No map canvas.");
  for (const [x, y] of points) {
    await a.page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 24 });
    await a.pause(300);
    await a.page.mouse.down();
    await a.page.mouse.up();
    await a.pause(500);
  }
}

const EDITOR = (run: StepScript["run"]) => screen(ADMIN, "/quadrants/editor", run);
const SQUARE: [number, number][] = [
  [0.35, 0.3],
  [0.6, 0.3],
  [0.6, 0.6],
  [0.35, 0.6],
];

export const MODULE_STEPS: Record<string, StepScript> = {
  "fleetMotos/list": screen(SUP, "/fleet/motorcycles", async (a) => {
    await a.point(a.page.getByRole("heading", { name: "Motos" }));
  }),
  "fleetMotos/search": screen(SUP, "/fleet/motorcycles", async (a) => {
    await a.type(
      a.page.getByPlaceholder(/Código exacto/).or(a.page.getByLabel(/Código exacto/)),
      "M-DEMO-01",
    );
  }),
  "fleetMotos/record": screen(SUP, "/fleet/motorcycles", async (a) => {
    await a.click(firstRow(a.page));
  }),
  "fleetMotos/options": screen(SUP, "/fleet/motorcycles", async (a) => {
    await a.click(button(a.page, "Más opciones").first());
  }),

  "scheduleWeek/risk": screen(SUP, "/scheduling", async (a) => {
    await a.click(link(a.page, "Ver el riesgo"));
  }),
  "scheduleWeek/assign": screen(SUP, "/scheduling", async (a) => {
    await a.click(link(a.page, "Repartir cuadrantes"));
  }),
  "scheduleWeek/plan": screen(SUP, "/scheduling/plan", async (a) => {
    await a.click(button(a.page, "Semana siguiente"));
    await a.click(button(a.page, "Esta semana").first());
  }),
  "scheduleWeek/pending": screen(SUP, "/scheduling/plan", async (a) => {
    await a.click(button(a.page, "Reasignar pendientes").first());
  }),
  "scheduleWeek/interventions": screen(SUP, "/scheduling", async (a) => {
    await a.click(link(a.page, "Ir a intervenciones"));
  }),

  "registerIntervention/open": screen(SUP, "/scheduling", async (a) => {
    await a.click(link(a.page, "Ir a intervenciones"));
  }),
  "registerIntervention/new": screen(SUP, "/scheduling/interventions", async (a) => {
    await a.click(button(a.page, "Registrar intervención").first());
  }),
  "registerIntervention/fill": screen(SUP, "/scheduling/interventions", async (a) => {
    await a.click(button(a.page, "Registrar intervención").first());
    await a.clickIfThere(a.page.getByRole("combobox").last());
    await a.clickIfThere(a.page.getByRole("option"));
  }),
  "registerIntervention/save": screen(SUP, "/scheduling/interventions", async (a) => {
    await a.click(button(a.page, "Registrar intervención").first());
    await a.pointIfThere(
      a.page
        .getByRole("dialog")
        .getByRole("button", { name: /Guardar|Registrar/ })
        .last(),
    );
  }),

  "importRisk/open": screen(ADMIN, "/scheduling/risk/import", async (a) => {
    await a.point(a.page.getByRole("heading").first());
  }),
  "importRisk/file": screen(ADMIN, "/scheduling/risk/import", async (a) => {
    await a.click(button(a.page, /Siguiente/));
    await a.pointIfThere(a.page.locator("input[type=file]"));
  }),
  "importRisk/check": screen(ADMIN, "/scheduling/risk/import", async (a) => {
    await a.pointIfThere(a.page.getByText(/error|columna|formato/i));
  }),
  "importRisk/confirm": screen(ADMIN, "/scheduling/risk/import", async (a) => {
    await a.pointIfThere(button(a.page, /Confirmar|Aplicar/));
  }),

  "labReceive/open": screen(ENTO, "/lab/bags", async (a) => {
    await a.point(a.page.getByRole("heading", { name: "Recepción de bolsas" }));
  }),
  "labReceive/code": screen(ENTO, "/lab/bags", async (a) => {
    await a.type(a.page.locator("#bag-scan"), "B-TUT-0001");
  }),
  "labReceive/receive": screen(ENTO, "/lab/bags", async (a) => {
    await a.type(a.page.locator("#bag-scan"), "B-TUT-0001");
    await a.point(button(a.page, "Recibir bolsa").first());
  }),
  "labReceive/noPaddle": screen(ENTO, "/lab/bags", async (a) => {
    await a.pointIfThere(button(a.page, /sin papeleta/));
  }),

  "labCount/open": screen(ENTO, "/lab", async (a) => {
    await a.click(link(a.page, /Conteo de huevos/));
  }),
  "labCount/scan": screen(ENTO, "/lab/egg-counts", async (a) => {
    await a.type(a.page.locator("main input").first(), "B-TUT-0001");
  }),
  "labCount/recent": screen(ENTO, "/lab/egg-counts", async (a) => {
    await a.point(a.page.getByRole("heading", { name: "Últimas contadas" }));
  }),
  "labCount/fix": screen(ENTO, "/lab/egg-counts", async (a) => {
    await a.point(link(a.page, "Corregir un conteo"));
  }),

  "labPcr/open": screen(ENTO, "/lab/pcr", async (a) => {
    await a.point(a.page.getByRole("heading").first());
  }),
  "labPcr/pick": screen(ENTO, "/lab/pcr", async (a) => {
    await a.clickIfThere(firstRow(a.page));
  }),
  "labPcr/results": screen(ENTO, "/lab/pcr", async (a) => {
    await a.clickIfThere(firstRow(a.page));
    await a.pointIfThere(link(a.page, /resultados/i).or(button(a.page, /resultados/i)));
  }),

  "trainings/courses": screen(SUP, "/people/trainings", async (a) => {
    await a.click(a.page.getByRole("tab", { name: "Cursos" }).or(button(a.page, "Cursos")).first());
  }),
  "trainings/requirements": screen(SUP, "/people/trainings", async (a) => {
    await a.click(
      a.page.getByRole("tab", { name: "Requisitos" }).or(button(a.page, "Requisitos")).first(),
    );
  }),
  "trainings/people": screen(SUP, "/people/trainings", async (a) => {
    await a.click(
      a.page.getByRole("tab", { name: "Personas" }).or(button(a.page, "Personas")).first(),
    );
  }),

  "evaluations/open": screen(SUP, "/people/evaluations", async (a) => {
    await a.point(a.page.getByRole("heading").first());
  }),
  "evaluations/pick": screen(SUP, "/people/evaluations", async (a) => {
    await a.clickIfThere(firstRow(a.page));
  }),
  "evaluations/review": screen(SUP, "/people/evaluations", async (a) => {
    await a.clickIfThere(firstRow(a.page));
    await a.pointIfThere(a.page.getByRole("heading").nth(1));
  }),

  "users/open": screen(ADMIN, "/settings/users", async (a) => {
    await a.point(a.page.getByRole("heading").first());
  }),
  "users/search": screen(ADMIN, "/settings/users", async (a) => {
    await a.type(
      a.page
        .getByRole("searchbox")
        .or(a.page.getByPlaceholder(/Buscar/))
        .first(),
      "Ana",
    );
  }),
  "users/record": screen(ADMIN, "/settings/users", async (a) => {
    await a.clickIfThere(firstRow(a.page));
  }),
  "users/new": screen(ADMIN, "/settings/users", async (a) => {
    await a.pointIfThere(button(a.page, /Nuevo|Agregar|Invitar|Crear/));
  }),

  "quadrantList/list": screen(SUP, "/quadrants", async (a) => {
    await a.point(a.page.getByRole("heading", { name: "Cuadrantes y muestreo" }));
  }),
  "quadrantList/search": screen(SUP, "/quadrants", async (a) => {
    await a.type(a.page.getByPlaceholder("Buscar").first(), "Q-MER-01");
  }),
  "quadrantList/actions": screen(SUP, "/quadrants", async (a) => {
    await a.click(button(a.page, "Más acciones").first());
  }),

  "quadrantVersions/open": screen(SUP, "/quadrants", async (a) => {
    await a.click(button(a.page, "Más acciones").first());
    await a.clickIfThere(a.page.getByRole("menuitem", { name: /Versiones/ }));
  }),
  "quadrantVersions/review": screen(SUP, "/quadrants", async (a) => {
    await a.click(button(a.page, "Más acciones").first());
    await a.clickIfThere(a.page.getByRole("menuitem", { name: /Versiones/ }));
    await a.pause(1500);
  }),

  "quadrantMap/open": EDITOR(async (a) => {
    await a.point(a.page.locator("canvas").first(), 1800);
  }),
  "quadrantMap/quadrant": EDITOR(async (a) => {
    await a.click(button(a.page, /^Cuadrante/));
    await clickMap(a, SQUARE);
  }),
  "quadrantMap/block": EDITOR(async (a) => {
    await a.click(button(a.page, /^Manzana/));
    await clickMap(
      a,
      SQUARE.map(([x, y]): [number, number] => [x * 0.9 + 0.05, y * 0.9 + 0.05]),
    );
  }),
  "quadrantMap/point": EDITOR(async (a) => {
    await a.click(button(a.page, /^Muestreo/));
    await clickMap(a, [[0.5, 0.45]]);
  }),
  "quadrantMap/measure": EDITOR(async (a) => {
    await a.click(button(a.page, /^Medir/));
    await clickMap(a, [
      [0.3, 0.4],
      [0.6, 0.5],
    ]);
  }),
  "quadrantMap/undo": EDITOR(async (a) => {
    await a.click(button(a.page, /^Cuadrante/));
    await clickMap(a, SQUARE.slice(0, 3));
    await a.click(button(a.page, /^Deshacer/).first());
  }),
  "quadrantMap/save": EDITOR(async (a) => {
    await a.click(button(a.page, /^Cuadrante/));
    await clickMap(a, SQUARE);
    await a.pointIfThere(button(a.page, /Guardar/));
  }),

  "incidentFlow/list": screen(SUP, "/incidents", async (a) => {
    await a.point(a.page.getByRole("heading", { name: "Incidentes" }).first());
  }),
  "incidentFlow/tabs": screen(SUP, "/incidents", async (a) => {
    await a.click(link(a.page, /^De mi zona/));
    await a.click(link(a.page, /^Vencidos/));
  }),
  "incidentFlow/open": screen(SUP, "/incidents", async (a) => {
    await a.click(firstRow(a.page));
  }),
  "incidentFlow/actions": screen(SUP, "/incidents", async (a) => {
    await a.click(firstRow(a.page));
    await a.pointIfThere(button(a.page, /Cerrar|Atender|Asignar|Escalar/));
  }),

  "centers/list": screen(ADMIN, "/settings/organization/centers", async (a) => {
    await a.point(a.page.getByRole("heading").first());
  }),
  "centers/open": screen(ADMIN, "/settings/organization/centers", async (a) => {
    await a.click(firstRow(a.page));
  }),
  "centers/close": screen(ADMIN, "/settings/organization/centers", async (a) => {
    await a.click(firstRow(a.page));
    await a.pointIfThere(button(a.page, /Cerrar centro/).or(link(a.page, /Cerrar centro/)));
  }),

  "roles/open": screen(ADMIN, "/settings/roles", async (a) => {
    await a.point(a.page.getByRole("heading").first());
  }),
  "roles/pick": screen(ADMIN, "/settings/roles", async (a) => {
    await a.click(a.page.getByText("Coordinador", { exact: true }).first());
  }),
  "roles/matrix": screen(ADMIN, "/settings/roles", async (a) => {
    await a.click(a.page.getByRole("button", { name: /Editar permisos/ }).first());
    await a.pointIfThere(
      a.page
        .getByRole("main")
        .getByRole("checkbox")
        .or(a.page.getByRole("main").getByRole("switch")),
    );
  }),

  "rules/open": screen(ADMIN, "/settings/rule-parameters", async (a) => {
    await a.point(a.page.getByRole("heading").first());
  }),
  "rules/pick": screen(ADMIN, "/settings/rule-parameters", async (a) => {
    await a.clickIfThere(firstRow(a.page));
  }),
  "rules/edit": screen(ADMIN, "/settings/rule-parameters", async (a) => {
    await a.clickIfThere(firstRow(a.page));
    await a.pointIfThere(a.page.locator("main input").first());
  }),
};
