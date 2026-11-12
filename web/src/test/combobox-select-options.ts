import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The app's dropdown is the Combobox (a button that opens a searchable list), not a native
 * <select>. Existing tests keep saying `selectOptions(picker, value)`: for a native <select> that
 * is Testing Library's own call; for a Combobox it opens the list and clicks the option whose
 * visible label or value matches. Installed once from `setup.ts`.
 */
type SelectOptions = (element: Element, values: unknown) => Promise<void>;
type Clicker = { click: (element: Element) => Promise<void> };

async function pickFromCombobox(user: Clicker, picker: Element, wanted: unknown) {
  const values = (Array.isArray(wanted) ? wanted : [wanted]).map(String);
  for (const value of values) {
    await user.click(picker);
    const options = await screen.findAllByRole("option");
    const match = options.find(
      (option) =>
        option.textContent === value ||
        (option.getAttribute("data-value") ?? "").toLowerCase().endsWith(` ${value.toLowerCase()}`),
    );
    if (match === undefined) throw new Error(`Value "${value}" not found in the dropdown options`);
    await user.click(match);
  }
}

function patch(target: Clicker & { selectOptions: unknown }) {
  const original = target.selectOptions as SelectOptions;
  target.selectOptions = (element: Element, values: unknown) =>
    element instanceof HTMLSelectElement
      ? original.call(target, element, values)
      : pickFromCombobox(target, element, values);
}

export function installComboboxSelectOptions() {
  const originalSetup = userEvent.setup.bind(userEvent);
  (userEvent as { setup: typeof userEvent.setup }).setup = (...args) => {
    const user = originalSetup(...args);
    patch(user as unknown as Clicker & { selectOptions: unknown });
    return user;
  };
  patch(userEvent as unknown as Clicker & { selectOptions: unknown });
}
