import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { expect, test } from "vitest";
import { setupI18n } from "../i18n/setup-i18n";
import { AnnotationHelpDialog } from "./AnnotationHelpDialog";

test("walks the three-step guide, opens a separate shortcut table and remembers dismissal", async () => {
  const i18n = await setupI18n("es-MX");
  const user = userEvent.setup();
  const preferenceKey = "aedesvision:annotation-tips:guide-test";
  localStorage.removeItem(preferenceKey);
  const rendered = render(
    <I18nextProvider i18n={i18n}>
      <AnnotationHelpDialog userId="guide-test" open={false} onOpenChange={() => undefined} />
    </I18nextProvider>,
  );
  expect(screen.getByRole("heading", { name: "Reconoce los huevos" })).toBeDefined();
  expect(
    screen.getByRole("img", { name: i18n.t("labAnnotation.tips.illustration") }),
  ).toBeDefined();
  expect(screen.getByRole("button", { name: "Anterior" }).getAttribute("aria-disabled")).toBe(
    "true",
  );
  await user.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.getByRole("heading", { name: "Cajas o puntos" })).toBeDefined();
  expect(
    screen.getByRole("list", { name: "Pasos de la guía" }).querySelector('[aria-current="step"]')
      ?.textContent,
  ).toBe("Cajas o puntos");
  await user.click(screen.getByRole("button", { name: "Ver atajos" }));
  const shortcuts = screen.getByRole("dialog", { name: "Atajos" });
  expect(
    within(shortcuts).getByRole("table", { name: "Atajos" }).querySelectorAll("kbd"),
  ).toHaveLength(18);
  await user.click(within(shortcuts).getByText("Cerrar", { selector: "button span" }));
  expect(screen.getByRole("heading", { name: "Cajas o puntos" })).toBeDefined();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ver atajos" }));
  await user.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.getByRole("heading", { name: "Método" })).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Anterior" }));
  expect(screen.getByRole("heading", { name: "Cajas o puntos" })).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Siguiente" }));
  await user.click(screen.getByRole("button", { name: "Entendido" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(localStorage.getItem(preferenceKey)).toBe("seen");
  rendered.rerender(
    <I18nextProvider i18n={i18n}>
      <AnnotationHelpDialog userId="guide-test" open={true} onOpenChange={() => undefined} />
    </I18nextProvider>,
  );
  expect(screen.getByRole("dialog", { name: i18n.t("labAnnotation.tips.title") })).toBeDefined();
  expect(screen.getByRole("button", { name: "Omitir" })).toBeDefined();
  localStorage.removeItem(preferenceKey);
});
