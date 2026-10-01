/**
 * PersistentMemoryStore tests (Phase 5, ADR-0010).
 *
 * Verifies that:
 *  1. Data persists across process/store re-instantiations.
 *  2. Scope isolation is preserved.
 *  3. Scope-bound MemoryHandles survive re-instantiation.
 *  4. Prefix listing and deletion work accurately across re-instantiation.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { PersistentMemoryStore } from "./persistent-store.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-review-memory-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("PersistentMemoryStore", () => {
  it("stores and retrieves values within a scope", async () => {
    const store = new PersistentMemoryStore(tmpDir);
    await store.set("review", "k1", { hello: "world" });
    await store.flush();

    const got = await store.get<{ hello: string }>("review", "k1");
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect(got.value?.value.hello).toBe("world");
      expect(got.value?.scope).toBe("review");
    }
  });

  it("isolates scopes: the same key does not leak across scopes", async () => {
    const store = new PersistentMemoryStore(tmpDir);
    await store.set("review", "shared-key", "review-value");
    await store.flush();

    const inReview = await store.get("review", "shared-key");
    const inOrg = await store.get("organization", "shared-key");

    expect(inReview.ok && inReview.value?.value).toBe("review-value");
    expect(inOrg.ok && inOrg.value).toBeUndefined();
  });

  it("memory handles survive re-instantiation of the store (Phase 5 requirement)", async () => {
    // 1. First instance writes data via scope handle
    const store1 = new PersistentMemoryStore(tmpDir);
    const handle1 = store1.bindScope("repository");
    await handle1.set("historicalFindings", { totalReviewed: 42, frequentViolations: ["sec.sqli"] });
    await handle1.set("repoConfig", { lintStrict: true });
    await store1.flush();

    // 2. Second instance re-instantiated pointing to the same storageDir
    const store2 = new PersistentMemoryStore(tmpDir);
    const handle2 = store2.bindScope("repository");

    const retrieved1 = await handle2.get<{ totalReviewed: number; frequentViolations: string[] }>("historicalFindings");
    expect(retrieved1.ok).toBe(true);
    if (retrieved1.ok) {
      expect(retrieved1.value?.value.totalReviewed).toBe(42);
      expect(retrieved1.value?.value.frequentViolations).toEqual(["sec.sqli"]);
      expect(retrieved1.value?.scope).toBe("repository");
    }

    const retrieved2 = await handle2.get<{ lintStrict: boolean }>("repoConfig");
    expect(retrieved2.ok).toBe(true);
    if (retrieved2.ok) {
      expect(retrieved2.value?.value.lintStrict).toBe(true);
    }
  });

  it("deletion persists across re-instantiation", async () => {
    const store1 = new PersistentMemoryStore(tmpDir);
    await store1.set("global", "token", "secret123");
    await store1.flush();

    // Verify it was written
    const got1 = await store1.get("global", "token");
    expect(got1.ok && got1.value?.value).toBe("secret123");

    // Delete it in store1
    await store1.delete("global", "token");
    await store1.flush();

    // Check in re-instantiated store2
    const store2 = new PersistentMemoryStore(tmpDir);
    const got2 = await store2.get("global", "token");
    expect(got2.ok).toBe(true);
    if (got2.ok) {
      expect(got2.value).toBeUndefined();
    }
  });

  it("lists keys by prefix in deterministic order across re-instantiation", async () => {
    const store1 = new PersistentMemoryStore(tmpDir);
    await store1.set("session", "user.pref.theme", "dark");
    await store1.set("session", "user.pref.lang", "fa");
    await store1.set("session", "cache.recent", [1, 2, 3]);
    await store1.flush();

    // Re-instantiate
    const store2 = new PersistentMemoryStore(tmpDir);
    const listed = await store2.list("session", "user.pref.");
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toEqual(["user.pref.lang", "user.pref.theme"]);
    }
  });
});
