import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { apiError } from "../test/fake-api";
import { openFleet } from "./fleet-test-helpers";

test("duplicate motorcycle codes are field errors and keep the create draft", async () => {
  const { api } = await openFleet({
    routes: {
      "POST /api/v1/motorcycles/": apiError(400, "validation_error", {
        fields: { code: [{ code: "duplicate_code" }] },
      }),
    },
  });
  await userEvent.click(await screen.findByRole("button", { name: "Alta de moto" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Código" }), "M-03");
  await userEvent.type(screen.getByRole("textbox", { name: "Placa" }), "TEST-03");
  await userEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Guardar" }),
  );
  await waitFor(() => {
    expect(screen.getByRole("textbox", { name: "Código" }).getAttribute("aria-invalid")).toBe(
      "true",
    );
  });
  expect(
    screen.getByText("Ese código ya está registrado. Usa otro código e inténtalo de nuevo."),
  ).toBeDefined();
  const code = screen.getByRole<HTMLInputElement>("textbox", { name: "Código" });
  expect(code.value).toBe("M-03");
  expect(document.activeElement).toBe(code);
  expect(api.requests.find(({ method }) => method === "POST")?.body).toEqual({
    code: "M-03",
    plate: "TEST-03",
  });
});
