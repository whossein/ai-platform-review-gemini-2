/**
 * @ai-review/memory
 *
 * Multi-scope memory (ARCHITECTURE §11, ADR-0010):
 *  - `InMemoryMemoryStore` — in-memory store for unit tests.
 *  - `PersistentMemoryStore` — durable, filesystem-backed store for production/server runs.
 *  - `InMemorySnapshotStore` — in-memory snapshot and diff engine.
 */

export { InMemoryMemoryStore } from "./store.js";
export { InMemorySnapshotStore, type SnapshotDiff } from "./snapshots.js";
export {
  PersistentMemoryStore,
  type PersistentMemoryStoreOptions,
} from "./persistent-store.js";
