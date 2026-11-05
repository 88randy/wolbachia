import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Schemas } from "@wolbachia/api-client";
import { createFakeApi, makeMe, makeVoidReasonItems } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { renderApp } from "../test/render-app";

export const LIST = "/fleet/motorcycles";
export const GET = "GET /api/v1/motorcycles/";
export const ALLOWED = makeMe({
  permissions: ["motorcycle.read", "motorcycle.manage", "motorcycle.unblock"],
});
export function motorcycle(overrides: Partial<Schemas["Motorcycle"]> = {}): Schemas["Motorcycle"] {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    code: "M-03",
    plate: "TEST-03",
    is_blocked: true,
    blocked_reason: "severe_check",
    created_at: "2026-10-01T15:00:00Z",
    created_by: null,
    voided_at: null,
    voided_by: null,
    void_reason_code: "",
    void_reason: "",
    ...overrides,
  };
}
export function pageOf(results = [motorcycle()], count = results.length) {
  return Response.json({ count, next: null, previous: null, results });
}
export async function openFleet(
  options: {
    path?: string;
    me?: typeof ALLOWED;
    routes?: FakeApiRoutes;
    language?: "en" | "es-MX";
  } = {},
) {
  const api = createFakeApi({
    "GET /api/v1/me/": Response.json(options.me ?? ALLOWED),
    [GET]: pageOf(),
    "GET /api/v1/catalogs/void-reason/items/": Response.json({
      count: 3,
      next: null,
      previous: null,
      results: makeVoidReasonItems(),
    }),
    ...options.routes,
  });
  const app = await renderApp({
    path: options.path ?? LIST,
    fetch: api.fetch,
    language: options.language ?? "es-MX",
  });
  return { api, app };
}

/** The shared void dialog (#80) asks for a catalog reason first; "Other" shows the free-text field. */
export async function otherReasonField(): Promise<HTMLTextAreaElement> {
  const dialog = within(await screen.findByRole("dialog"));
  await userEvent.selectOptions(await dialog.findByRole("combobox"), "other");
  return dialog.getByRole<HTMLTextAreaElement>("textbox");
}
