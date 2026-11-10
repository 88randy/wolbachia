import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useInventoryContext } from "../use-inventory-context";
import { EMPTY_CAPTURE, INITIAL_CAPTURE } from "./condition-capture-state";
import type { CaptureState, CaptureValues } from "./condition-capture-state";
import { useCaptureRetirement } from "./use-capture-retirement";
export function useConditionCaptureState(isDenied: boolean) {
  const [values, setValues] = useState<CaptureValues>({ ...EMPTY_CAPTURE });
  const [state, setState] = useState<CaptureState>(INITIAL_CAPTURE);
  const scope = useInventoryContext();
  const queryClient = useQueryClient();
  const attempt = useRef<symbol | null>(null);
  useCaptureRetirement({ scope, attempt, setState, setValues, isDenied });
  return { values, setValues, state, setState, scope, queryClient, attempt };
}
