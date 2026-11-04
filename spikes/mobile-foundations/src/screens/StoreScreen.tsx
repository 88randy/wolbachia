import { Paths } from 'expo-file-system';
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';

import { STORE_EVENT_COUNT, STORE_PENDING_BATCH, STORE_SINGLE_WRITE_COUNT } from '../config';
import { createFakeEvents } from '../store/fakeEvents';
import { openStore } from '../store/instances';
import type { StoreKey } from '../store/instances';
import type { EventStore } from '../store/types';
import { Button, KeyValue, LogView, Note, Screen, Section, errorMessage, formatBytes, formatMs, useLog } from '../ui';

async function timed<T>(work: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await work();
  return { value, ms: performance.now() - start };
}

function percentile(sorted: number[], fraction: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index] ?? 0;
}

export function StoreScreen() {
  const logger = useLog();
  const { log } = logger;
  const [selected, setSelected] = useState<StoreKey>('op-sqlite');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<string>('(not opened yet)');
  const [freeBytes, setFreeBytes] = useState<number>(Paths.availableDiskSpace);

  const ensureOpen = useCallback(
    async (key: StoreKey): Promise<EventStore> => {
      const { store, firstOpenMs } = await openStore(key);
      if (firstOpenMs !== null) log(`${key}: opened in ${formatMs(firstOpenMs)} (${store.describe()})`);
      return store;
    },
    [log]
  );

  const run = useCallback(
    async (label: string, work: (store: EventStore) => Promise<void>) => {
      setBusy(true);
      try {
        const store = await ensureOpen(selected);
        await work(store);
      } catch (error) {
        log(`ERROR in ${label}: ${errorMessage(error)}`);
      } finally {
        setFreeBytes(Paths.availableDiskSpace);
        setBusy(false);
      }
    },
    [ensureOpen, log, selected]
  );

  // Persistence check: every time a store is selected we report what is already on disk,
  // which after an app kill must equal what was written before the kill.
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    ensureOpen(selected)
      .then(async (store) => {
        const [total, pending] = await Promise.all([store.count(), store.countPending()]);
        if (!cancelled) {
          setFound(`${total} rows, ${pending} pending`);
          log(`${selected}: found on disk at open: ${total} rows, ${pending} pending`);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) log(`ERROR opening ${selected}: ${errorMessage(error)}`);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ensureOpen, log, selected]);

  const writeBulk = () =>
    run('bulk write', async (store) => {
      const events = createFakeEvents(STORE_EVENT_COUNT);
      const { ms } = await timed(() => store.insertMany(events));
      log(`${store.name}: wrote ${STORE_EVENT_COUNT} events in one batch: ${formatMs(ms)}`);
      setFound(`${await store.count()} rows, ${await store.countPending()} pending`);
    });

  const writeSingles = () =>
    run('single writes', async (store) => {
      const events = createFakeEvents(STORE_SINGLE_WRITE_COUNT);
      const durations: number[] = [];
      for (const event of events) {
        const { ms } = await timed(() => store.insertOne(event));
        durations.push(ms);
      }
      const sorted = [...durations].sort((a, b) => a - b);
      const mean = durations.reduce((sum, value) => sum + value, 0) / durations.length;
      log(
        `${store.name}: ${STORE_SINGLE_WRITE_COUNT} single writes: mean ${formatMs(mean)}, p95 ${formatMs(
          percentile(sorted, 0.95)
        )}, max ${formatMs(sorted[sorted.length - 1] ?? 0)}`
      );
      setFound(`${await store.count()} rows, ${await store.countPending()} pending`);
    });

  const readPending = () =>
    run('read pending', async (store) => {
      const batch = await timed(() => store.readPending(STORE_PENDING_BATCH));
      const pending = await timed(() => store.countPending());
      const total = await timed(() => store.count());
      log(
        `${store.name}: read ${batch.value.length} oldest pending: ${formatMs(batch.ms)}; ` +
          `count pending=${pending.value}: ${formatMs(pending.ms)}; count all=${total.value}: ${formatMs(total.ms)}`
      );
    });

  const markFirstBatchSent = () =>
    run('mark sent', async (store) => {
      const batch = await store.readPending(STORE_PENDING_BATCH);
      const { ms } = await timed(() => store.markSent(batch.map((event) => event.id)));
      log(`${store.name}: marked ${batch.length} events as sent: ${formatMs(ms)}`);
      setFound(`${await store.count()} rows, ${await store.countPending()} pending`);
    });

  const clearAll = () =>
    run('clear', async (store) => {
      const { ms } = await timed(() => store.clear());
      log(`${store.name}: cleared in ${formatMs(ms)}`);
      setFound(`${await store.count()} rows, ${await store.countPending()} pending`);
    });

  return (
    <Screen>
      <Section title="Local store benchmark">
        <Note>
          Run the same steps for each library. Then force-stop the app (Settings, Apps, Force stop), reopen it, come back
          here and check the "found on disk" line. Evidence: screen recording plus the numbers below.
        </Note>
        <Button label="Use op-sqlite" onPress={() => setSelected('op-sqlite')} disabled={busy || selected === 'op-sqlite'} />
        <Button
          label="Use WatermelonDB"
          onPress={() => setSelected('WatermelonDB')}
          disabled={busy || selected === 'WatermelonDB'}
        />
        <KeyValue label="Selected" value={selected} />
        <KeyValue label="On disk now" value={found} />
        <KeyValue label="Free storage" value={formatBytes(freeBytes)} />
      </Section>
      <Section title="Steps">
        <Button label={`1. Write ${STORE_EVENT_COUNT} events (one batch)`} onPress={writeBulk} disabled={busy} />
        <Button label={`2. Write ${STORE_SINGLE_WRITE_COUNT} events one by one`} onPress={writeSingles} disabled={busy} />
        <Button label="3. Read pending queue (oldest 100) and counts" onPress={readPending} disabled={busy} />
        <Button label="4. Mark first batch as sent" onPress={markFirstBatchSent} disabled={busy} />
        <Button label="Clear table" onPress={clearAll} disabled={busy} danger />
        {busy ? <Text>Working...</Text> : null}
      </Section>
      <Section title="Log (newest first)">
        <LogView logger={logger} />
      </Section>
    </Screen>
  );
}
