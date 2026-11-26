import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import { FileField } from "./FileField";

test("shows the catalog's button text and the chosen file name", async () => {
  const onChange = vi.fn();
  const file = new File(["x"], "permiso.pdf", { type: "application/pdf" });
  await renderWithI18n(
    <FileField id="f" label="Documento" accept="application/pdf" onChange={onChange} />,
  );
  expect(screen.getByRole("button", { name: "Elegir archivo" })).toBeTruthy();
  expect(screen.getByText("Ningún archivo seleccionado")).toBeTruthy();
  await userEvent.upload(screen.getByLabelText("Documento"), file);
  expect(onChange).toHaveBeenCalledTimes(1);
});
