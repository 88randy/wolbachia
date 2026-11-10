import { useState } from "react";
import { VoidDialog } from "../../void/VoidDialog";
import { useVoidLimits } from "../../void/use-void-limits";
import type { ReviewActionsProps } from "./ReviewActions";

export function ReviewVoid(props: ReviewActionsProps & { onClose: () => void }) {
  const limits = useVoidLimits();
  const [reviewed] = useState(props.frame);
  return (
    <VoidDialog
      record={props.record}
      limits={limits}
      onCancel={props.onClose}
      onVoided={props.onClose}
      submit={async (choice) => {
        if (props.isBlocked || reviewed !== props.frame)
          return { ok: false, failure: { kind: "blocked" } };
        const ok = await props.send("void", `${choice.reasonCode}: ${choice.reason}`);
        return ok ? { ok: true } : { ok: false, failure: { kind: "blocked" } };
      }}
    />
  );
}
