import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import type { MessageKey } from "@wolbachia/i18n";
import { useFocusAlert } from "../forms/use-focus-alert";
import { motorcycleSchema } from "./motorcycle-schema";
import type { MotorcycleValues } from "./motorcycle-schema";
import { useSendMotorcycle } from "./use-send-motorcycle";
/** Failures preserve the in-memory draft; only an explicit submit sends a write. */
export function useCreateMotorcycle(onCreated: () => void) {
  const send = useSendMotorcycle();
  const busy = useRef(false);
  const [failure, setFailure] = useState<MessageKey>();
  const form = useForm<MotorcycleValues>({
    resolver: zodResolver(motorcycleSchema),
    defaultValues: { code: "", plate: "" },
    mode: "onBlur",
  });
  const submit = form.handleSubmit(async (values) => {
    if (busy.current) return;
    busy.current = true;
    setFailure(undefined);
    const outcome = await send(values);
    busy.current = false;
    if (outcome.kind === "stale") return;
    if (outcome.kind === "duplicate")
      form.setError("code", { message: "errors.api.duplicateCode" }, { shouldFocus: true });
    if (outcome.kind === "failed") setFailure(outcome.key);
    if (outcome.kind === "saved") onCreated();
  });
  return {
    form,
    failure,
    alertRef: useFocusAlert(failure),
    submit: (event: SyntheticEvent) => {
      void submit(event);
    },
  };
}
