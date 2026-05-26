/**
 * Concurrency pool utilities for parallelizing async operations
 * with a bounded limit to avoid overwhelming the API or system.
 */

/**
 * Execute async tasks with a concurrency limit using Promise.all batches.
 * Splits tasks into batches and processes them sequentially to maintain the pool size.
 *
 * @param tasks - Array of async tasks (functions that return promises)
 * @param poolSize - Maximum concurrent tasks (default 8)
 * @returns Array of results in the same order as input tasks
 *
 * @example
 * const results = await batchAsync(
 *   items.map(item => () => fetchData(item)),
 *   8
 * );
 */
export async function batchAsync<T>(
  tasks: Array<() => Promise<T>>,
  poolSize: number = 8,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += poolSize) {
    const batch = tasks.slice(i, i + poolSize);
    const batchResults = await Promise.all(batch.map((task) => task()));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Execute async tasks with early exit on error.
 * Processes tasks in batches but stops immediately if any task rejects.
 *
 * @param tasks - Array of async tasks (functions that return promises)
 * @param poolSize - Maximum concurrent tasks (default 8)
 * @throws If any task rejects
 * @returns Array of results in the same order as input tasks
 */
export async function batchAsyncFailFast<T>(
  tasks: Array<() => Promise<T>>,
  poolSize: number = 8,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += poolSize) {
    const batch = tasks.slice(i, i + poolSize);
    const batchResults = await Promise.all(batch.map((task) => task()));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Execute async tasks with a limit, collecting errors and continuing.
 * Useful when you want to process as many items as possible but still report partial failures.
 *
 * @param tasks - Array of async tasks (functions that return promises)
 * @param poolSize - Maximum concurrent tasks (default 8)
 * @returns Object with results and errors arrays, preserving original order (errors have nullish results)
 */
export async function batchAsyncSafe<T>(
  tasks: Array<() => Promise<T>>,
  poolSize: number = 8,
): Promise<{ results: (T | null)[]; errors: (Error | null)[] }> {
  const results: (T | null)[] = [];
  const errors: (Error | null)[] = [];

  for (let i = 0; i < tasks.length; i += poolSize) {
    const batch = tasks.slice(i, i + poolSize);
    const batchResults = await Promise.allSettled(batch.map((task) => task()));
    for (const settlement of batchResults) {
      if (settlement.status === "fulfilled") {
        results.push(settlement.value);
        errors.push(null);
      } else {
        results.push(null);
        errors.push(settlement.reason as Error);
      }
    }
  }

  return { results, errors };
}
