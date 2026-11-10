import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import { PermitDocumentPicker } from "./PermitDocumentPicker";

function isBlocked(button: HTMLElement) {
  return button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true";
}

test("offers PDF, JPEG and PNG and shows name and size before upload", async () => {
  const onSelect = vi.fn();
  const file = new File([new Uint8Array(2048)], "permiso.pdf", { type: "application/pdf" });
  await renderWithI18n(
    <PermitDocumentPicker file={file} isBusy={false} onSelect={onSelect} onUpload={vi.fn()} />,
  );
  const input = screen.getByLabelText("Documento oficial del permiso");
  expect(input.getAttribute("accept")).toBe("application/pdf,image/jpeg,image/png");
  expect(screen.getByText(/permiso\.pdf \(2 KiB\)/)).toBeTruthy();
  await userEvent.upload(input, file);
  expect(onSelect).toHaveBeenCalledWith(file);
});

test("blocks an unsupported file client-side and keeps a backend error retryable", async () => {
  const bad = new File(["x"], "a.gif", { type: "image/gif" });
  const view = await renderWithI18n(
    <PermitDocumentPicker file={bad} isBusy={false} onSelect={vi.fn()} onUpload={vi.fn()} />,
  );
  expect(screen.getByText("Solo se aceptan archivos PDF, JPEG o PNG.")).toBeTruthy();
  expect(isBlocked(screen.getByRole("button", { name: "Cargar documento" }))).toBe(true);
  view.unmount();
  const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });
  await renderWithI18n(
    <PermitDocumentPicker
      file={pdf}
      uploadError="El PDF está protegido con contraseña."
      isBusy={false}
      onSelect={vi.fn()}
      onUpload={vi.fn()}
    />,
  );
  expect(isBlocked(screen.getByRole("button", { name: "Reintentar carga" }))).toBe(false);
});
