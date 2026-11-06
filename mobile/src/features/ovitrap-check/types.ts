import type { Schemas } from "@wolbachia/api-client";
import type { FieldEventEnvelope } from "../../outbox/outbox-event.ts";
import type { ChecklistItem } from "../shift-open/domain.ts";
export type QrKind = "lot" | "ovitrap" | "bag" | "release-device" | "sample";
export type Step = "point" | "prepare" | "finding" | "paddle" | "eggs" | "details" | "confirm";
export interface Point {
  readonly id: string;
  readonly code: string;
  readonly lat: number;
  readonly lng: number;
}
export interface Reuse {
  readonly id: string;
  readonly reuses: number;
  readonly isEligible: boolean;
}
export interface Catalog {
  readonly version: string;
  readonly findings: readonly ChecklistItem[];
  readonly paddleTypes: readonly ChecklistItem[];
  readonly voidReasons: readonly ChecklistItem[];
}
export interface Rules {
  readonly isConfigured?: boolean;
  readonly version: string;
  readonly nextChangeAt: string | null;
  readonly maxAccuracyM: number;
  readonly maxDistanceM: number;
  readonly maxPaddleReuses: number;
  readonly gpsPolicy: "block" | "review";
  readonly stalePolicy: "block" | "review";
}
/** Supplied by explicit assignment/bootstrap integration, never inferred from an empty scope. */
export interface Assignment {
  readonly version: string;
  readonly epiWeek: string;
  readonly organization?: Pick<Schemas["MeOrganization"], "timezone" | "epi_week">;
  readonly points: readonly Point[];
  readonly ovitraps: readonly { id: string; point: Point }[];
  readonly bags: readonly { id: string; code: string }[];
  readonly reuse: readonly Reuse[];
}
export interface Evidence {
  readonly id: string;
  readonly fileRef: string;
}
export interface Draft {
  readonly eventId: string;
  readonly deviceTime: string;
  readonly mode: "place" | "check";
  readonly ovitrapId: string;
  readonly point: Point | null;
  readonly shiftId: string;
  readonly catalog: Catalog | null;
  readonly rules: Rules | null;
  readonly assignment: Assignment | null;
  readonly gps: FieldEventEnvelope["gps"];
  readonly manualCapture: boolean;
  readonly step: Step;
  readonly finding: string;
  readonly paddlePresent: boolean | null;
  readonly hasEggs: boolean | null;
  readonly temperature: string;
  readonly humidity: string;
  readonly paddleType: string | null;
  readonly bagCode: string;
  readonly bagQrHistory: readonly string[];
  readonly bagUuid: string | null;
  readonly isLagged: boolean;
  readonly otherText: string;
  readonly supplyRefs: readonly string[];
  readonly sourceEvidence: readonly Evidence[];
  readonly evidence: readonly Evidence[];
  readonly prepared: readonly string[];
  readonly reuseId: string | null;
  readonly reviewAcknowledged: boolean;
  readonly replacesEventId: string | null;
  readonly voidEventId: string | null;
  readonly reasonCode: string;
  readonly reason: string;
}
export type DraftPatch = Partial<
  Pick<
    Draft,
    | "point"
    | "step"
    | "finding"
    | "paddlePresent"
    | "hasEggs"
    | "temperature"
    | "humidity"
    | "paddleType"
    | "bagCode"
    | "isLagged"
    | "otherText"
    | "supplyRefs"
    | "prepared"
    | "reuseId"
    | "reviewAcknowledged"
    | "reasonCode"
    | "reason"
  >
>;
export interface ScannerPort {
  scan(): Promise<{ status: "read"; value: string } | { status: "unavailable" | "cancelled" }>;
}
export interface GpsPort {
  locate(): Promise<FieldEventEnvelope["gps"]>;
}
export interface EvidencePort {
  capture(): Promise<Evidence | null>;
}
