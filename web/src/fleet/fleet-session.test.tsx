import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { makeMe, makeOrganization, apiError } from "../test/fake-api";
import { fakePassword } from "../test/fake-credentials";
import {
  ALLOWED,
  GET,
  LIST,
  motorcycle,
  openFleet,
  otherReasonField,
  pageOf,
} from "./fleet-test-helpers";

function deferred() {
  let release: (reply: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("fleet session isolation", () => {
  test.each(["user", "organization"])(
    "a changed %s clears rows and ignores the previous pending read",
    async (context) => {
      const late = deferred();
      let reads = 0;
      const { api, app } = await openFleet({
        routes: {
          [GET]: () =>
            ++reads === 2
              ? late.promise
              : pageOf([motorcycle({ code: reads === 1 ? "OLD-PRIVATE" : "NEW-SCOPED" })]),
        },
      });
      await screen.findByRole("link", { name: "OLD-PRIVATE" });
      let refresh: Promise<void> = Promise.resolve();
      act(() => {
        refresh = app.queryClient.refetchQueries({
          predicate: (query) => query.queryKey[3] === "fleet",
        });
      });
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      const next =
        context === "user"
          ? { ...ALLOWED, user: { ...ALLOWED.user, id: "another-user" } }
          : { ...ALLOWED, organization: makeOrganization("sur", "South") };
      api.setRoute("GET /api/v1/me/", Response.json(next));
      await act(async () => {
        await app.queryClient.refetchQueries({ queryKey: ["me"] });
      });
      await screen.findByRole("link", { name: "NEW-SCOPED" });
      expect(screen.queryByText("OLD-PRIVATE")).toBeNull();
      await act(async () => {
        late.release(pageOf([motorcycle({ code: "LATE-PRIVATE" })]));
        await refresh;
      });
      expect(screen.queryByText("LATE-PRIVATE")).toBeNull();
      expect(screen.getByRole("link", { name: "NEW-SCOPED" })).toBeDefined();
    },
  );

  test("an identity change dismisses a draft and ignores a pending write", async () => {
    const late = deferred();
    const { api, app } = await openFleet({
      path: `${LIST}/M-03`,
      routes: { [`POST /api/v1/motorcycles/${motorcycle().id}/unblock/`]: () => late.promise },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Desbloquear" }));
    await userEvent.type(await otherReasonField(), "Private inspection evidence");
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Desbloquear" }),
    );
    const next = makeMe({
      permissions: ["motorcycle.read"],
      user: { ...ALLOWED.user, id: "another-user" },
    });
    api.setRoute("GET /api/v1/me/", Response.json(next));
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    const readsBeforeLateWrite = api.requests.filter(
      ({ method, path }) => method === "GET" && path.startsWith("/api/v1/motorcycles/"),
    ).length;
    await act(async () => {
      late.release(apiError(401, "not_authenticated"));
      await late.promise;
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      api.requests.filter(
        ({ method, path }) => method === "GET" && path.startsWith("/api/v1/motorcycles/"),
      ),
    ).toHaveLength(readsBeforeLateWrite);
    expect(screen.queryByText("Private inspection evidence")).toBeNull();
  });

  test("an expired write is never replayed after successful reauthentication", async () => {
    const { api, app } = await openFleet({
      path: `${LIST}/M-03`,
      routes: {
        [`POST /api/v1/motorcycles/${motorcycle().id}/unblock/`]: apiError(
          401,
          "not_authenticated",
        ),
        "POST /api/v1/auth/login/": Response.json({
          me: ALLOWED,
          server_time: "2026-11-04T12:00:00Z",
        }),
      },
    });
    document.cookie = "csrftoken=test-csrf; path=/";
    await userEvent.click(await screen.findByRole("button", { name: "Desbloquear" }));
    await userEvent.type(await otherReasonField(), "Repair checked and recorded");
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Desbloquear" }),
    );
    const password = await screen.findByLabelText("Contraseña");
    await userEvent.type(password, fakePassword());
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => {
      expect(screen.queryByLabelText("Contraseña")).toBeNull();
    });
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    expect(
      api.requests.filter(({ method, path }) => method === "POST" && path.endsWith("/unblock/")),
    ).toHaveLength(1);
  });
});
