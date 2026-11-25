import type { OvitrapService } from "../ovitrap-check/service.ts";
import type { LifecycleSourceReader } from "../ovitrap-lifecycle/source-context.ts";
import type { LifecycleSourceTurn } from "../ovitrap-lifecycle/types.ts";
import type { LifecycleService, ReplacementLabelResult } from "../ovitrap-lifecycle/service.ts";
import { LifecycleGateError } from "../ovitrap-lifecycle/action-error-key.ts";
import { SupplyProjectionUnavailable } from "../supply-receipt/projection-types.ts";
import { RemoteSessionEnded } from "../../auth/session-requests.ts";
import { codeScannerRoute } from "./code-route.ts";
import { resolveScanner } from "./domain.ts";
import type { ScannerInput, ScannerResult } from "./domain.ts";
import type { ScannerResource } from "./resource-source.ts";
import type { BagEntry } from "./bag-entry.ts";
import type { Route } from "../../navigation/routes.ts";

interface Dependencies {
  readonly sample?: (
    input: ScannerInput,
    isCurrent: () => boolean,
  ) => Promise<ScannerDestination | null>;
  readonly read: () => LifecycleSourceReader;
  readonly resources: (turn: LifecycleSourceTurn) => Promise<readonly ScannerResource[]>;
  readonly bag: (input: ScannerInput, turn: LifecycleSourceTurn) => Promise<BagEntry>;
  readonly ovitrap: Pick<
    OvitrapService,
    "startCheck" | "enterBag" | "bindLabel" | "usedPointCode" | "draftBuffer" | "update"
  >;
  readonly lifecycle?: LifecycleService;
}
interface OpenInput {
  readonly input: ScannerInput;
  readonly eventId: string | null;
  readonly isCurrent: () => boolean;
}
export type ScannerDestination =
  | { readonly route: Route }
  /** Done: return to the screen that opened the scanner. */
  | { readonly back: true }
  | { readonly error: import("./domain.ts").ScannerError; readonly pointCode?: string | null };
/** What the scanner says for each refused replacement label. */
export const REPLACEMENT_SCAN_ERRORS: Readonly<
  Record<Exclude<ReplacementLabelResult, "read">, import("./domain.ts").ScannerError>
> = { invalid: "invalid", unknown: "labelUnknown", used: "labelUsed", own: "labelOwn" };
/** Resolves only current downloaded scope; opening a capture awaits its existing durable writer. */
export class ScannerService {
  readonly #deps: Dependencies;
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  async resolve(input: ScannerInput): Promise<ScannerResult> {
    const syntax = resolveScanner(input, []);
    if ("error" in syntax && syntax.error !== "unavailable") return syntax;
    return this.#inTurn(async (turn) => resolveScanner(input, await this.#deps.resources(turn)));
  }
  async #inTurn<T>(
    work: (turn: LifecycleSourceTurn) => Promise<T>,
  ): Promise<T | { readonly error: "unavailable" }> {
    try {
      return await this.#deps.read()(null, async (turn) => {
        const result = await work(turn);
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
    if (input.bindsLabel === "replace") return this.#bindReplacement(input, eventId, isCurrent);
    if (input.bindsLabel) return this.#bindLabel(input, eventId, isCurrent);
    const coded = codeScannerRoute(input);
    if (coded) return Promise.resolve(coded);
    return input.expected === "bag" ? this.#enterBag(request) : this.#openResource(request);
  }
  async #openResource({ input, eventId, isCurrent }: OpenInput): Promise<ScannerDestination> {
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
      const pointCode = await this.#deps.ovitrap.usedPointCode(
        input.value,
        input.isManual,
        eventId,
      );
      return { error: "labelUsed", pointCode };
    }
    return { error: result === "unknown" ? "labelUnknown" : "invalid" };
  }
  /** Replacing: the label of the new trap follows the same rules as placing, then returns to the wizard. */
  async #bindReplacement(
    input: ScannerInput,
    eventId: string | null,
    isCurrent: () => boolean,
  ): Promise<ScannerDestination> {
    const { lifecycle } = this.#deps;
    if (!lifecycle || eventId === null) return { error: "unavailable" };
    await lifecycle.draftBuffer.persist(lifecycle, eventId);
    const { labelResult } = await lifecycle.bindReplacementLabel(
      input.value,
      input.isManual,
      eventId,
    );
    if (!isCurrent()) return { error: "unavailable" };
    return labelResult === "read"
      ? { back: true }
      : { error: REPLACEMENT_SCAN_ERRORS[labelResult] };
  }
  /** The bag step of the open capture: camera and typed code follow the same rule (`resolveBagEntry`). */
  async #enterBag({ input, eventId, isCurrent }: OpenInput): Promise<ScannerDestination> {
    const syntax = resolveScanner(input, []);
    if ("error" in syntax && syntax.error !== "unavailable") return syntax;
    if (eventId === null) return { error: "unavailable" };
    const entry = await this.#inTurn((turn) => this.#deps.bag(input, turn));
    if ("error" in entry) return entry;
    if (!isCurrent()) return { error: "unavailable" };
    await this.#deps.ovitrap.draftBuffer.persist(this.#deps.ovitrap, eventId);
    await this.#deps.ovitrap.enterBag(entry.value, eventId, input.isManual);
    return isCurrent() ? { route: { name: "ovitrapCapture" } } : { error: "unavailable" };
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
