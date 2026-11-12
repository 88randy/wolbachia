import type { OvitrapService } from "../ovitrap-check/service.ts";
import type { LifecycleSourceReader } from "../ovitrap-lifecycle/source-context.ts";
import type { LifecycleSourceTurn } from "../ovitrap-lifecycle/types.ts";
import { LifecycleGateError } from "../ovitrap-lifecycle/action-error-key.ts";
import { SupplyProjectionUnavailable } from "../supply-receipt/projection-types.ts";
import { RemoteSessionEnded } from "../../auth/session-requests.ts";
import { codeScannerRoute } from "./code-route.ts";
import { resolveScanner } from "./domain.ts";
import type { ScannerInput, ScannerResult } from "./domain.ts";
import type { ScannerResource } from "./resource-source.ts";
import type { Route } from "../../navigation/routes.ts";

interface Dependencies {
  readonly sample?: (
    input: ScannerInput,
    isCurrent: () => boolean,
  ) => Promise<ScannerDestination | null>;
  readonly read: () => LifecycleSourceReader;
  readonly resources: (turn: LifecycleSourceTurn) => Promise<readonly ScannerResource[]>;
  readonly ovitrap: Pick<
    OvitrapService,
    "startCheck" | "enterBag" | "bindLabel" | "usedPointCode" | "draftBuffer" | "update"
  >;
}
interface OpenInput {
  readonly input: ScannerInput;
  readonly eventId: string | null;
  readonly isCurrent: () => boolean;
}
export type ScannerDestination =
  | { readonly route: Route }
  | { readonly error: import("./domain.ts").ScannerError; readonly pointCode?: string | null };
/** Resolves only current downloaded scope; opening a capture awaits its existing durable writer. */
export class ScannerService {
  readonly #deps: Dependencies;
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  async resolve(input: ScannerInput): Promise<ScannerResult> {
    const syntax = resolveScanner(input, []);
    if ("error" in syntax && syntax.error !== "unavailable") return syntax;
    try {
      return await this.#deps.read()(null, async (turn) => {
        const result = resolveScanner(input, await this.#deps.resources(turn));
        await turn.assertCurrent();
        return result;
      });
    } catch (error) {
      if (isUnavailable(error)) return { error: "unavailable" };
      throw error;
    }
  }
  open(request: OpenInput): Promise<ScannerDestination> {
    const { input, eventId, isCurrent } = request;
    return input.bindsLabel
      ? this.#bindLabel(input, eventId, isCurrent)
      : this.#openResource(request);
  }
  async #openResource({ input, eventId, isCurrent }: OpenInput): Promise<ScannerDestination> {
    const coded = codeScannerRoute(input);
    if (coded) return coded;
    const sample = await this.#deps.sample?.(input, isCurrent);
    if (sample) return sample;
    const result = await this.resolve(input);
    if ("error" in result) return result;
    if (!isCurrent()) return { error: "unavailable" };
    const { resource, manualCapture } = result;
    const readRoute = readOnlyRoute(resource, manualCapture);
    if (readRoute) return { route: readRoute };
    await this.#deps.ovitrap.draftBuffer.persist(this.#deps.ovitrap, eventId);
    if (!isCurrent() || !(await this.#startCapture(resource, eventId, manualCapture)))
      return { error: "unavailable" };
    const current = await this.resolve(input);
    return isCurrent() && stillMatches(current, resource)
      ? { route: { name: "ovitrapCapture" } }
      : { error: "unavailable" };
  }
  /** A new trap is not downloaded yet, so its label is not looked up: it only has to be a free ovitrap label. */
  async #bindLabel(
    input: ScannerInput,
    eventId: string | null,
    isCurrent: () => boolean,
  ): Promise<ScannerDestination> {
    await this.#deps.ovitrap.draftBuffer.persist(this.#deps.ovitrap, eventId);
    const result = await this.#deps.ovitrap.bindLabel(input.value, input.isManual, eventId);
    if (!isCurrent()) return { error: "unavailable" };
    if (result === "read") return { route: { name: "ovitrapCapture" } };
    if (result === "used") {
      const pointCode = await this.#deps.ovitrap.usedPointCode(input.value, input.isManual, eventId);
      return { error: "labelUsed", pointCode };
    }
    return { error: result === "unknown" ? "labelUnknown" : "invalid" };
  }
  async #startCapture(
    resource: ScannerResource,
    eventId: string | null,
    manualCapture: boolean,
  ): Promise<boolean> {
    if (resource.kind === "ovitrap") {
      await this.#deps.ovitrap.startCheck(`wbf:1:ovitrap:${resource.id}`, manualCapture, eventId);
      return true;
    }
    if (resource.kind !== "bag" || eventId === null) return false;
    await this.#deps.ovitrap.enterBag(`wbf:1:bag:${resource.id}`, eventId, manualCapture);
    return true;
  }
}
function readOnlyRoute(resource: ScannerResource, manualCapture: boolean): Route | null {
  if (resource.kind === "lot") return { name: "supplyDetail", lotId: resource.id };
  return resource.kind === "release-device"
    ? {
        name: "releaseCapture",
        taskId: null,
        deviceId: resource.id,
        manualCapture,
      }
    : null;
}
function stillMatches(result: ScannerResult, resource: ScannerResource): boolean {
  return "resource" in result && sameResource(resource, result.resource);
}
function sameResource(left: ScannerResource, right: ScannerResource): boolean {
  return left.kind === right.kind && left.id === right.id && left.code === right.code;
}
function isUnavailable(error: unknown): boolean {
  return (
    error instanceof LifecycleGateError ||
    error instanceof SupplyProjectionUnavailable ||
    error instanceof RemoteSessionEnded
  );
}
