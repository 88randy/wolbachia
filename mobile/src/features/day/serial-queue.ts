/** One FIFO turn; rejection reaches its caller without poisoning later operations. */
export class SerialQueue {
  #tail: Promise<unknown> = Promise.resolve();
  run<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.#tail.then(operation);
    this.#tail = next.catch(() => undefined);
    return next;
  }
}
