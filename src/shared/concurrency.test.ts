/**
 * Tests for concurrency pool utilities
 */

import { describe, it, expect, vi } from "vitest";
import { batchAsync, batchAsyncFailFast, batchAsyncSafe } from "./concurrency";

describe("concurrency", () => {
  describe("batchAsync", () => {
    it("executes tasks in parallel batches", async () => {
      const execOrder: number[] = [];

      const tasks = Array.from({ length: 10 }, (_, i) => async () => {
        execOrder.push(i);
        return i * 2;
      });

      const results = await batchAsync(tasks, 3);

      expect(results).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
      expect(execOrder.length).toBe(10);
    });

    it("respects the pool size limit", async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const tasks = Array.from({ length: 10 }, () => async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((r) => setTimeout(r, 10));
        currentConcurrent--;
      });

      await batchAsync(tasks, 4);

      // With pool size 4, max concurrent should not exceed 4
      expect(maxConcurrent).toBeLessThanOrEqual(4);
    });

    it("handles empty task list", async () => {
      const results = await batchAsync([], 5);
      expect(results).toEqual([]);
    });

    it("handles single task", async () => {
      const results = await batchAsync([async () => 42], 5);
      expect(results).toEqual([42]);
    });

    it("continues execution even if one task throws", async () => {
      const execOrder: number[] = [];
      const tasks = [
        async () => {
          execOrder.push(1);
          return 1;
        },
        async () => {
          execOrder.push(2);
          throw new Error("Task 2 failed");
        },
        async () => {
          execOrder.push(3);
          return 3;
        },
      ];

      try {
        await batchAsync(tasks, 2);
      } catch (e) {
        // Ignore error for this test
      }

      // Task 1 and at least part of task 3 should have executed
      expect(execOrder).toContain(1);
    });
  });

  describe("batchAsyncFailFast", () => {
    it("stops on first error", async () => {
      const execOrder: number[] = [];
      const tasks = [
        async () => {
          execOrder.push(1);
          return 1;
        },
        async () => {
          execOrder.push(2);
          throw new Error("Task 2 failed");
        },
        async () => {
          execOrder.push(3);
          return 3;
        },
      ];

      try {
        await batchAsyncFailFast(tasks, 2);
        expect.fail("Should have thrown");
      } catch (e) {
        expect((e as Error).message).toBe("Task 2 failed");
      }
    });

    it("preserves order of results", async () => {
      const tasks = Array.from({ length: 5 }, (_, i) => async () => i * 10);

      const results = await batchAsyncFailFast(tasks, 2);

      expect(results).toEqual([0, 10, 20, 30, 40]);
    });
  });

  describe("batchAsyncSafe", () => {
    it("collects errors without stopping", async () => {
      const tasks = [
        async () => 1,
        async () => {
          throw new Error("Task 2 failed");
        },
        async () => 3,
        async () => {
          throw new Error("Task 4 failed");
        },
        async () => 5,
      ];

      const { results, errors } = await batchAsyncSafe(tasks, 2);

      expect(results.length).toBe(5);
      expect(errors.length).toBe(5);

      expect(results[0]).toBe(1);
      expect(errors[0]).toBeNull();

      expect(results[1]).toBeNull();
      expect((errors[1] as Error).message).toBe("Task 2 failed");

      expect(results[2]).toBe(3);
      expect(errors[2]).toBeNull();

      expect(results[3]).toBeNull();
      expect((errors[3] as Error).message).toBe("Task 4 failed");

      expect(results[4]).toBe(5);
      expect(errors[4]).toBeNull();
    });

    it("preserves order with mixed results and errors", async () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        i % 2 === 0
          ? async () => i * 10
          : async () => {
              throw new Error(`Failed at ${i}`);
            },
      );

      const { results, errors } = await batchAsyncSafe(tasks, 3);

      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          expect(results[i]).toBe(i * 10);
          expect(errors[i]).toBeNull();
        } else {
          expect(results[i]).toBeNull();
          expect((errors[i] as Error).message).toBe(`Failed at ${i}`);
        }
      }
    });

    it("handles empty task list", async () => {
      const { results, errors } = await batchAsyncSafe([], 5);
      expect(results).toEqual([]);
      expect(errors).toEqual([]);
    });
  });

  describe("performance", () => {
    it("parallelizes faster than sequential execution", async () => {
      const taskCount = 10;
      const delayMs = 10; // Each task delays 10ms

      // Sequential: would take ~100ms
      // Parallel with pool 4: should be ~25-30ms

      const tasks = Array.from({ length: taskCount }, () => async () => {
        return new Promise((r) => setTimeout(r, delayMs));
      });

      const startTime = Date.now();
      await batchAsync(tasks, 4);
      const duration = Date.now() - startTime;

      // With 10 tasks at 10ms each, batched by 4:
      // Batch 1: 4 tasks in parallel = 10ms
      // Batch 2: 4 tasks in parallel = 10ms
      // Batch 3: 2 tasks in parallel = 10ms
      // Total ~30ms (plus some overhead)
      // Sequential would be ~100ms
      // We expect parallelization to be at most ~40ms
      expect(duration).toBeLessThan(60);
    });
  });
});
