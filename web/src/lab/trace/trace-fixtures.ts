/* eslint-disable max-lines-per-function -- one literal fixture of the whole chain. */
import type { BagTrace } from "./trace-query";

const ACTOR = (name: string) => ({ id: "00000000-0000-4000-8000-0000000000a1", name });
const ID = "00000000-0000-4000-8000-0000000000b1";

/** A bag with the full chain: placement, collection, receipt, one voided and one valid count, a Wolbachia result. */
export function makeTrace(overrides: Partial<BagTrace> = {}): BagTrace {
  return {
    bag: { id: ID, code: "B-031" },
    reading: {
      id: ID,
      device_time: "2026-11-10T16:00:00Z",
      server_received_at: "2026-11-10T16:05:00Z",
      courier: ACTOR("Luis Repartidor"),
      paddle_present: true,
      has_eggs: true,
      paddle_type: { code: "standard", label_es: "Estándar", label_en: "Standard" },
      finding_code: "intact",
      epi_week: "2026-W46",
      is_lagged: false,
      voided_at: null,
      void_reason: "",
      capture: { lat: 20.9701, lng: -89.6201, accuracy_m: 8, distance_to_point_m: 14.2 },
      photos: [],
    },
    installed: {
      at: "2026-11-03T16:00:00Z",
      by: ACTOR("Luis Repartidor"),
      basis: "previous_reading",
      exposure_days: 7,
    },
    location: {
      ovitrap: { id: ID, code: "OVT-0042" },
      point: { id: ID, code: "Q-MER-01-B1-P1", location: [-89.62, 20.97], version: 1 },
      block: { id: ID, code: "Q-MER-01-B1", geometry: null },
      quadrant: { id: ID, code: "Q-MER-01", geometry: null },
      center: { id: ID, code: "MER", name: "Mérida" },
    },
    lab: {
      status: "counted",
      receipt: { at: "2026-11-11T15:00:00Z", by: ACTOR("Ana Laboratorio") },
      counts: [
        {
          id: "00000000-0000-4000-8000-0000000000c1",
          ordinal: 1,
          at: "2026-11-11T16:00:00Z",
          by: ACTOR("Ana Laboratorio"),
          replaces: null,
          void: {
            at: "2026-11-11T17:00:00Z",
            by: ACTOR("Ana Laboratorio"),
            reason_code: "typo",
            reason: "Error al capturar",
          },
        },
        {
          id: "00000000-0000-4000-8000-0000000000c2",
          ordinal: 2,
          at: "2026-11-11T17:01:00Z",
          by: ACTOR("Ana Laboratorio"),
          replaces: "00000000-0000-4000-8000-0000000000c1",
          void: null,
        },
      ],
      rejections: [],
      recounts: [],
      wolbachia: [
        {
          sample_code: "S-0001",
          received_at: "2026-11-12T15:00:00Z",
          results: [
            {
              revision: 1,
              status: "valid",
              result: "positive",
              at: "2026-11-13T15:00:00Z",
              by: ACTOR("Ana Laboratorio"),
            },
          ],
          pcr: [],
        },
      ],
    },
    ...overrides,
  };
}
