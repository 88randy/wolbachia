import { randomUUID } from 'expo-crypto';

import type { EventStatus, FakeEvent } from './types';

const EVENT_TYPES = ['trap.check', 'trap.place', 'location.ping', 'supplies.receive', 'release.record'];

/** Payload roughly the size of a trap.check (see issue #5), about 250 bytes of JSON. */
function buildPayload(index: number): string {
  return JSON.stringify({
    finding: 'ok',
    paddle_present: true,
    has_eggs: index % 3 === 0,
    temperature_c: 24.5,
    humidity_pct: 61,
    bag_code: `BAG-${String(index).padStart(6, '0')}`,
    paddle_type: 'standard',
    is_lagged: false,
    gps: { lat: 19.4326, lng: -99.1332, accuracy_m: 6.2 },
    note: 'fake event used only by the storage benchmark',
  });
}

export function createFakeEvents(count: number, status: EventStatus = 'pending'): FakeEvent[] {
  const baseTime = Date.now();
  const events: FakeEvent[] = [];
  for (let index = 0; index < count; index += 1) {
    events.push({
      id: randomUUID(),
      type: EVENT_TYPES[index % EVENT_TYPES.length] ?? 'trap.check',
      payload: buildPayload(index),
      device_time: baseTime + index,
      status,
    });
  }
  return events;
}
