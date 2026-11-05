import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { apiError, makeMe } from "../test/fake-api";
import { GET, LIST, motorcycle, openFleet, pageOf } from "./fleet-test-helpers";
const VOID = `POST /api/v1/motorcycles/${motorcycle().id}/void/`;
const REASON = "Wrong registration confirmed";

describe("fleet action boundaries", () => {
  test("read permission does not expose void or unblock controls", async () => {
    await openFleet({ path: `${LIST}/M-03`, me: makeMe({ permissions: ["motorcycle.read"] }) });
    await screen.findByRole("heading", { name: "M-03" });
    expect(screen.queryByRole("button", { name: "Anular" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desbloquear" })).toBeNull();
  });
  test.each([false, true])(
    "state-blocked actions have a visible description: voided=%s",
    async (isVoided) => {
      const item = motorcycle({
        is_blocked: false,
        blocked_reason: "",
        voided_at: isVoided ? "2026-10-02T12:00:00Z" : null,
      });
      await openFleet({ path: `${LIST}/M-03`, routes: { [GET]: pageOf([item]) } });
      const button = await screen.findByRole("button", { name: "Desbloquear" });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      const description = document.getElementById(button.getAttribute("aria-describedby") ?? "");
      expect(description?.textContent).toContain(isVoided ? "está anulada" : "no está bloqueada");
      await userEvent.click(button);
      expect(screen.queryByRole("dialog")).toBeNull();
      if (isVoided)
        expect(screen.getByRole("button", { name: "Anular" }).getAttribute("aria-disabled")).toBe(
          "true",
        );
    },
  );
  test.each([false, true])(
    "void success or concurrent already_voided refreshes the record: concurrent=%s",
    async (isConcurrent) => {
      let item = motorcycle();
      await openFleet({
        path: `${LIST}/M-03`,
        routes: {
          [GET]: () => pageOf([item]),
          [VOID]: () => {
            item = motorcycle({ voided_at: "2026-10-02T12:00:00Z", void_reason: REASON });
            return isConcurrent ? apiError(409, "already_voided") : Response.json(item);
          },
        },
      });
      await userEvent.click(await screen.findByRole("button", { name: "Anular" }));
      await userEvent.type(screen.getByRole("textbox"), REASON);
      await userEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Anular" }),
      );
      await screen.findByText("Anulada");
      if (isConcurrent) {
        expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(REASON);
        expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toContain(
          "ya anuló",
        );
      } else expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByText("Disponible")).toBeNull();
    },
  );
  test("local unblock wording does not change the next void dialog", async () => {
    await openFleet({ path: `${LIST}/M-03` });
    await userEvent.click(await screen.findByRole("button", { name: "Desbloquear" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Anular" }));
    expect(screen.getByRole("dialog", { name: "Anular M-03" })).toBeDefined();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Anular" }),
    ).toBeDefined();
    expect(screen.queryByText("Motivo y evidencia")).toBeNull();
  });
  test("create success refreshes the list and announces the saved motorcycle", async () => {
    let created = false;
    await openFleet({
      routes: {
        [GET]: () => pageOf(created ? [motorcycle({ code: "M-NEW" })] : []),
        "POST /api/v1/motorcycles/": () => {
          created = true;
          return Response.json(motorcycle({ code: "M-NEW" }), { status: 201 });
        },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Alta de moto" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Código" }), "M-NEW");
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Guardar" }),
    );
    await screen.findByRole("link", { name: "M-NEW" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByText("Cambio guardado.").getAttribute("role")).toBe("status");
  });
});
