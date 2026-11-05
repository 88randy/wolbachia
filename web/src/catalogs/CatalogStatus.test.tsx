import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { expect, test } from "vitest";
import { setupI18n } from "../i18n/setup-i18n";
import { makeCatalogItem } from "../test/catalog-fixtures";
import { CatalogStatus } from "./CatalogStatus";

test.each([
  ["es-MX", "En uso", "Permanece en los registros anteriores y solo se puede desactivar."],
  ["en", "In use", "It stays on older records and can only be deactivated."],
] as const)(
  "%s shows usage independently of availability with an accessible explanation",
  async (locale, label, description) => {
    const instance = await setupI18n(locale);
    const { rerender } = render(
      <I18nextProvider i18n={instance}>
        <CatalogStatus item={makeCatalogItem({ in_use: true })} />
      </I18nextProvider>,
    );
    const badge = screen.getByText(label);
    expect(badge.getAttribute("aria-description")).toBe(description);
    expect(badge.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    rerender(
      <I18nextProvider i18n={instance}>
        <CatalogStatus item={makeCatalogItem({ in_use: true, is_active: false })} />
      </I18nextProvider>,
    );
    expect(screen.getByText(label)).not.toBeNull();
    rerender(
      <I18nextProvider i18n={instance}>
        <CatalogStatus item={makeCatalogItem()} />
      </I18nextProvider>,
    );
    expect(screen.queryByText(label)).toBeNull();
  },
);
