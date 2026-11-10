import { screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { createFakeApi, makeMe } from "../test/fake-api";
import { ID, incident } from "../test/incident-fixtures";
import { renderApp } from "../test/render-app";

test.each([true, false])(
  "a lab incident links back to the Bag only with reception permission (%s)",
  async (canReceive) => {
    const record = incident({
      origin: "lab_reception",
      linked_record: { kind: "bag", available: true, id: ID, code: "B-030", is_voided: false },
    });
    const api = createFakeApi({
      "GET /api/v1/me/": Response.json(
        makeMe({
          permissions: ["incident.read", ...(canReceive ? ["bag.receive"] : [])],
          scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
        }),
      ),
      "GET /api/v1/incidents/": Response.json({
        count: 1,
        next: null,
        previous: null,
        results: [record],
      }),
      [`GET /api/v1/incidents/${ID}/`]: Response.json(record),
    });
    await renderApp({ path: "/incidents/I-0033", fetch: api.fetch });
    await screen.findByText("B-030");
    const link = screen.queryByRole("link", { name: "B-030" });
    if (canReceive)
      expect(link?.getAttribute("href")).toBe("/lab/bags?code=B-030&view=discrepancies");
    else expect(link).toBeNull();
  },
);
