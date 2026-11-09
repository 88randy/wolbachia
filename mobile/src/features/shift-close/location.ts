import type { LocationSource, LocationState } from "../day/location.ts";
/** Durable open check gates starts; a generation immediately retires pending native watches and callbacks. */
export class ShiftLocationSource implements LocationSource {
  readonly #source: LocationSource;
  readonly #hasOpenShift: () => Promise<boolean>;
  readonly #stops = new Set<() => void>();
  #generation = 0;
  constructor(source: LocationSource, hasOpenShift: () => Promise<boolean>) {
    this.#source = source;
    this.#hasOpenShift = hasOpenShift;
  }
  stopAll(): void {
    this.#generation += 1;
    for (const stop of this.#stops) stop();
    this.#stops.clear();
  }
  async start(publish: (state: LocationState) => void): Promise<() => void> {
    const generation = this.#generation;
    let isActive = true;
    if (!(await this.#hasOpenShift()) || generation !== this.#generation) return () => undefined;
    const cancel = await this.#source.start((fix) => {
      if (isActive && generation === this.#generation) publish(fix);
    });
    const stop = () => { if (!isActive) return; isActive = false; cancel(); this.#stops.delete(stop); };
    if (generation !== this.#generation) stop();
    else this.#stops.add(stop);
    return stop;
  }
}
