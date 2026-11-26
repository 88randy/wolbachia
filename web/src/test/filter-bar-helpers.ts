import { screen } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

type User = ReturnType<typeof userEvent.setup>;

/** Opens the "Filtros" popover of the list filter bar (its button also shows the active count). */
export async function openFilterPanel(user: User) {
  await user.click(screen.getByRole("button", { name: /^Filtros/ }));
}

/** Picks an option of a dropdown that lives in the "Filtros" popover. */
export async function pickFilterOption(user: User, name: string, option: string) {
  await openFilterPanel(user);
  await user.click(await screen.findByRole("combobox", { name }));
  await user.click(await screen.findByRole("option", { name: option }));
}
