import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import { VoidedDetail } from "./VoidedDetail";

describe("VoidedDetail", () => {
  test("shows the date only when the screen gives one", async () => {
    const { rerender } = await renderWithI18n(
      <VoidedDetail info={{ reason: "Folio duplicado", author: "Marco" }} />,
    );
    expect(screen.queryByText(/Fecha:/)).toBeNull();

    rerender(
      <VoidedDetail info={{ reason: "Folio duplicado", author: "Marco", when: "12 sep 2026" }} />,
    );

    expect(screen.getByText("Fecha: 12 sep 2026")).toBeTruthy();
  });
});
