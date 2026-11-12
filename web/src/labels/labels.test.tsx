import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import type { LabelRecord } from "./label-record";
import { PrintLabelsButton } from "./PrintLabelsButton";
import { PrintLabelsDialog } from "./PrintLabelsDialog";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const RECORDS: LabelRecord[] = [
  { code: "L-0001", lines: ["Mosquitos Wolbachia", "Caduca 10 nov 2026"] },
  { code: "L-0002", lines: ["Mosquitos Wolbachia"] },
];

function preview(container: HTMLElement) {
  const sheet = container.ownerDocument.querySelector('[data-mode="preview"]');
  if (sheet === null) throw new Error("no preview");
  return sheet as HTMLElement;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("label rendering", () => {
  it("draws each label with its code, a QR svg and its context lines, and no ids", async () => {
    await renderWithI18n(
      <PrintLabelsDialog records={RECORDS} open onOpenChange={() => undefined} />,
    );
    const labels = within(preview(document.body)).getAllByTestId("label");
    expect(labels).toHaveLength(2);
    const first = labels[0] as HTMLElement;
    within(first).getByText("L-0001");
    within(first).getByText("Caduca 10 nov 2026");
    expect(first.querySelector("svg")).not.toBeNull();
    expect(document.body.innerHTML).not.toMatch(UUID);
  });

  it("also renders the print-only copy under body", async () => {
    await renderWithI18n(
      <PrintLabelsDialog records={RECORDS} open onOpenChange={() => undefined} />,
    );
    const root = screen.getByTestId("label-print-root");
    expect(root.parentElement).toBe(document.body);
    expect(within(root).getAllByTestId("label")).toHaveLength(2);
  });
});

describe("format and copies", () => {
  it("starts on the 50 x 25 roll and offers the three formats", async () => {
    await renderWithI18n(
      <PrintLabelsDialog records={RECORDS} open onOpenChange={() => undefined} />,
    );
    expect(preview(document.body).dataset["format"]).toBe("thermal50x25");
    await userEvent.click(screen.getByRole("combobox", { name: "Tamaño de etiqueta" }));
    screen.getByRole("option", { name: "Rollo 62 × 29 mm" });
    screen.getByRole("option", { name: /Hoja carta, 30 etiquetas/ });
  });

  it("changes the format, remembers it and starts there next time", async () => {
    const { unmount } = await renderWithI18n(
      <PrintLabelsDialog records={RECORDS} open onOpenChange={() => undefined} />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Tamaño de etiqueta" }));
    await userEvent.click(screen.getByRole("option", { name: "Rollo 62 × 29 mm" }));
    expect(preview(document.body).dataset["format"]).toBe("thermal62x29");
    unmount();
    await renderWithI18n(
      <PrintLabelsDialog records={RECORDS} open onOpenChange={() => undefined} />,
    );
    expect(preview(document.body).dataset["format"]).toBe("thermal62x29");
  });

  it("repeats every label by the copies and clamps silly values", async () => {
    await renderWithI18n(
      <PrintLabelsDialog records={RECORDS} open onOpenChange={() => undefined} />,
    );
    const copies = screen.getByLabelText("Copias de cada etiqueta");
    fireEvent.change(copies, { target: { value: "3" } });
    expect(within(preview(document.body)).getAllByTestId("label")).toHaveLength(6);
    fireEvent.change(copies, { target: { value: "-5" } });
    expect(within(preview(document.body)).getAllByTestId("label")).toHaveLength(2);
  });

  it("prints through the browser dialog", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    await renderWithI18n(
      <PrintLabelsDialog records={RECORDS} open onOpenChange={() => undefined} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    expect(print).toHaveBeenCalledOnce();
  });
});

describe("bulk selection", () => {
  it("opens with exactly the records it was given", async () => {
    await renderWithI18n(
      <PrintLabelsButton records={RECORDS} labelKey="labels.action.printSelected" />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Imprimir etiquetas de lo marcado" }));
    screen.getByText("Etiquetas distintas: 2 · Etiquetas en total: 2");
  });

  it("is disabled, with the reason, when nothing is selected", async () => {
    await renderWithI18n(<PrintLabelsButton records={[]} />);
    const button = screen.getByRole("button", { name: "Imprimir etiquetas" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("title")).toBe("No hay registros para imprimir.");
  });
});
