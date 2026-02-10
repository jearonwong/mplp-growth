/**
 * Value State Layer (VSL) Types
 * 
 * VSL is the "Memory" of the MPLP runtime - abstracting physical storage.
 * Per MPLP v1.0: MUST provide K-V interface, append-only event log, read-after-write consistency.
 */

import type { MplpEvent } from '../types.js';

export type { MplpEvent };

/** VSL initialization options */
export interface VSLOptions {
  /** Base directory for VSL storage (e.g., ~/.openclaw/mplp-growth/) */
  basePath: string;
}

/**
 * Value State Layer interface
 * 
 * Core interface per MPLP docs:
 * - get(key): Retrieve value by key
 * - set(key, value): Store value
 * - appendEvent(event): Append to event log
 */
export interface ValueStateLayer {
  /** Get a value by key. Returns null if not found. */
  get<T>(key: string): Promise<T | null>;
  
  /** Set a value by key. Creates or overwrites. */
  set<T>(key: string, value: T): Promise<void>;
  
  /** Delete a value by key. */
  delete(key: string): Promise<boolean>;
  
  /** Check if key exists. */
  exists(key: string): Promise<boolean>;
  
  /** Append event to the append-only event log (ndjson). */
  appendEvent(event: MplpEvent): Promise<void>;
  
  /** List all keys under a prefix. */
  listKeys(prefix: string): Promise<string[]>;
}
