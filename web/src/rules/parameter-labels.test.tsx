import { screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import { optionKindOf, useParameterLabels } from "./parameter-labels";

function Probe() {
  const labels = useParameterLabels();
  const format = (n: number) => String(n);
  return (
    <ul>
      <li>
        {labels.valueText({ key: "departure_requires_offline_map", unit: "count" }, 1, format)}
      </li>
      <li>{labels.valueText({ key: "delivery_signature_mode", unit: "count" }, 2, format)}</li>
      <li>{labels.valueText({ key: "pin_max_attempts", unit: "count" }, 5, format)}</li>
      <li>{labels.name("daily_task_target")}</li>
      <li>{labels.unit("count", "delivery_signature_mode") === "" ? "no-unit" : "unit"}</li>
    </ul>
  );
}

test("option parameters show their option, never the number or the unit", async () => {
  await renderWithI18n(<Probe />);
  expect(screen.getByText("Sí")).toBeTruthy();
  expect(screen.getByText("Teléfono del repartidor")).toBeTruthy();
  expect(screen.getByText("5 veces")).toBeTruthy();
  expect(screen.getByText("Meta diaria de tareas")).toBeTruthy();
  expect(screen.getByText("no-unit")).toBeTruthy();
  expect(optionKindOf("departure_requires_offline_map")).toBe("boolean");
  expect(optionKindOf("delivery_signature_mode")).toBe("enum");
  expect(optionKindOf("pin_max_attempts")).toBeUndefined();
});
