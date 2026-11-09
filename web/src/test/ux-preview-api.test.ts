import { expect, test } from "vitest";
import { createUxPreviewApi } from "../../harness/ux-preview-api";
import { FAKE_IDENTITY } from "./fake-api";
import { INVENTORY_LOCATION } from "./inventory-fixtures";
import { IDENTITY_HEADER } from "../session/attestation";

test("synthetic preview wires five inventory reads with attestation and rejects unsupported requests", async () => {
  const api = createUxPreviewApi();
  for (const path of [
    "supply-types/",
    "lots/",
    "locations/",
    "locations/" + INVENTORY_LOCATION + "/stock/",
    "locations/" + INVENTORY_LOCATION + "/movements/",
  ]) {
    const response = await api.fetch(new Request("http://127.0.0.1/api/v1/" + path));
    expect(response.headers.get(IDENTITY_HEADER)).toBe(FAKE_IDENTITY);
    expect(await response.json()).toMatchObject({ count: 1, results: [expect.any(Object)] });
  }
  await expect(
    api.fetch(
      new Request("http://127.0.0.1/api/v1/lots/", {
        method: "POST",
        body: "{}",
      }),
    ),
  ).rejects.toThrow("No fake route");
  await expect(api.fetch(new Request("http://127.0.0.1/api/v1/unknown/"))).rejects.toThrow(
    "No fake route",
  );
});
