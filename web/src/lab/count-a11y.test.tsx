import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { BAG, candidate, count, openCount, outcome, pageOf } from "./count-test-helpers";

beforeEach(() => {
  window.sessionStorage.clear();
});

test("identifies the selected bag in global history and its correction dialog", async () => {
  const otherBag = "00000000-0000-4000-8000-000000000033";
  const otherCode = "B-033";
  const otherCount = "00000000-0000-4000-8000-000000000034";
  await openCount({
    path: "/lab/count-history",
    routes: {
      "GET /api/v1/egg-counts/": pageOf([count(), count({ id: otherCount, bag_id: otherBag, bag_code: otherCode })]),
      [`GET /api/v1/egg-counts/${otherCount}/void-context/`]: Response.json({
        id: otherCount,
        kind: "count",
        bag_id: otherBag,
        current_revision: 1,
        is_current: true,
        blocked_by: [],
      }),
    },
  });
  const row = await screen.findByRole("row", { name: new RegExp(otherCode) });
  await userEvent.click(within(row).getByRole("button", { name: "Corregir conteo" }));
  const dialog = await screen.findByRole("dialog", { name: "Corregir conteo" });
  // The dialog names the bag by its code, never by its id.
  expect(within(dialog).getByText(new RegExp(otherCode))).toBeDefined();
});

test("announces an uncertain save while preserving focus and the numeric draft", async () => {
  await openCount({
    routes: {
      [`POST /api/v1/bags/${BAG}/counts/`]: () => {
        throw new TypeError("Synthetic lost reply");
      },
    },
  });
  const input = await screen.findByRole("textbox", { name: "¿Cuántos huevos contaste?" });
  await userEvent.type(input, "12{Enter}");
  const notice = await screen.findByText(/No se confirmó el guardado/);
  expect(notice.closest('[role="status"]')).not.toBeNull();
  expect(document.activeElement).toBe(input);
});

test("announces each saved bag during consecutive keyboard captures", async () => {
  const next = { ...candidate("B-032"), id: "bag-32" };
  await openCount({
    routes: {
      [`POST /api/v1/bags/${BAG}/counts/`]: () => outcome(next),
      "POST /api/v1/bags/bag-32/counts/": () => outcome(),
    },
  });
  await userEvent.type(
    await screen.findByRole("textbox", { name: "¿Cuántos huevos contaste?" }),
    "12{Enter}",
  );
  let saved = await screen.findByText("Conteo guardado.");
  expect(saved.closest('[role="status"]')?.textContent).toContain("B-031");
  await userEvent.type(
    await screen.findByRole("textbox", { name: "¿Cuántos huevos contaste?" }),
    "13{Enter}",
  );
  await screen.findByText(/No hay bolsas por contar/);
  saved = screen.getByText("Conteo guardado.");
  expect(saved.closest('[role="status"]')?.textContent).toContain("B-032");
});
