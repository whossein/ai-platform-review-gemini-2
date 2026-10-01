# @ai-review/memory

Multi-scope memory store (ARCHITECTURE §11, ADR-0010).

## Memory Stores

- `PersistentMemoryStore`: Crash-safe, durable filesystem-backed store partitioned by scope (`session`, `review`, `repository`, `organization`, `global`). Injected into `server.ts` and `apps/api/src/server.ts` for production workloads.
- `InMemoryMemoryStore`: Ephemeral in-memory store partitioned by scope, retained for fast unit tests.
- `InMemorySnapshotStore`: Snapshot capture and diffing store.

## Guarantees

1. **Re-instantiation Survival:** Data persists on disk across store re-instantiations and process restarts.
2. **Scope Isolation:** Handles created via `bindScope(scope)` can only access keys within their assigned scope.
3. **Atomic Writes:** File updates are written to temporary files and atomically renamed to prevent corruption.
