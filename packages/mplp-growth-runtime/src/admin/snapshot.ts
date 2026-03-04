import fs from "fs/promises";
import path from "path";
import * as tar from "tar";
import { runnerState } from "../runner/state.js";

export interface SnapshotMeta {
  snapshot_id: string;
  created_at: string;
  bytes: number;
  state_dir: string;
  label?: string;
  version: string;
}

const getSnapshotsDir = (stateDir: string) => path.join(stateDir, "snapshots");
const getIndexFile = (stateDir: string) => path.join(getSnapshotsDir(stateDir), "index.json");

export async function ensureSnapshotsDir(stateDir: string) {
  const dir = getSnapshotsDir(stateDir);
  await fs.mkdir(dir, { recursive: true });
  const index = getIndexFile(stateDir);
  try {
    await fs.access(index);
  } catch {
    await fs.writeFile(index, JSON.stringify([]), "utf-8");
  }
  return dir;
}

export async function createSnapshot(stateDir: string, label?: string): Promise<SnapshotMeta> {
  const snapDir = await ensureSnapshotsDir(stateDir);
  const now = new Date();

  // Format: snap-YYYYMMDD-HHMMSS-8hex
  const ts = now
    .toISOString()
    .replace(/[:\-T]/g, "")
    .slice(0, 14);
  const hex = Math.random().toString(16).slice(2, 10);
  const snapshot_id = `snap-${ts}-${hex}`;

  const targetDir = path.join(snapDir, snapshot_id);
  await fs.mkdir(targetDir, { recursive: true });

  const archivePath = path.join(targetDir, "state.tar.gz");

  // Tar everything in stateDir EXCEPT the 'snapshots' folder and potential transient locks
  await tar.create(
    {
      gzip: true,
      file: archivePath,
      cwd: stateDir,
      filter: (filePath) =>
        !filePath.startsWith("snapshots") && !filePath.includes(".restore-backup"),
    },
    ["."],
  );

  const stat = await fs.stat(archivePath);

  // Require package.json for version (workaround for CJS/ESM context)
  const pkgPath = path.resolve(process.cwd(), "package.json");
  let version = "0.7.4";
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    version = pkg.version;
  } catch (e) {
    /* ignore */
  }

  const meta: SnapshotMeta = {
    snapshot_id,
    created_at: now.toISOString(),
    bytes: stat.size,
    state_dir: stateDir,
    label,
    version,
  };

  await fs.writeFile(path.join(targetDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

  // Update index
  const indexFile = getIndexFile(stateDir);
  const indexData = JSON.parse(await fs.readFile(indexFile, "utf-8")) as SnapshotMeta[];
  indexData.unshift(meta); // newest first
  await fs.writeFile(indexFile, JSON.stringify(indexData, null, 2), "utf-8");

  return meta;
}

export async function listSnapshots(stateDir: string): Promise<SnapshotMeta[]> {
  await ensureSnapshotsDir(stateDir);
  const indexFile = getIndexFile(stateDir);
  try {
    return JSON.parse(await fs.readFile(indexFile, "utf-8")) as SnapshotMeta[];
  } catch (e) {
    return [];
  }
}

export async function restoreSnapshot(stateDir: string, snapshot_id: string): Promise<void> {
  // Defensive: Turn off runner immediately
  runnerState.setConfig({ runner_enabled: false });
  let lockAcquired = false;

  // In a robust system we'd wait for jobs to drain. For MVP we trust the state logic
  // and force off.

  const snapDir = await ensureSnapshotsDir(stateDir);
  const targetDir = path.join(snapDir, snapshot_id);
  const archivePath = path.join(targetDir, "state.tar.gz");

  try {
    await fs.access(archivePath);
  } catch (e) {
    throw new Error(`Snapshot archive not found for ${snapshot_id}`, { cause: e });
  }

  // 1. Backup current state
  const backupId = `pre-restore-${Date.now()}`;
  const backupDir = path.join(stateDir, ".restore-backup", backupId);
  await fs.mkdir(backupDir, { recursive: true });

  // Move everything EXCEPT snapshots and .restore-backup into backupDir
  const items = await fs.readdir(stateDir);
  for (const item of items) {
    if (item === "snapshots" || item === ".restore-backup") {
      continue;
    }
    const oldPath = path.join(stateDir, item);
    const newPath = path.join(backupDir, item);
    try {
      await fs.rename(oldPath, newPath);
    } catch (e) {
      console.warn(`[Snapshot] Skipping file during backup: ${item}`, e);
    }
  }

  // 2. Extract snapshot into stateDir
  await tar.extract({
    file: archivePath,
    cwd: stateDir,
  });

  // 3. Ensure runner stays OFF after restore (config in un-tarred files might have had it ON)
  // We re-apply the off state explicitly
  runnerState.setConfig({ runner_enabled: false });
}
