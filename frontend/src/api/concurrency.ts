/**
 * Runs an async mapper over items with a bounded number in flight.
 *
 * The dashboard needs a series for each of 240 stations. Firing all 240 at
 * once hands the browser a queue it will serialise anyway (six connections per
 * host) while making cancellation and progress meaningless; doing them one at
 * a time wastes the parallelism that is available. A small pool keeps the
 * pipeline full without the stampede.
 *
 * Results come back in input order regardless of completion order.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await mapper(item, index);
    }
  });

  await Promise.all(workers);
  return results;
}
