import type { OvitrapService } from "../ovitrap-check/service.ts";
import type { LifecycleSourceReader } from "../ovitrap-lifecycle/source-context.ts";
import type { LifecycleSourceTurn } from "../ovitrap-lifecycle/types.ts";
import { LifecycleGateError } from "../ovitrap-lifecycle/action-error-key.ts";
import { SupplyProjectionUnavailable } from "../supply-receipt/projection-types.ts";
import { RemoteSessionEnded } from "../../auth/session-requests.ts";
import { resolveScanner } from "./domain.ts";
import type { ScannerInput, ScannerResult } from "./domain.ts";
import type { ScannerResource } from "./resource-source.ts";
import type { Route } from "../../navigation/routes.ts";

interface Dependencies {
  readonly read: () => LifecycleSourceReader;
  readonly resources: (turn: LifecycleSourceTurn) => Promise<readonly ScannerResource[]>;
  readonly ovitrap: Pick<OvitrapService, "startCheck" | "enterBag" | "draftBuffer" | "update">;
}
interface OpenInput {
  readonly input: ScannerInput;
  readonly eventId: string | null;
  readonly isCurrent: () => boolean;
}
export type ScannerDestination =
  { readonly route: Route } | { readonly error: import("./domain.ts").ScannerError };
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
  async open({ input, eventId, isCurrent }: OpenInput): Promise<ScannerDestination> {
    const result = await this.resolve(input);
    if ("error" in result) return result;
    if (!isCurrent()) return { error: "unavailable" };
    const { resource, manualCapture } = result;
    if (resource.kind === "lot") return { route: { name: "supplyDetail", lotId: resource.id } };
    await this.#deps.ovitrap.draftBuffer.persist(this.#deps.ovitrap, eventId);
    if (!isCurrent()) return { error: "unavailable" };
    if (resource.kind === "ovitrap")
      await this.#deps.ovitrap.startCheck(`wbf:1:ovitrap:${resource.id}`, manualCapture, eventId);
    else if (resource.kind === "bag" && eventId !== null)
      await this.#deps.ovitrap.enterBag(`wbf:1:bag:${resource.id}`, eventId, manualCapture);
    else return { error: "unavailable" };
    const current = await this.resolve(input);
    return isCurrent() && stillMatches(current, resource)
      ? { route: { name: "ovitrapCapture" } }
      : { error: "unavailable" };
  }
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
