import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** Accessible name of the header center filter (a Select that shows the center names only). */
export const CENTER_PICKER = "Centro";

export function centerPicker() {
  return screen.findByRole("combobox", { name: CENTER_PICKER });
}

/** Opens the header center filter and picks a center by its name. */
export async function chooseCenter(name: string) {
  await userEvent.click(await centerPicker());
  await userEvent.click(await screen.findByRole("option", { name }));
}
