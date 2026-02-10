/**
 * Project Semantic Graph (PSG) Types
 *
 * PSG is the "Brain" of the MPLP runtime - modeling entities and state transitions.
 * Per MPLP v1.0: MUST enforce semantic integrity, unique IDs, emit GraphUpdateEvent.
 *
 * PATCH-03: graph_id = context_id
 */

/** PSG node base - all nodes must extend this */
export interface PSGNode {
  type: string;
  id: string;
  context_id?: string; // Most nodes bind to a context
}

/** Graph query interface */
export interface GraphQuery {
  type?: string;
  context_id?: string;
  filter?: Record<string, unknown>;
  limit?: number;
}

/** PSG initialization options */
export interface PSGOptions {
  /** Context ID - also serves as graph_id per PATCH-03 */
  contextId: string;
}

/**
 * Project Semantic Graph interface
 *
 * Core operations per MPLP docs:
 * - getNode: Retrieve node by type and id
 * - putNode: Store or update node (emits GraphUpdateEvent)
 * - deleteNode: Remove node
 * - query: Find nodes matching criteria
 */
export interface ProjectSemanticGraph {
  /** The context/graph ID (PATCH-03: graph_id = context_id) */
  readonly contextId: string;

  /** Get a node by type and id */
  getNode<T extends PSGNode>(type: string, id: string): Promise<T | null>;

  /** Put (create or update) a node - MUST emit GraphUpdateEvent */
  putNode<T extends PSGNode>(node: T): Promise<void>;

  /** Delete a node by type and id - MUST emit GraphUpdateEvent */
  deleteNode(type: string, id: string): Promise<boolean>;

  /** Query nodes */
  query<T extends PSGNode>(query: GraphQuery): Promise<T[]>;

  /** List all node types in the graph */
  listTypes(): Promise<string[]>;
}
