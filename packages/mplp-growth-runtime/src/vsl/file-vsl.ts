/**
 * File-based VSL implementation
 *
 * Storage layout per implementation_plan.md:
 * ~/.openclaw/mplp-growth/
 * ├── vsl/
 * │   ├── objects/<type>/<id>.json
 * │   └── events.ndjson
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ValueStateLayer, VSLOptions, MplpEvent } from "./types.js";

export class FileVSL implements ValueStateLayer {
  private readonly basePath: string;
  private readonly objectsPath: string;
  private readonly eventsPath: string;

  constructor(options: VSLOptions) {
    this.basePath = options.basePath;
    this.objectsPath = path.join(this.basePath, "vsl", "objects");
    this.eventsPath = path.join(this.basePath, "vsl", "events.ndjson");
  }

  /**
   * Initialize VSL directories
   */
  async init(): Promise<void> {
    await fs.mkdir(this.objectsPath, { recursive: true });
    // Ensure events file exists
    try {
      await fs.access(this.eventsPath);
    } catch {
      await fs.writeFile(this.eventsPath, "");
    }
  }

  /**
   * Convert key to file path
   * Key format: "<type>/<id>" -> objects/<type>/<id>.json
   */
  private keyToPath(key: string): string {
    return path.join(this.objectsPath, `${key}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    const filePath = this.keyToPath(key);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const filePath = this.keyToPath(key);
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(value, null, 2));
  }

  async delete(key: string): Promise<boolean> {
    const filePath = this.keyToPath(key);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.keyToPath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Append event to ndjson log (append-only)
   */
  async appendEvent(event: MplpEvent): Promise<void> {
    const line = JSON.stringify(event) + "\n";
    await fs.appendFile(this.eventsPath, line);
  }

  async listKeys(prefix: string): Promise<string[]> {
    const dirPath = path.join(this.objectsPath, prefix);
    const keys: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".json")) {
          const relativePath = path.join(prefix, entry.name.replace(".json", ""));
          keys.push(relativePath);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    return keys;
  }
}
