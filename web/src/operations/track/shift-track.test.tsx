import { axe } from "jest-axe";
import { screen, within } from "@testing-library/react";
import type { Schemas } from "@wolbachia/api-client";
import { expect, test } from "vitest";
import { ALLOWED, openShift, SHIFT_ID } from "../shift-test-helpers";

const TRACK = "GET /api/v1/shifts/" + SHIFT_ID + "/track/";
const TRACKING = [...ALLOWED.permissions, "courier_track.read"];

function shiftTrack(overrides: Partial<Schemas["ShiftTrack"]> = {}): Schemas["ShiftTrack"] {
  const segment = (id: string, minute: number, count: number) => ({
    id,
    started_at: `2026-11-03T14:${String(minute)}:00Z`,
    ended_at: `2026-11-03T14:${String(minute + 5)}:00Z`,
    received_at: `2026-11-03T14:${String(minute + 5)}:00Z`,
    positions: Array.from({ length: count }, (_, index) => [index * 30, 19.4, -99.1, 8]),
  });
  return {
    shift_id: SHIFT_ID,
    status: "closed",
    segments: [
      segment("00000000-0000-4000-8000-0000000000e1", 15, 12),
      segment("00000000-0000-4000-8000-0000000000e2", 20, 3),
    ],
    pending_review_count: 0,
    ...overrides,
  };
}

test("W29 shows the track with its equivalent segment table and no GPS gap notice", async () => {
  const { container } = await openShift({
    permissions: TRACKING,
    routes: { [TRACK]: () => Response.json(shiftTrack()) },
  });
  const card = within(await screen.findByRole("region", { name: "Recorrido de la jornada" }));
  const table = card.getByRole("table", { name: "Tramos del recorrido (hora del teléfono)" });
  const rows = within(table).getAllByRole("row");
  expect(rows).toHaveLength(3);
  expect(
    within(rows[0] as HTMLElement)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent),
  ).toEqual(["Inicio del tramo", "Fin del tramo", "Posiciones"]);
  expect(
    within(rows[1] as HTMLElement)
      .getAllByRole("cell")
      .at(-1)?.textContent,
  ).toBe("12");
  expect(
    within(rows[2] as HTMLElement)
      .getAllByRole("cell")
      .at(-1)?.textContent,
  ).toBe("3");
  expect(card.queryByText(/Tramos en revisión/)).toBeNull();
  expect(screen.queryByText(/Recorrido GPS no disponible/)).toBeNull();
  expect(await axe(container)).toHaveNoViolations();
});

test("segments in review are counted in words and an empty track says so", async () => {
  await openShift({
    permissions: TRACKING,
    routes: { [TRACK]: () => Response.json(shiftTrack({ segments: [], pending_review_count: 2 })) },
  });
  expect(
    await screen.findByText(
      "Tramos en revisión: 2. No se dibujan hasta que supervisión resuelva su revisión.",
    ),
  ).toBeDefined();
  expect(screen.getByText("La jornada todavía no tiene posiciones recibidas.")).toBeDefined();
  expect(screen.queryByRole("table", { name: /Tramos del recorrido/ })).toBeNull();
});

test("without courier_track.read W29 never asks for the track and keeps the gap notice", async () => {
  const { api } = await openShift();
  expect(await screen.findByText(/Recorrido GPS no disponible/)).toBeDefined();
  expect(screen.queryByRole("region", { name: "Recorrido de la jornada" })).toBeNull();
  expect(api.requests.some((request) => request.path.includes("/track/"))).toBe(false);
});
