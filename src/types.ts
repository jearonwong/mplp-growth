/**
 * Shared Types
 * 
 * Common types used across VSL, PSG, AEL, and EventEmitter to avoid circular imports.
 */

/** Event family classification */
export type EventFamily = 
  | 'graph_update' 
  | 'pipeline_stage' 
  | 'runtime_execution';

/** Base event fields (from mplp-event-core.schema.json) */
export interface EventCore {
  event_id: string;        // UUID v4
  event_type: string;      // Specific subtype
  event_family: EventFamily;
  timestamp: string;       // ISO 8601
  project_id?: string;     // context_id
}

/** GraphUpdateEvent - REQUIRED for v1.0 */
export interface GraphUpdateEvent extends EventCore {
  event_family: 'graph_update';
  graph_id: string;        // = context_id per PATCH-03
  update_kind: 'node_add' | 'node_update' | 'node_delete' | 'edge_add' | 'edge_update' | 'edge_delete' | 'bulk';
  node_delta: number;
  edge_delta: number;
  source_module?: string;  // e.g., 'context', 'plan', 'domain:ContentAsset'
}

/** PipelineStageEvent - REQUIRED for v1.0 */
export interface PipelineStageEvent extends EventCore {
  event_family: 'pipeline_stage';
  pipeline_id: string;     // UUID v4
  stage_id: string;
  stage_name?: string;
  stage_status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  stage_order?: number;
}

/** RuntimeExecutionEvent - RECOMMENDED */
export interface RuntimeExecutionEvent extends EventCore {
  event_family: 'runtime_execution';
  execution_id: string;    // UUID v4
  executor_kind: 'agent' | 'tool' | 'llm' | 'worker' | 'external';
  executor_role?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

/** Any MPLP event that can be appended to the event log */
export type MplpEvent = GraphUpdateEvent | PipelineStageEvent | RuntimeExecutionEvent;
