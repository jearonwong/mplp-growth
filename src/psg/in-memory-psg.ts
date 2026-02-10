/**
 * In-Memory PSG Implementation
 * 
 * Simple in-memory graph backed by VSL for persistence.
 * Emits GraphUpdateEvent on all mutations per MPLP v1.0.
 */

import type { ProjectSemanticGraph, PSGNode, PSGOptions, GraphQuery } from './types.js';
import type { ValueStateLayer } from '../vsl/types.js';
import type { EventEmitter, GraphUpdateEvent } from '../glue/event-emitter.js';

/**
 * Extract ID from a node based on its type.
 * MPLP modules use <module>_id (e.g., context_id, plan_id)
 * Domain nodes use generic `id`
 */
function extractNodeId(node: Record<string, unknown>): string {
  const type = node.type as string;
  
  // Domain nodes use `id`
  if (type?.startsWith('domain:')) {
    return node.id as string;
  }
  
  // MPLP modules use type-specific ID fields
  const idFieldMap: Record<string, string> = {
    'Context': 'context_id',
    'Plan': 'plan_id',
    'Trace': 'trace_id',
    'Confirm': 'confirm_id',
    'Role': 'role_id',
    'Dialog': 'dialog_id',
    'Collab': 'collab_id',
    'Extension': 'extension_id',
    'Network': 'network_id',
    'Core': 'core_id',
  };
  
  const idField = idFieldMap[type] || 'id';
  return node[idField] as string || node.id as string;
}

export class InMemoryPSG implements ProjectSemanticGraph {
  readonly contextId: string;
  private readonly nodes: Map<string, PSGNode> = new Map();
  private readonly vsl: ValueStateLayer;
  private readonly eventEmitter: EventEmitter;

  constructor(options: PSGOptions, vsl: ValueStateLayer, eventEmitter: EventEmitter) {
    this.contextId = options.contextId;
    this.vsl = vsl;
    this.eventEmitter = eventEmitter;
  }

  /**
   * Generate storage key for a node
   * Per PATCH-04: VSL path uses type as bucket
   */
  private getNodeKey(type: string, id: string): string {
    return `${type}/${id}`;
  }

  /**
   * In-memory cache key
   */
  private getCacheKey(type: string, id: string): string {
    return `${type}:${id}`;
  }

  async getNode<T extends PSGNode>(type: string, id: string): Promise<T | null> {
    const cacheKey = this.getCacheKey(type, id);
    
    // Check in-memory cache first
    if (this.nodes.has(cacheKey)) {
      return this.nodes.get(cacheKey) as T;
    }
    
    // Fall back to VSL
    const storageKey = this.getNodeKey(type, id);
    const node = await this.vsl.get<T>(storageKey);
    
    if (node) {
      this.nodes.set(cacheKey, node);
    }
    
    return node;
  }

  async putNode<T extends PSGNode>(node: T): Promise<void> {
    // Use extractNodeId to handle MPLP modules (context_id, plan_id, etc.)
    const nodeId = extractNodeId(node as unknown as Record<string, unknown>);
    const cacheKey = this.getCacheKey(node.type, nodeId);
    const storageKey = this.getNodeKey(node.type, nodeId);
    
    const isNew = !this.nodes.has(cacheKey) && !(await this.vsl.exists(storageKey));
    
    // GATE-METRICS-IMMUTABLE-01: MetricSnapshot is append-only, reject updates
    if (node.type === 'domain:MetricSnapshot' && !isNew) {
      throw new Error('MetricSnapshot is immutable: cannot update existing snapshot (GATE-METRICS-IMMUTABLE-01)');
    }
    
    // Update cache
    this.nodes.set(cacheKey, node);
    
    // Persist to VSL
    await this.vsl.set(storageKey, node);
    
    // Emit GraphUpdateEvent (REQUIRED for v1.0)
    const event = this.eventEmitter.createGraphUpdateEvent(
      isNew ? 'node_created' : 'node_updated',
      isNew ? 'node_add' : 'node_update',
      isNew ? 1 : 0,  // node_delta
      0,              // edge_delta
      node.type
    );
    
    this.eventEmitter.emit(event);
    await this.vsl.appendEvent(event);
  }

  async deleteNode(type: string, id: string): Promise<boolean> {
    const cacheKey = this.getCacheKey(type, id);
    const storageKey = this.getNodeKey(type, id);
    
    // Remove from cache
    this.nodes.delete(cacheKey);
    
    // Remove from VSL
    const deleted = await this.vsl.delete(storageKey);
    
    if (deleted) {
      // Emit GraphUpdateEvent
      const event = this.eventEmitter.createGraphUpdateEvent(
        'node_deleted',
        'node_delete',
        -1,  // node_delta
        0,   // edge_delta
        type
      );
      
      this.eventEmitter.emit(event);
      await this.vsl.appendEvent(event);
    }
    
    return deleted;
  }

  async query<T extends PSGNode>(query: GraphQuery): Promise<T[]> {
    const results: T[] = [];
    const prefix = query.type || '';
    
    // List all keys and filter
    const keys = await this.vsl.listKeys(prefix);
    
    for (const key of keys) {
      const [type, id] = key.split('/');
      const node = await this.getNode<T>(type, id);
      
      if (!node) continue;
      
      // Apply filters
      if (query.context_id && node.context_id !== query.context_id) continue;
      
      if (query.filter) {
        let match = true;
        for (const [k, v] of Object.entries(query.filter)) {
          if ((node as Record<string, unknown>)[k] !== v) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }
      
      results.push(node);
      
      if (query.limit && results.length >= query.limit) break;
    }
    
    return results;
  }

  async listTypes(): Promise<string[]> {
    const types = new Set<string>();
    
    // From cache
    for (const node of this.nodes.values()) {
      types.add(node.type);
    }
    
    return Array.from(types);
  }

  /**
   * Load all nodes from VSL into memory
   */
  async loadFromVSL(): Promise<void> {
    const keys = await this.vsl.listKeys('');
    
    for (const key of keys) {
      const node = await this.vsl.get<PSGNode>(key);
      if (node) {
        const cacheKey = this.getCacheKey(node.type, node.id);
        this.nodes.set(cacheKey, node);
      }
    }
  }
}
