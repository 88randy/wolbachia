import { afterEach, describe, expect, test, vi } from "vitest";
import { broadcastSessionChanged, subscribeToSessionChanged } from "./session-sync";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("BroadcastChannel transport", () => {
  test("another tab's announcement reaches the listener, this tab's own does not", async () => {
    const heard = vi.fn();
    const unsubscribe = subscribeToSessionChanged(heard);

    broadcastSessionChanged();
    const otherTab = new BroadcastChannel("wolbachia.session");
    otherTab.postMessage("changed");
    otherTab.close();

    await vi.waitFor(() => {
      expect(heard).toHaveBeenCalledOnce();
    });
    unsubscribe();
  });

  test("after unsubscribing nothing is heard", async () => {
    const heard = vi.fn();
    subscribeToSessionChanged(heard)();
    const otherTab = new BroadcastChannel("wolbachia.session");

    otherTab.postMessage("changed");
    otherTab.close();
    await new Promise<void>((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        resolve();
      };
      channel.port2.postMessage(0);
    });

    expect(heard).not.toHaveBeenCalled();
  });
});

describe("storage-event fallback (no BroadcastChannel)", () => {
  test("announcing writes a fresh value each time, and the other tab's event is heard", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const heard = vi.fn();
    const unsubscribe = subscribeToSessionChanged(heard);

    broadcastSessionChanged();
    const first = window.localStorage.getItem("wolbachia.session-changed");
    broadcastSessionChanged();
    const second = window.localStorage.getItem("wolbachia.session-changed");
    window.dispatchEvent(new StorageEvent("storage", { key: "wolbachia.session-changed" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "something.else" }));

    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
    expect(heard).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
