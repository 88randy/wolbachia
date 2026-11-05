import { expect, test } from "@playwright/test";
import { makeMe } from "../src/test/fake-api";
import { mockApi } from "./fixtures/mock-api";
import { makeRuleParameter, makeRuleVersion } from "./fixtures/rules-mock";

const ADMIN = makeMe({
  permissions: [
    "rule_parameter.read",
    "rule_parameter_version.read",
    "rule_parameter_version.create",
    "rule_parameter_version.void",
  ],
});
const PARAMETER = "/settings/rule-parameters/revisit_interval_days";
const REASON = "Ajuste acordado con entomología para la temporada de lluvias.";

/**
 * Journey R9 runs on the parameter the backend seeds (`revisit_interval_days`, unit `day`, 7 days,
 * 1 to 28; issue #88). The fixture mirrors it.
 */
const REVISIT_INTERVAL = {
  parameter: makeRuleParameter({
    key: "revisit_interval_days",
    unit: "day",
    min_value: 1,
    max_value: 28,
  }),
  versions: [makeRuleVersion({ value: 7 })],
};

test.describe("rule parameters (W62), journey R9", () => {
  test("R9: the admin changes the revisit frequency from 7 to 6 days from a date, with a reason", async ({
    page,
  }) => {
    const api = await mockApi(page, { me: ADMIN, rules: [REVISIT_INTERVAL] });
    await page.goto("/settings");

    await page.getByRole("main").getByRole("link", { name: "Parámetros de reglas" }).click();
    const row = page.getByRole("row", { name: /revisit_interval_days/ });
    await expect(row).toContainText("1 ene 2026");
    await row.getByRole("link", { name: "revisit_interval_days" }).click();

    await expect(page).toHaveURL(new RegExp(`${PARAMETER}$`));
    await expect(page.getByRole("region", { name: "Valor vigente" })).toContainText("7 day");
    await page.getByLabel(/Valor nuevo/).fill("6");
    await page.getByLabel(/Vigente desde \(obligatorio\)/).fill("2026-11-10");
    await page.getByLabel(/Motivo del cambio/).fill(REASON);
    const comparison = page.getByRole("region", { name: "Antes y después" });
    await expect(comparison).toContainText("7 day");
    await expect(comparison).toContainText("6 day");
    await expect(comparison).toContainText("Desde el 10 nov 2026");
    await page.getByRole("button", { name: "Guardar versión" }).click();

    await expect(page.getByText("Versión guardada. Ya aparece en el historial.")).toBeVisible();
    const scheduled = page.getByRole("row", { name: /Programada/ });
    await expect(scheduled).toContainText("6 day");
    await expect(scheduled).toContainText("10 nov 2026");
    await expect(scheduled).toContainText("ana.supervisora");
    await expect(scheduled).toContainText(REASON);
    const summary = page.getByRole("region", { name: "Valor vigente" });
    await expect(summary).toContainText("7 day");
    await expect(summary).toContainText("10 nov 2026");
    const sent = api.requests.find((entry) => entry.method === "POST");
    expect(sent?.path).toBe("/api/v1/rule-parameters/revisit_interval_days/versions/");
    expect(sent?.body).toEqual({ value: "6", effective_from: "2026-11-10", reason: REASON });

    await page.getByRole("link", { name: "Volver a parámetros" }).click();
    await expect(page.getByRole("row", { name: /revisit_interval_days/ })).toContainText(
      "10 nov 2026",
    );
  });
});
