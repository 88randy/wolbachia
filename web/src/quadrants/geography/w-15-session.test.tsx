import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { apiError } from "../../test/fake-api";
import { fakePassword } from "../../test/fake-credentials";
import { ALLOWED, QUADRANT_ID, openGeography, version } from "./geography-test-helpers";
vi.mock("./GeographyMap", () => ({ default: () => <div role="region" aria-label="Map" /> }));
const PUBLISH = `POST /api/v1/quadrants/${QUADRANT_ID}/versions/`;
describe("geography reauthentication", () => {
  test("retains a permitted draft after 401, never replays it, and enables a new manual attempt", async () => {
    const { api, app } = await openGeography({
      routes: {
        [PUBLISH]: apiError(401, "not_authenticated"),
        "POST /api/v1/auth/login/": Response.json({
          me: ALLOWED,
          server_time: "2026-11-04T12:00:00Z",
        }),
      },
    });
    document.cookie = "csrftoken=test-csrf; path=/";
    const coordinates = await screen.findByRole<HTMLTextAreaElement>("textbox", {
      name: "Pol\u00edgono (longitud, latitud)",
    });
    const draft = "0,0\n5,0\n5,5\n0,5\n0,0";
    fireEvent.change(coordinates, { target: { value: draft } });
    await userEvent.click(screen.getByRole("button", { name: "Publicar nueva versi\u00f3n" }));
    fireEvent.change(await screen.findByLabelText("Contrase\u00f1a"), {
      target: { value: fakePassword() },
    });
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => {
      expect(screen.queryByLabelText("Contrase\u00f1a")).toBeNull();
    });
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    const writes = () =>
      api.requests.filter(({ method, path }) => method === "POST" && path.endsWith("/versions/"));
    expect(writes()).toHaveLength(1);
    expect(coordinates.value).toBe(draft);
    const publish = await screen.findByRole("button", { name: "Publicar nueva versi\u00f3n" });
    await waitFor(() => {
      expect(publish.hasAttribute("disabled")).toBe(false);
    });
    api.setRoute(
      PUBLISH,
      Response.json({ version: version(2), spacing_warnings: [] }, { status: 201 }),
    );
    await userEvent.click(publish);
    await screen.findByText("Cambios publicados");
    expect(writes()).toHaveLength(2);
  });
});
