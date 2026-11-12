import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { apiError } from "../test/fake-api";
import { simulateSignOut } from "../test/simulate-session";
import { BAG, candidate, openCount, outcome, pageOf } from "./count-test-helpers";

beforeEach(() => {
  window.sessionStorage.clear();
});

test("a confirmed high count replays the complete command after a lost response", async () => {
  let attempts = 0;
  const { api } = await openCount({
    routes: {
      [`POST /api/v1/bags/${BAG}/counts/`]: () => {
        attempts += 1;
        if (attempts === 1) return apiError(409, "lab_confirmation_required");
        if (attempts === 2) throw new TypeError("Synthetic lost confirmed reply");
        return outcome();
      },
    },
  });
  await userEvent.type(
    await screen.findByRole("textbox", { name: "¿Cuántos huevos contaste?" }),
    "1200{Enter}",
  );
  await screen.findByRole("button", { name: "Confirmar conteo alto" });
  await userEvent.keyboard("{Enter}");
  expect(attempts).toBe(1);
  await userEvent.click(screen.getByRole("button", { name: "Confirmar conteo alto" }));
  await userEvent.click(await screen.findByRole("button", { name: "Reintentar guardado" }));
  await screen.findByText("Conteo guardado.");
  const posts = api.requests.filter((request) => request.method === "POST");
  expect(posts).toHaveLength(3);
  expect(posts[1]?.body).toEqual(posts[2]?.body);
  expect(posts[2]?.body).toMatchObject({ value: 1200, confirmed_implausible: true });
});

test("background queue changes do not move the active numeric draft", async () => {
  const { api, app } = await openCount();
  await userEvent.type(await screen.findByRole("textbox", { name: "¿Cuántos huevos contaste?" }), "12");
  api.setRoute("GET /api/v1/egg-counts/queue/", pageOf([{ ...candidate("B-032"), id: "bag-32" }]));
  await act(async () => {
    await app.queryClient.invalidateQueries({
      predicate: (query) => query.queryKey.includes("lab"),
    });
  });
  expect(screen.getByRole("heading", { name: "B-031" })).toBeDefined();
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "¿Cuántos huevos contaste?" }).value,
  ).toBe("12");
});

test("a count response from a departed session cannot advance the queue", async () => {
  let release!: (reply: Response) => void;
  const held = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const { api } = await openCount({ routes: { [`POST /api/v1/bags/${BAG}/counts/`]: () => held } });
  await userEvent.type(
    await screen.findByRole("textbox", { name: "¿Cuántos huevos contaste?" }),
    "12{Enter}",
  );
  await waitFor(() => {
    expect(api.requests.some((request) => request.method === "POST")).toBe(true);
  });
  await act(async () => {
    simulateSignOut();
    release(outcome({ ...candidate("B-032"), id: "bag-32" }));
    await held;
  });
  expect(screen.queryByRole("heading", { name: "B-032" })).toBeNull();
  expect(screen.queryByText("Conteo guardado.")).toBeNull();
});
