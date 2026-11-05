import { useRef, useState } from "react";
import { isErrorEnvelope } from "@wolbachia/api-client";
import type { WriteReply } from "./write-result";
import type { Schemas } from "@wolbachia/api-client";
import type { GeographyScope } from "./use-w-15";
import { parseLocation } from "./geometry";
import { useGeographyWrite } from "./use-geography-write";
import { usePointReconciliation } from "./use-point-reconciliation";
export const POINTS_PER_BLOCK = 4;
export interface PointInput {
  code: string;
  location: string;
}
interface Options {
  scope: GeographyScope;
  block: string;
  locations: number[][];
}
/** Successful and uncertain identities are immutable; only explicit reconciliation can release an uncertain slot. */
export function useFourPoints({ scope, block, locations }: Options) {
  const [inputs, setInputs] = useState<PointInput[]>(() => initialInputs(locations));
  const [created, setCreated] = useState<Schemas["SamplingPoint"][]>([]);
  const [warnings, setWarnings] = useState<Schemas["SpacingWarning"][]>([]);
  const [isRunning, setRunning] = useState(false);
  const running = useRef(false);
  const write = useGeographyWrite<Schemas["PointWrite"]>();
  const reconciliation = usePointReconciliation(scope, (point) => {
    setCreated((previous) => [...previous, point]);
    write.clear();
  });
  const isValid =
    inputs.every((input) => input.code.trim() && parseLocation(input.location)) &&
    new Set(inputs.map((input) => input.code.trim())).size === POINTS_PER_BLOCK;
  const form = { inputs, setInputs, created, warnings, isRunning, isValid, write, reconciliation };
  return {
    ...form,
    create: () =>
      sendFourPoints({ scope, block, form, running, setRunning, setCreated, setWarnings }),
  };
}
function initialInputs(locations: number[][]): PointInput[] {
  return Array.from({ length: POINTS_PER_BLOCK }, (_, index) => ({
    code: "",
    location: locations[index]?.join(",") ?? "",
  }));
}
export type FourPoints = ReturnType<typeof useFourPoints>;
interface SendOptions {
  scope: GeographyScope;
  block: string;
  form: Omit<FourPoints, "create">;
  running: React.RefObject<boolean>;
  setRunning: (value: boolean) => void;
  setCreated: React.Dispatch<React.SetStateAction<Schemas["SamplingPoint"][]>>;
  setWarnings: React.Dispatch<React.SetStateAction<Schemas["SpacingWarning"][]>>;
}
async function sendFourPoints(options: SendOptions) {
  const { scope, block, form, running, setCreated, setWarnings } = options;
  const { inputs, created, isValid, write, reconciliation } = form;
  if (
    !isValid ||
    running.current ||
    reconciliation.hasUncertain() ||
    created.length >= POINTS_PER_BLOCK
  )
    return;
  setBatchRunning(options, true);
  for (const input of inputs.slice(created.length)) {
    const location = parseLocation(input.location);
    if (!location) break;
    const request = { block, code: input.code.trim(), location };
    const { result, isUncertain } = await sendPoint(scope, request, write);
    if (isUncertain) {
      reconciliation.mark(request);
      break;
    }
    if (result.kind !== "saved") break;
    setCreated((previous) => [...previous, result.value.point]);
    setWarnings((previous) => [...previous, ...result.value.spacing_warnings]);
  }
  setBatchRunning(options, false);
}
async function sendPoint(
  scope: GeographyScope,
  request: Schemas["SamplingPointCreateRequest"],
  write: FourPoints["write"],
) {
  const delivery = { didSend: false, isUncertain: false };
  const result = await write.execute(async (signal) => {
    delivery.didSend = true;
    delivery.isUncertain = true;
    const reply = await scope.client.POST("/api/v1/sampling-points/", { body: request, signal });
    delivery.isUncertain =
      !(reply.response.ok && reply.data !== undefined) && !isDefinitiveRejection(reply);
    return reply;
  });
  return {
    result,
    isUncertain: delivery.isUncertain || (delivery.didSend && result.kind === "stale"),
  };
}
const FIRST_CLIENT_ERROR = 400;
const FIRST_SERVER_ERROR = 500;
/** Only an authoritative 4xx, excluding an existing identity, proves this attempt was rejected. */
function isDefinitiveRejection(reply: WriteReply<Schemas["PointWrite"]>) {
  const envelope = isErrorEnvelope(reply.error) ? reply.error : undefined;
  const isDuplicate =
    envelope?.code === "duplicate_code" ||
    envelope?.fields?.["code"]?.some((field) => field.code === "duplicate_code") === true;
  return (
    reply.response.status >= FIRST_CLIENT_ERROR &&
    reply.response.status < FIRST_SERVER_ERROR &&
    !isDuplicate
  );
}
function setBatchRunning(options: Pick<SendOptions, "running" | "setRunning">, isRunning: boolean) {
  options.running.current = isRunning;
  options.setRunning(isRunning);
}
