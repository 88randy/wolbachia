import { useState } from "react";

import { useServices } from "../../app/services-context.ts";
import type { ServerFeedback } from "./server-feedback.ts";

export interface ServerForm {
  readonly text: string;
  readonly setText: (text: string) => void;
  readonly feedback: ServerFeedback | null;
  /** True while an address saved in Settings overrides the build's (only then can it be reset). */
  readonly hasSavedAddress: boolean;
  readonly save: () => void;
  readonly reset: () => void;
}

/** State and actions of the server-address field. Saving a valid address wakes the sync worker. */
export function useServerForm(): ServerForm {
  const { server, engine } = useServices();
  const [text, setText] = useState(server.savedOverride());
  const [feedback, setFeedback] = useState<ServerFeedback | null>(null);

  const save = async () => {
    const result = await server.save(text);
    setFeedback(result.ok ? "saved" : result.problem);
    if (result.ok) engine.notifyConditionsChanged();
  };
  const reset = async () => {
    await server.clear();
    setText("");
    setFeedback("saved");
    engine.notifyConditionsChanged();
  };

  return {
    text,
    setText,
    feedback,
    // Read on every render: save/clear update the override before the feedback re-renders the form.
    hasSavedAddress: server.savedOverride() !== "",
    save: () =>
      void save().catch(() => {
        setFeedback("storageFailed");
      }),
    reset: () =>
      void reset().catch(() => {
        setFeedback("storageFailed");
      }),
  };
}
