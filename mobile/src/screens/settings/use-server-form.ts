import { useState } from "react";

import { useServices } from "../../app/services-context.ts";
import type { ServerFeedback } from "./server-feedback.ts";

export interface ServerForm {
  readonly text: string;
  readonly setText: (text: string) => void;
  readonly feedback: ServerFeedback | null;
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
    const result = await server.clear();
    if (!result.ok) {
      setFeedback(result.problem);
      return;
    }
    setText("");
    setFeedback("saved");
    engine.notifyConditionsChanged();
  };

  const reportStorageFailure = () => {
    setFeedback("storageFailed");
  };
  return {
    text,
    setText,
    feedback,
    save: () => void save().catch(reportStorageFailure),
    reset: () => void reset().catch(reportStorageFailure),
  };
}
