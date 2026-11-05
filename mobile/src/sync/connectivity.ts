interface ConnectionReading {
  readonly isConnected: boolean | null;
}
interface OnlineConsumer {
  readonly setOnline: (isOnline: boolean) => void;
}
interface ConnectivityTargets {
  readonly auth: OnlineConsumer;
  readonly engine: OnlineConsumer;
}
type SubscribeConnection = (listener: (reading: ConnectionReading) => void) => () => void;

export class ConnectivityUnavailable extends Error {}

/** One publisher normalizes NetInfo once; auth is updated before sync can wake a request. */
export function observeConnectivity(
  subscribe: SubscribeConnection,
  targets: ConnectivityTargets,
): () => void {
  publishConnectivity({ isConnected: null }, targets);
  return subscribe((reading) => {
    publishConnectivity(reading, targets);
  });
}
function publishConnectivity(reading: ConnectionReading, targets: ConnectivityTargets): void {
  // A private LAN backend does not require Internet reachability (#189).
  const isOnline = reading.isConnected === true;
  targets.auth.setOnline(isOnline);
  targets.engine.setOnline(isOnline);
}
