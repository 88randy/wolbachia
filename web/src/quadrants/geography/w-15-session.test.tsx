import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { apiError } from "../../test/fake-api";
import { fakePassword } from "../../test/fake-credentials";
import {
  ALLOWED,
  QUADRANT_ID,
  openGeography,
  pageOf,
  point,
  version,
} from "./geography-test-helpers";
vi.mock("./GeographyMap", () => ({ default: () => <div role="region" aria-label="Map" /> }));
const PUBLISH = `POST /api/v1/quadrants/${QUADRANT_ID}/versions/`;
const PUBLISH_NAME = "Publicar nueva versi\u00f3n";
const COORDINATES_NAME = "Pol\u00edgono (longitud, latitud)";
const DRAFT = "0,0\n5,0\n5,5\n0,5\n0,0";
const SELECTED = {
  ...ALLOWED,
  scope: {
    centers: { mode: "selected" as const, ids: ["center-north"] },
    quadrants: { mode: "selected" as const, ids: [QUADRANT_ID] },
  },
};

function deferredReply() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

describe("geography reauthentication", () => {
  test.each(["unchanged scope", "still-permitted scope refresh"])(
    "retains a permitted draft after 401, never replays it, and enables a new manual attempt: %s",
    async (scopeChange) => {
      const validation = deferredReply();
      let hasReauthenticated = false;
      let hasStartedPointRevalidation = false;
      const { api, app } = await openGeography({
        routes: {
          [PUBLISH]: apiError(401, "not_authenticated"),
          "GET /api/v1/sampling-points/": async () => {
            if (!hasReauthenticated) return pageOf([point()]);
            hasStartedPointRevalidation = true;
            return (await validation.promise).clone();
          },
          "POST /api/v1/auth/login/": () => {
            hasReauthenticated = true;
            return Response.json({ me: ALLOWED, server_time: "2026-11-04T12:00:00Z" });
          },
        },
      });
      document.cookie = "csrftoken=test-csrf; path=/";
      const coordinates = await screen.findByRole<HTMLTextAreaElement>("textbox", {
        name: COORDINATES_NAME,
      });
      fireEvent.change(coordinates, { target: { value: DRAFT } });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: PUBLISH_NAME }).hasAttribute("disabled")).toBe(
          false,
        );
      });
      await userEvent.click(screen.getByRole("button", { name: PUBLISH_NAME }));
      fireEvent.change(await screen.findByLabelText("Contrase\u00f1a"), {
        target: { value: fakePassword() },
      });
      await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
      await waitFor(() => {
        expect(screen.queryByLabelText("Contrase\u00f1a")).toBeNull();
        expect(hasStartedPointRevalidation).toBe(true);
      });
      expect(screen.getByRole("button", { name: PUBLISH_NAME }).hasAttribute("disabled")).toBe(
        true,
      );
      if (scopeChange === "still-permitted scope refresh")
        api.setRoute("GET /api/v1/me/", Response.json(SELECTED));
      await act(async () => {
        await app.queryClient.refetchQueries({ queryKey: ["me"] });
      });
      await act(async () => {
        validation.resolve(pageOf([point()]));
        await validation.promise;
      });
      const writes = () =>
        api.requests.filter(({ method, path }) => method === "POST" && path.endsWith("/versions/"));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: PUBLISH_NAME }).hasAttribute("disabled")).toBe(
          false,
        );
        expect(
          screen.getByRole<HTMLTextAreaElement>("textbox", { name: COORDINATES_NAME }).value,
        ).toBe(DRAFT);
      });
      expect(writes()).toHaveLength(1);
      api.setRoute(
        PUBLISH,
        Response.json({ version: version(2), spacing_warnings: [] }, { status: 201 }),
      );
      await userEvent.click(screen.getByRole("button", { name: PUBLISH_NAME }));
      await screen.findByText("Cambios publicados");
      expect(writes()).toHaveLength(2);
      expect(writes()[1]?.body).toMatchObject({
        expected_revision: 1,
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [5, 0],
              [5, 5],
              [0, 5],
              [0, 0],
            ],
          ],
        },
      });
    },
  );
});
