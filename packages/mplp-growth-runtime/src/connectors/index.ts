/**
 * Connectors Framework (Epic A: Signals)
 * Ingests external interactions into the VSL Inbox.
 */

export interface InteractionCandidate {
  source_kind: string; // e.g. "hn", "linkedin", "manual"
  source_ref: string; // e.g. URL or ID
  author_handle: string;
  content: string;
  timestamp: string; // ISO
  metadata?: Record<string, any>;
}

export interface Connector {
  id: string; // unique identifier (e.g., hn-rss)
  pull(): Promise<InteractionCandidate[]>;
}
