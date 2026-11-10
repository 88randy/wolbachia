import type { MessageKey } from "@wolbachia/i18n";

export interface HistoryText {
  key: MessageKey;
  params: Record<string, string | number>;
}

const PLAIN_KINDS = {
  "ovitrap.placed": "discovery.kind.ovitrap.placed",
  "relocation.decision": "discovery.kind.relocation.decision",
  "record.void": "discovery.kind.record.void",
  "quadrant.closed": "discovery.kind.quadrant.closed",
  "quadrant.version": "discovery.kind.quadrant.version",
  "sampling_point.version": "discovery.kind.sampling_point.version",
  "sampling_point.decision": "discovery.kind.sampling_point.decision",
  "service.record": "discovery.kind.service.record",
  "motorcycle.block": "discovery.kind.motorcycle.block",
  "motorcycle.unblock": "discovery.kind.motorcycle.unblock",
  "field.received": "discovery.kind.field.received",
  "export.created": "discovery.kind.export.created",
  "export.revised": "discovery.kind.export.revised",
} as const satisfies Record<string, MessageKey>;

function readingKey(params: Record<string, unknown>): MessageKey {
  if (params["paddle_present"] === false) return "discovery.kind.reading.noPaddle";
  return params["has_eggs"] === true
    ? "discovery.kind.reading.withEggs"
    : "discovery.kind.reading.noEggs";
}

function plainText(value: unknown): string | number {
  return typeof value === "number" ? value : typeof value === "string" ? value : "";
}

function isPlainKind(kind: string): kind is keyof typeof PLAIN_KINDS {
  return kind in PLAIN_KINDS;
}

/** The sentence of a timeline entry: a catalog key plus the values it needs, never API text. */
export function historyText(kind: string, params: Record<string, unknown>): HistoryText {
  if (isPlainKind(kind)) return { key: PLAIN_KINDS[kind], params: {} };
  if (kind === "reading.recorded") return { key: readingKey(params), params: {} };
  if (kind === "lab.count") {
    return { key: "discovery.kind.lab.count", params: { value: plainText(params["value"]) } };
  }
  if (kind === "fuel.load") {
    return { key: "discovery.kind.fuel.load", params: { litres: plainText(params["litres"]) } };
  }
  if (kind.startsWith("incident.")) return { key: "discovery.kind.incident", params: {} };
  return { key: "discovery.kind.fallback", params: {} };
}
