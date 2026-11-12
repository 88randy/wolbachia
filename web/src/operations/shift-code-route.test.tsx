import { screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { openShift, shiftDetail, SHIFT_ID } from "./shift-test-helpers";

const LIST = "GET /api/v1/shifts/";

function page(results: { id: string; code: string }[]) {
  return () => Response.json({ count: results.length, next: null, previous: null, results });
}

test("a shift opens by its human code through a scoped lookup", async () => {
  await openShift({
    path: "/operations/shifts/JOR-0034",
    routes: { [LIST]: page([{ id: SHIFT_ID, code: "JOR-0034" }]) },
    shift: shiftDetail({ code: "JOR-0034" }),
  });
  expect(await screen.findByText("Synthetic closing")).toBeDefined();
});

test("a code the scope does not know shows the not found page", async () => {
  await openShift({
    path: "/operations/shifts/JOR-0034",
    routes: { [LIST]: page([]) },
  });
  expect(await screen.findByText("No encontramos esta página")).toBeDefined();
});

test("an old link with the id still opens the shift", async () => {
  await openShift({ path: "/operations/shifts/" + SHIFT_ID });
  expect(await screen.findByText("Synthetic closing")).toBeDefined();
});
