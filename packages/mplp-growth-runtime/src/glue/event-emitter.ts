/**
 * MPLP Event Types and EventEmitter
 *
 * v1.0 REQUIRED events:
 * - GraphUpdateEvent: PSG structural changes (MUST)
 * - PipelineStageEvent: Workflow stage transitions (MUST)
 * - RuntimeExecutionEvent: AEL execution lifecycle (SHOULD)
 *
 * Per PATCH-03: graph_id = context_id
 */

import { v4 as uuidv4 } from "uuid";

// Re-export event types from shared types
export type {
  EventFamily,
  EventCore,
  GraphUpdateEvent,
  PipelineStageEvent,
  RuntimeExecutionEvent,
  MplpEvent,
} from "../types.js";

import type {
  EventFamily,
  GraphUpdateEvent,
  PipelineStageEvent,
  RuntimeExecutionEvent,
  EventCore,
} from "../types.js";

/**
 * EventEmitter for MPLP events
 */
export class EventEmitter {
  private readonly contextId: string;
  private readonly listeners: Map<EventFamily, ((event: EventCore) => void)[]> = new Map();

  constructor(contextId: string) {
    this.contextId = contextId;
  }

  /** Create a GraphUpdateEvent (PATCH-03: graph_id = context_id) */
  createGraphUpdateEvent(
    eventType: string,
    updateKind: GraphUpdateEvent["update_kind"],
    nodeDelta: number,
    edgeDelta: number,
    sourceModule?: string,
  ): GraphUpdateEvent {
    return {
      event_id: uuidv4(),
      event_type: eventType,
      event_family: "graph_update",
      timestamp: new Date().toISOString(),
      project_id: this.contextId,
      graph_id: this.contextId, // PATCH-03
      update_kind: updateKind,
      node_delta: nodeDelta,
      edge_delta: edgeDelta,
      source_module: sourceModule,
    };
  }

  /** Create a PipelineStageEvent */
  createPipelineStageEvent(
    eventType: string,
    pipelineId: string,
    stageId: string,
    stageStatus: PipelineStageEvent["stage_status"],
    stageName?: string,
    stageOrder?: number,
  ): PipelineStageEvent {
    return {
      event_id: uuidv4(),
      event_type: eventType,
      event_family: "pipeline_stage",
      timestamp: new Date().toISOString(),
      project_id: this.contextId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      stage_name: stageName,
      stage_status: stageStatus,
      stage_order: stageOrder,
    };
  }

  /** Create a RuntimeExecutionEvent */
  createRuntimeExecutionEvent(
    eventType: string,
    executionId: string,
    executorKind: RuntimeExecutionEvent["executor_kind"],
    status: RuntimeExecutionEvent["status"],
    executorRole?: string,
  ): RuntimeExecutionEvent {
    return {
      event_id: uuidv4(),
      event_type: eventType,
      event_family: "runtime_execution",
      timestamp: new Date().toISOString(),
      project_id: this.contextId,
      execution_id: executionId,
      executor_kind: executorKind,
      executor_role: executorRole,
      status,
    };
  }

  /** Subscribe to events */
  on(family: EventFamily, listener: (event: EventCore) => void): void {
    const existing = this.listeners.get(family) || [];
    existing.push(listener);
    this.listeners.set(family, existing);
  }

  /** Emit an event to all subscribers */
  emit(event: EventCore): void {
    const listeners = this.listeners.get(event.event_family) || [];
    for (const listener of listeners) {
      listener(event);
    }
  }
}
