import type { MessageKey } from "@wolbachia/i18n";
type Subscribe = (listener: () => void) => () => void;
interface Input {
  readonly subscriptions: readonly Subscribe[];
  readonly refresh: () => Promise<void>;
  readonly invalidate: () => void;
  readonly setError: (key: MessageKey | null) => void;
}
/** Engine and shift notifications use the same fallible store refresh as foreground commands. */
export function observeCaptureUpdates(input: Input): () => void {
  const update = () => {
    void input.refresh().catch(() => {
      input.setError("mobile.storage.actionFailed");
    });
  };
  update();
  const unsubscribes = input.subscriptions.map((subscribe) => subscribe(update));
  return () => {
    input.invalidate();
    unsubscribes.forEach((unsubscribe) => {
      unsubscribe();
    });
  };
}
