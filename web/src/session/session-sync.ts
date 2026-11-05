/**
 * Tells the other tabs of this browser that the session changed (login accepted, sign-out
 * confirmed, organization switched). All tabs share ONE session cookie, so a tab that does not
 * hear about it keeps showing, and asking for, data under an identity that is no longer the real
 * one (#82). `BroadcastChannel` when the browser has it; otherwise the `storage` event of a
 * `localStorage` write, which browsers deliver to the other tabs only.
 *
 * The message carries no data: the receiver asks `/me/` again and the server says who it is now.
 * This tab uses ONE channel object for sending and receiving, so it never hears its own message.
 */
type Listener = () => void;

const CHANNEL_NAME = "wolbachia.session";
const STORAGE_KEY = "wolbachia.session-changed";

const listeners = new Set<Listener>();
let channel: BroadcastChannel | undefined;

function notify(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

function openChannel(): BroadcastChannel | undefined {
  if (typeof BroadcastChannel === "undefined") return undefined;
  if (channel === undefined) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = notify;
    // Node (tests) keeps its event loop alive for an open channel; browsers have no `unref`.
    (channel as { unref?: () => void }).unref?.();
  }
  return channel;
}

function onStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY) notify();
}

/** Announces a session change to the other tabs. Never throws: storage can be blocked. */
export function broadcastSessionChanged(): void {
  try {
    const open = openChannel();
    if (open) open.postMessage("changed");
    // A new value each time: the event only fires when the value changes.
    else window.localStorage.setItem(STORAGE_KEY, `${String(Date.now())}-${crypto.randomUUID()}`);
  } catch {
    // The other tabs reconcile on focus instead (see use-cross-tab-session.ts).
  }
}

/** Calls `listener` when ANOTHER tab announces a change (never for this tab's own). */
export function subscribeToSessionChanged(listener: Listener): () => void {
  listeners.add(listener);
  if (openChannel() === undefined) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}
