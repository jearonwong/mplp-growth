/**
 * Phase 31: Snapshot / Restore Gate Tests (v0.7.4)
 *
 * GATE-SNAPSHOT-CREATES-ARCHIVE-01: Creates tar.gz and meta
 * GATE-RESTORE-ROLLS-BACK-01: Restores previous state and reverts changes
 * GATE-RESTORE-RUNNER-OFF-01: Runner is disabled after restore
 * GATE-SNAPSHOT-LIST-01: Correctly indexes and lists snapshots
 */

import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSnapshot, listSnapshots, restoreSnapshot } from "./admin/snapshot";
import { runnerState } from "./runner/state";

describe("Phase 31: Snapshot / Restore (v0.7.4)", () => {
  let testStateDir: string;

  beforeAll(async () => {
    testStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "mplp-growth-test-"));
    // Create a dummy vsl structure
    await fs.mkdir(path.join(testStateDir, "vsl"), { recursive: true });
    await fs.writeFile(path.join(testStateDir, "vsl", "test.json"), '{"hello":"world"}', "utf-8");
  });

  afterAll(async () => {
    await fs.rm(testStateDir, { recursive: true, force: true });
  });

  describe("GATE-SNAPSHOT-CREATES-ARCHIVE-01", () => {
    it("creates snapshot with metadata", async () => {
      const meta = await createSnapshot(testStateDir, "Test Snap");
      expect(meta.snapshot_id).toMatch(/^snap-/);
      expect(meta.label).toBe("Test Snap");

      const archivePath = path.join(testStateDir, "snapshots", meta.snapshot_id, "state.tar.gz");
      const stat = await fs.stat(archivePath);
      expect(stat.size).toBeGreaterThan(0);
    });
  });

  describe("GATE-SNAPSHOT-LIST-01", () => {
    it("lists created snapshots from index", async () => {
      const snaps = await listSnapshots(testStateDir);
      expect(snaps.length).toBeGreaterThanOrEqual(1);
      expect(snaps[0].label).toBe("Test Snap");
    });
  });

  describe("GATE-RESTORE-ROLLS-BACK-01", () => {
    it("reverts file mutations", async () => {
      // 1. Mark state
      const targetFile = path.join(testStateDir, "vsl", "test.json");

      // 2. Snapshot
      const meta = await createSnapshot(testStateDir, "Before Mutate");

      // 3. Mutate
      await fs.writeFile(targetFile, '{"hello":"mutated"}', "utf-8");
      let content = await fs.readFile(targetFile, "utf-8");
      expect(content).toBe('{"hello":"mutated"}');

      // 4. Restore
      await restoreSnapshot(testStateDir, meta.snapshot_id);

      // 5. Verify rollback
      content = await fs.readFile(targetFile, "utf-8");
      expect(content).toBe('{"hello":"world"}');
    });
  });

  describe("GATE-RESTORE-RUNNER-OFF-01", () => {
    it("forces runner_enabled to false post-restore", async () => {
      runnerState.setConfig({ runner_enabled: true });
      expect(runnerState.getConfig().runner_enabled).toBe(true);

      const meta = await createSnapshot(testStateDir, "Runner Test");
      await restoreSnapshot(testStateDir, meta.snapshot_id);

      expect(runnerState.getConfig().runner_enabled).toBe(false);
    });
  });
});
