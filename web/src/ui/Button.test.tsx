import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Button } from "./Button";
test.each([true, "true"] as const)(
  "focusable blocked action preserves aria-disabled=%s and refuses activation",
  (disabled) => {
    const onClick = vi.fn();
    render(
      <Button aria-disabled={disabled} onClick={onClick}>
        Publish
      </Button>,
    );
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Publish" });
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  },
);
test("an explicit false state stays actionable", () => {
  const onClick = vi.fn();
  render(
    <Button aria-disabled={false} onClick={onClick}>
      Review
    </Button>,
  );
  const button = screen.getByRole("button", { name: "Review" });
  expect(button.getAttribute("aria-disabled")).toBe("false");
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
});
