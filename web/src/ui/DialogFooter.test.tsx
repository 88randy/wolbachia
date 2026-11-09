import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import { CatalogDialogActions } from "../catalogs/CatalogDialogActions";
/** Footer wiring must keep Cancel before Save and block both callbacks throughout a write. */
test("dialog footer pairs secondary Cancel with primary Save and blocks repeated actions while busy", async () => {
  const cancel = vi.fn();
  const confirm = vi.fn();
  const user = userEvent.setup();
  const view = await renderWithI18n(
    <CatalogDialogActions
      isBusy={false}
      onCancel={cancel}
      onConfirm={confirm}
      confirmKey="common.actions.save"
    />,
  );
  const buttons = screen.getAllByRole("button");
  expect(buttons.map((button) => button.textContent)).toEqual(["Cancelar", "Guardar"]);
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(cancel).toHaveBeenCalledOnce();
  view.rerender(
    <CatalogDialogActions
      isBusy
      onCancel={cancel}
      onConfirm={confirm}
      confirmKey="common.actions.save"
    />,
  );
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  await user.click(screen.getByRole("button", { name: "Guardando…" }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(confirm).not.toHaveBeenCalled();
});
