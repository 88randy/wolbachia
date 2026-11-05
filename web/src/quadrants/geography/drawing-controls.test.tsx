import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { expect, test, vi } from "vitest";
import { setupI18n } from "../../i18n/setup-i18n";
import { DrawingControls } from "./DrawingControls";
import { appendMapVertex } from "./map-drawing";
test.each(["", "\n\n1,1\n2,1\n1,2\n1,1"])(
  "adding then undoing an exterior vertex restores the exact polygon with holes %j",
  async (holes) => {
    const original = "0,0\n4,0\n4,4\n0,4\n0,0" + holes;
    const onText = vi.fn();
    const i18n = await setupI18n("en");
    render(
      <I18nextProvider i18n={i18n}>
        <DrawingControls
          text={appendMapVertex(original, [-1, 2])}
          onText={onText}
          isDrawing
          onDrawing={vi.fn()}
        />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo last vertex" }));
    expect(onText).toHaveBeenCalledWith(original);
  },
);
