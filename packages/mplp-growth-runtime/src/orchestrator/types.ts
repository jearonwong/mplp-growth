/**
 * Pipeline/Orchestrator Types
 */

import type { PipelineStageEvent } from "../glue/event-emitter.js";

export type StageStatus = PipelineStageEvent["stage_status"];

/** Pipeline stage definition */
export interface PipelineStage {
  stage_id: string;
  stage_name: string;
  requires_confirm?: boolean;
  timeout_ms?: number;
}

/** Pipeline definition */
export interface PipelineDefinition {
  pipeline_id: string;
  name: string;
  stages: PipelineStage[];
}

/** Stage execution result */
export interface StageResult {
  stage_id: string;
  status: StageStatus;
  output?: unknown;
  error?: string;
  duration_ms: number;
}

/** Pipeline execution result */
export interface PipelineResult {
  pipeline_id: string;
  status: "completed" | "failed" | "cancelled";
  stages: StageResult[];
  confirmed?: boolean;
  total_duration_ms: number;
}

/** Stage handler function */
export type StageHandler = (stageInput: unknown, context: StageContext) => Promise<unknown>;

/** Context passed to stage handlers */
export interface StageContext {
  pipeline_id: string;
  stage_id: string;
  context_id: string;
}

/** Orchestrator interface */
export interface Orchestrator {
  /** Register a pipeline definition */
  registerPipeline(definition: PipelineDefinition): void;

  /** Register a handler for a stage */
  registerStageHandler(stageId: string, handler: StageHandler): void;

  /** Run a pipeline */
  run(pipelineId: string, input: unknown): Promise<PipelineResult>;
}
