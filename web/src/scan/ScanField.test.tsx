import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import { ScanField } from "./ScanField";

// The real decoder is WebAssembly and needs a camera; the camera path is tested with this double.
const read = vi.hoisted(() => vi.fn<() => Promise<string | null>>());
vi.mock("./decoder", () => ({ loadDecoder: () => Promise.resolve({ read }) }));

const stop = vi.fn();
const applyConstraints = vi.fn().mockResolvedValue(undefined);
const track = { stop, applyConstraints, getCapabilities: () => ({ torch: true }) };
const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
const getUserMedia = vi.fn();

function useCamera(devices: { kind: string }[] = [{ kind: "videoinput" }]) {
  getUserMedia.mockResolvedValue(stream);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia, enumerateDevices: () => Promise.resolve(devices) },
  });
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(4);
});
afterEach(() => {
  vi.restoreAllMocks();
  read.mockReset();
  getUserMedia.mockReset();
  stop.mockClear();
  Reflect.deleteProperty(navigator, "mediaDevices");
});

function Harness({ onScan }: { onScan: (code: string) => void }) {
  const [value, setValue] = useState("");
  return <ScanField id="scan" label="Código" value={value} onChange={setValue} onScan={onScan} />;
}

test("typing a code and pressing Enter scans the typed code (keyboard-wedge scanners do this)", async () => {
  const onScan = vi.fn();
  await renderWithI18n(<Harness onScan={onScan} />);
  await userEvent.type(screen.getByLabelText("Código"), "B-4471{Enter}");
  expect(onScan).toHaveBeenCalledExactlyOnceWith("B-4471");
});

test("without a camera API there is no camera button", async () => {
  await renderWithI18n(<Harness onScan={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Escanear con la cámara" })).toBeNull();
});

test("a device with no video input hides the camera button", async () => {
  useCamera([{ kind: "audioinput" }]);
  await renderWithI18n(<Harness onScan={vi.fn()} />);
  await waitFor(() => {
    expect(screen.queryByRole("button", { name: "Escanear con la cámara" })).toBeNull();
  });
});

test("a camera read fills the field, scans it, announces it and releases the camera", async () => {
  useCamera();
  read.mockResolvedValueOnce(null).mockResolvedValueOnce("LOT-0042");
  const onScan = vi.fn();
  await renderWithI18n(<Harness onScan={onScan} />);
  await userEvent.click(await screen.findByRole("button", { name: "Escanear con la cámara" }));
  await waitFor(() => {
    expect(onScan).toHaveBeenCalledExactlyOnceWith("LOT-0042");
  });
  expect((screen.getByLabelText("Código") as HTMLInputElement).value).toBe("LOT-0042");
  expect(screen.getByRole("status").textContent).toBe("Código leído: LOT-0042");
  expect(getUserMedia).toHaveBeenCalledWith(
    expect.objectContaining({
      video: expect.objectContaining({ facingMode: { ideal: "environment" } }),
    }),
  );
  expect(stop).toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("a denied permission says so and Try again opens the camera again", async () => {
  useCamera();
  getUserMedia.mockRejectedValueOnce(new DOMException("no", "NotAllowedError"));
  const onScan = vi.fn();
  await renderWithI18n(<Harness onScan={onScan} />);
  await userEvent.click(await screen.findByRole("button", { name: "Escanear con la cámara" }));
  expect(await screen.findByText(/No tenemos permiso para usar la cámara/)).toBeTruthy();
  getUserMedia.mockResolvedValue(stream);
  read.mockResolvedValue("EAN-1");
  await userEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));
  await waitFor(() => {
    expect(onScan).toHaveBeenCalledExactlyOnceWith("EAN-1");
  });
});

test("the torch toggle appears when the camera has a light and Escape closes the dialog", async () => {
  useCamera();
  read.mockResolvedValue(null);
  await renderWithI18n(<Harness onScan={vi.fn()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Escanear con la cámara" }));
  const torch = await screen.findByRole("button", { name: "Encender la luz" });
  await userEvent.click(torch);
  expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
  expect(await screen.findByRole("button", { name: "Apagar la luz" })).toBeTruthy();
  const dialog = screen.getByRole("dialog");
  dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  expect(stop).toHaveBeenCalled();
});

function Expecting({ onScan }: { onScan: (code: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <ScanField
      id="scan"
      label="Código"
      value={value}
      expects="lot"
      onChange={setValue}
      onScan={onScan}
    />
  );
}

test("a printed label with a human code scans as that code", async () => {
  const onScan = vi.fn();
  await renderWithI18n(<Expecting onScan={onScan} />);
  await userEvent.type(screen.getByLabelText("Código"), "wbf:1:lot:L-0001{Enter}");
  await waitFor(() => {
    expect(onScan).toHaveBeenCalledExactlyOnceWith("L-0001");
  });
  expect((screen.getByLabelText("Código") as HTMLInputElement).value).toBe("L-0001");
});

test("a label of another kind is refused in plain words", async () => {
  const onScan = vi.fn();
  await renderWithI18n(<Expecting onScan={onScan} />);
  await userEvent.type(screen.getByLabelText("Código"), "wbf:1:motorcycle:M-1{Enter}");
  expect(await screen.findByText("Esta etiqueta es de una moto, no de un lote.")).toBeTruthy();
  expect(onScan).not.toHaveBeenCalled();
});
