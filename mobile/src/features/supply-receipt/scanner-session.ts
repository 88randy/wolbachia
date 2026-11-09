export interface ReceiptScanContext {
  readonly eventId: string;
  readonly sessionKey: string;
}
export interface ReceiptScanTicket extends ReceiptScanContext {
  readonly version: number;
}
interface Permission {
  readonly granted: boolean;
}
interface PermissionRequest {
  readonly current: () => ReceiptScanContext | null;
  readonly permission: Permission | null;
  readonly requestPermission: () => Promise<Permission>;
}
type StartResult =
  | { readonly kind: "ready"; readonly ticket: ReceiptScanTicket }
  | { readonly kind: "busy" | "unavailable" | "retry" | "denied" };

/** One native permission request and one scan callback own the originating session/draft lease. */
export class ReceiptScannerSession {
  #version = 0;
  #isRequesting = false;
  #ticket: ReceiptScanTicket | null = null;
  get isRequesting(): boolean {
    return this.#isRequesting;
  }
  cancel(): void {
    this.#version++;
    this.#ticket = null;
  }
  observe(current: ReceiptScanContext | null): boolean {
    if (this.#ticket === null || this.isCurrent(this.#ticket, current)) return false;
    this.cancel();
    return true;
  }
  isCurrent(ticket: ReceiptScanTicket, current: ReceiptScanContext | null): boolean {
    return (
      ticket.version === this.#version &&
      current !== null &&
      ticket.eventId === current.eventId &&
      ticket.sessionKey === current.sessionKey
    );
  }
  async start(input: PermissionRequest): Promise<StartResult> {
    if (this.#isRequesting) return { kind: "busy" };
    const context = input.current();
    if (context === null) return { kind: "unavailable" };
    const ticket = { ...context, version: ++this.#version };
    this.#ticket = ticket;
    this.#isRequesting = true;
    try {
      return await this.#authorize(input, ticket);
    } catch {
      this.cancel();
      return { kind: "unavailable" };
    } finally {
      this.#isRequesting = false;
    }
  }
  async #authorize(input: PermissionRequest, ticket: ReceiptScanTicket): Promise<StartResult> {
    const permission = input.permission?.granted
      ? input.permission
      : await input.requestPermission();
    if (!this.isCurrent(ticket, input.current())) {
      this.cancel();
      return { kind: "retry" };
    }
    if (!permission.granted) {
      this.cancel();
      return { kind: "denied" };
    }
    return { kind: "ready", ticket };
  }
  consume(ticket: ReceiptScanTicket, current: ReceiptScanContext | null): string | null {
    if (ticket.version !== this.#version) return null;
    const eventId = this.isCurrent(ticket, current) ? ticket.eventId : null;
    this.cancel();
    return eventId;
  }
}
