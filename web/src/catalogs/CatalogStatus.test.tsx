import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { expect, test } from "vitest";
import { setupI18n } from "../i18n/setup-i18n";
import { makeCatalogItem } from "../test/catalog-fixtures";
import { CatalogUsage } from "./CatalogUsage";

test.each([
  ["es-MX", "Permanece en los registros anteriores y solo se puede desactivar."],
  ["en", "It stays on older records and can only be deactivated."],
] as const)(
  "%s shows historical usage counts with an accessible explanation",
  async (locale, description) => {
    const instance = await setupI18n(locale);
    const { rerender } = render(
      <I18nextProvider i18n={instance}>
        <CatalogUsage item={makeCatalogItem({ usage_count: 4, in_use: true })} />
      </I18nextProvider>,
    );
    expect(screen.getByText("4").getAttribute("aria-description")).toBe(description);
    rerender(
      <I18nextProvider i18n={instance}>
        <CatalogUsage item={makeCatalogItem({ usage_count: 4, in_use: true, is_active: false })} />
      </I18nextProvider>,
    );
    expect(screen.getByText("4")).toBeDefined();
    rerender(
      <I18nextProvider i18n={instance}>
        <CatalogUsage item={makeCatalogItem()} />
      </I18nextProvider>,
    );
    expect(screen.getByText("0")).toBeDefined();
  },
);
