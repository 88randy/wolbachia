import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, test } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import { ConfigErrorScreen } from "./ConfigErrorScreen";

describe("ConfigErrorScreen", () => {
  test("explains the problem in Spanish with a next step", async () => {
    await renderWithI18n(<ConfigErrorScreen />);

    expect(screen.getByRole("heading", { name: "La aplicación no está lista" })).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain("Avisa a soporte técnico");
  });

  test("is translated to English", async () => {
    await renderWithI18n(<ConfigErrorScreen />, "en");

    expect(screen.getByRole("heading", { name: "The app is not ready" })).toBeDefined();
  });

  test("has no accessibility violations", async () => {
    const { container } = await renderWithI18n(<ConfigErrorScreen />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
