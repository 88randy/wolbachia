import { View } from "react-native";
import { LifecycleCommand } from "./LifecycleCommand.tsx";
import { AvailabilityNotices } from "./AvailabilityNotices.tsx";
import { BeginLifecycle } from "./BeginLifecycle.tsx";
import type { M09Model } from "./use-m-09.ts";
import type { StartInput } from "./new-draft.ts";
export function LifecycleControls({
  model,
  input,
}: {
  readonly model: M09Model;
  readonly input: StartInput;
}) {
  const state = model.state;
  const eventId = state?.draft?.eventId ?? null;
  return (
    <View>
      <LifecycleCommand model={model} eventId={eventId} command="refresh" />
      <BeginLifecycle model={model} input={input} />
      <AvailabilityNotices model={model} />
      {state?.catalogChanged && !state.event ? (
        <LifecycleCommand model={model} eventId={eventId} command="adoptSnapshots" />
      ) : null}
    </View>
  );
}
