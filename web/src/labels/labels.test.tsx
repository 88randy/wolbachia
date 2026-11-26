import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import type { LabelRecord } from "./label-record";
import { LabelPrintPanel } from "./LabelPrintPanel";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const RECORDS: LabelRecord[] = [
  {
    kind: "lot",
    id: "0a1b2c3d-0000-4000-8000-0123456789ab",
    code: "L-0001",
    lines: ["Mosquitos Wolbachia", "Caduca 10 nov 2026"],
  },
  {
    kind: "lot",
    id: "0a1b2c3d-0000-4000-8000-0123456789ac",
    code: "L-0002",
    lines: ["Mosquitos Wolbachia"],
  },
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
    await renderWithI18n(<LabelPrintPanel records={RECORDS} />);
    const labels = within(preview(document.body)).getAllByTestId("label");
    expect(labels).toHaveLength(2);
    const first = labels[0] as HTMLElement;
    within(first).getByText("L-0001");
    within(first).getByText("Caduca 10 nov 2026");
    expect(first.querySelector("svg")).not.toBeNull();
    expect(document.body.innerHTML).not.toMatch(UUID);
  });

  it("also renders the print-only copy under body", async () => {
    await renderWithI18n(<LabelPrintPanel records={RECORDS} />);
    const root = screen.getByTestId("label-print-root");
    expect(root.parentElement).toBe(document.body);
    expect(within(root).getAllByTestId("label")).toHaveLength(2);
  });
});

describe("format and copies", () => {
  it("starts on the 50 x 25 roll and offers the three formats", async () => {
    await renderWithI18n(<LabelPrintPanel records={RECORDS} />);
    expect(preview(document.body).dataset["format"]).toBe("thermal50x25");
    await userEvent.click(screen.getByRole("combobox", { name: "Tamaño de etiqueta" }));
    screen.getByRole("option", { name: "Rollo 62 × 29 mm" });
    screen.getByRole("option", { name: /Hoja carta, 30 etiquetas/ });
  });

  it("changes the format, remembers it and starts there next time", async () => {
    const { unmount } = await renderWithI18n(<LabelPrintPanel records={RECORDS} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Tamaño de etiqueta" }));
    await userEvent.click(screen.getByRole("option", { name: "Rollo 62 × 29 mm" }));
    expect(preview(document.body).dataset["format"]).toBe("thermal62x29");
    unmount();
    await renderWithI18n(<LabelPrintPanel records={RECORDS} />);
    expect(preview(document.body).dataset["format"]).toBe("thermal62x29");
  });

  it("repeats every label by the copies and clamps silly values", async () => {
    await renderWithI18n(<LabelPrintPanel records={RECORDS} />);
    const copies = screen.getByLabelText("Copias de cada etiqueta");
    fireEvent.change(copies, { target: { value: "3" } });
    expect(within(preview(document.body)).getAllByTestId("label")).toHaveLength(6);
    fireEvent.change(copies, { target: { value: "-5" } });
    expect(within(preview(document.body)).getAllByTestId("label")).toHaveLength(2);
  });

  it("prints through the browser dialog", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    await renderWithI18n(<LabelPrintPanel records={RECORDS} />);
    await userEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    expect(print).toHaveBeenCalledOnce();
  });
});

describe("live panel", () => {
  it("shows exactly the records it was given", async () => {
    await renderWithI18n(<LabelPrintPanel records={RECORDS} />);
    screen.getByText("Etiquetas distintas: 2 · Etiquetas en total: 2");
  });

  it("follows the records as they change", async () => {
    const { rerender } = await renderWithI18n(<LabelPrintPanel records={RECORDS} />);
    rerender(<LabelPrintPanel records={RECORDS.slice(0, 1)} />);
    expect(within(preview(document.body)).getAllByTestId("label")).toHaveLength(1);
  });

  it("disables Print, with the reason, when nothing is selected", async () => {
    await renderWithI18n(<LabelPrintPanel records={[]} />);
    const button = screen.getByRole("button", { name: "Imprimir" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("title")).toBe("No hay registros para imprimir.");
  });

  it("never shows an id: an ovitrap whose code is an id shows its point", async () => {
    const id = "c92af06e-e99f-5888-b1d5-d8e7bf41d3dc";
    const ovitrap: LabelRecord = {
      kind: "ovitrap",
      id,
      code: id,
      fallbackCode: "Q-MER-01-B1-P4",
      lines: ["Punto Q-MER-01-B1-P4"],
    };
    await renderWithI18n(<LabelPrintPanel records={[ovitrap]} />);
    const label = within(preview(document.body)).getByTestId("label");
    within(label).getByText("Q-MER-01-B1-P4");
    expect(label.textContent).not.toMatch(UUID);
    expect(document.body.textContent).not.toMatch(UUID);
  });
});
