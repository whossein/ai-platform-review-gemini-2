/**
 * Persistent multi-scope memory store (Phase 5, ADR-0010).
 *
 * Implements a durable `MemoryStore` backed by the filesystem, partitioned
 * by scope (session/review/repository/organization/global).
 *
 * Guarantees:
 *   1. Persistence: Memory handles survive process restart / store re-instantiation.
 *   2. Scope isolation: A review-scoped handle cannot read/write repository or global memory.
 *   3. Crash safety: Atomic writes using temporary files and rename.
 *   4. Zero external runtime dependencies: Uses node:fs and node:path.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  AsyncResult,
  MemoryHandle,
  MemoryRecord,
  MemoryScope,
  MemoryStore,
  PlatformError,
} from "@ai-review/core";

export interface PersistentMemoryStoreOptions {
  /** Timestamp generator function (defaults to Date.now). */
  readonly now?: () => number;
}

function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

function fail(
  category: PlatformError["category"],
  code: string,
  message: string,
): { ok: false; error: PlatformError } {
  return { ok: false, error: { category, code, message } };
}

export class PersistentMemoryStore implements MemoryStore {
  readonly storageDir: string;
  private readonly now: () => number;
  private readonly cache = new Map<MemoryScope, Map<string, MemoryRecord>>();
  private readonly loadedScopes = new Set<MemoryScope>();
  private writeQueue = Promise.resolve();

  constructor(
    storageDir = "./.data/memory",
    options: PersistentMemoryStoreOptions = {},
  ) {
    this.storageDir = path.resolve(storageDir);
    this.now = options.now ?? Date.now;
  }

  private scopeFilePath(scope: MemoryScope): string {
    return path.join(this.storageDir, `${scope}.json`);
  }

  private async ensureLoaded(scope: MemoryScope): Promise<Map<string, MemoryRecord>> {
    let bucket = this.cache.get(scope);
    if (this.loadedScopes.has(scope) && bucket) {
      return bucket;
    }

    bucket = new Map<string, MemoryRecord>();
    this.cache.set(scope, bucket);

    const filePath = this.scopeFilePath(scope);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, MemoryRecord>;
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === "object" && "key" in v) {
            bucket.set(k, v);
          }
        }
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        // If parsing fails or file read error, start clean rather than throwing
        console.warn(`[PersistentMemoryStore] Could not load scope "${scope}" from ${filePath}: ${err.message}`);
      }
    }

    this.loadedScopes.add(scope);
    return bucket;
  }

  private async persistScope(scope: MemoryScope): Promise<void> {
    const bucket = this.cache.get(scope) ?? new Map<string, MemoryRecord>();
    const filePath = this.scopeFilePath(scope);
    const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

    const serialized: Record<string, MemoryRecord> = {};
    for (const [k, v] of bucket.entries()) {
      serialized[k] = v;
    }

    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      await fs.writeFile(tmpPath, JSON.stringify(serialized, null, 2), "utf8");
      await fs.rename(tmpPath, filePath);
    } catch (err: any) {
      // Clean up tmp file if rename failed
      try {
        await fs.unlink(tmpPath);
      } catch {
        // ignore
      }
      throw err;
    }
  }

  private queueWrite(scope: MemoryScope): Promise<void> {
    const writeOp = this.writeQueue.then(() => this.persistScope(scope));
    this.writeQueue = writeOp.catch(() => {});
    return writeOp;
  }

  async get<V = unknown>(
    scope: MemoryScope,
    key: string,
  ): AsyncResult<MemoryRecord<V> | undefined> {
    try {
      const bucket = await this.ensureLoaded(scope);
      const record = bucket.get(key) as MemoryRecord<V> | undefined;
      return ok(record);
    } catch (err: any) {
      return fail("internal", "memory.read_error", err.message || "Failed to read memory");
    }
  }

  async set<V = unknown>(
    scope: MemoryScope,
    key: string,
    value: V,
  ): AsyncResult<void> {
    try {
      const bucket = await this.ensureLoaded(scope);
      const record: MemoryRecord<V> = {
        key,
        value,
        scope,
        updatedAt: this.now(),
      };
      bucket.set(key, record as MemoryRecord);
      await this.queueWrite(scope);
      return ok(undefined);
    } catch (err: any) {
      return fail("internal", "memory.write_error", err.message || "Failed to write memory");
    }
  }

  async delete(scope: MemoryScope, key: string): AsyncResult<void> {
    try {
      const bucket = await this.ensureLoaded(scope);
      const existed = bucket.delete(key);
      if (existed) {
        await this.queueWrite(scope);
      }
      return ok(undefined);
    } catch (err: any) {
      return fail("internal", "memory.delete_error", err.message || "Failed to delete memory");
    }
  }

  async list(
    scope: MemoryScope,
    prefix?: string,
  ): AsyncResult<readonly string[]> {
    try {
      const bucket = await this.ensureLoaded(scope);
      const keys = [...bucket.keys()].filter(
        (k) => !prefix || k.startsWith(prefix),
      );
      keys.sort();
      return ok(keys);
    } catch (err: any) {
      return fail("internal", "memory.list_error", err.message || "Failed to list memory keys");
    }
  }

  /**
   * Returns a scope-bound handle handed to an agent runtime.
   */
  bindScope(scope: MemoryScope): MemoryHandle {
    return {
      scope,
      get: <V = unknown>(key: string) => this.get<V>(scope, key),
      set: <V = unknown>(key: string, value: V) => this.set<V>(scope, key, value),
      delete: (key: string) => this.delete(scope, key),
    };
  }

  /**
   * Waits for all pending filesystem writes to flush.
   */
  async flush(): Promise<void> {
    await this.writeQueue;
  }
}
