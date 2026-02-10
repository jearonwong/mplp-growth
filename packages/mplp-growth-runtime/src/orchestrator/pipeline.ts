/**
 * Pipeline Executor
 *
 * Runs pipelines and emits PipelineStageEvent at each transition.
 */

import { v4 as uuidv4 } from "uuid";
import type { EventEmitter } from "../glue/event-emitter.js";
import type { ValueStateLayer } from "../vsl/types.js";
import type {
  Orchestrator,
  PipelineDefinition,
  PipelineResult,
  StageHandler,
  StageResult,
  StageContext,
} from "./types.js";

export class PipelineExecutor implements Orchestrator {
  private readonly contextId: string;
  private readonly eventEmitter: EventEmitter;
  private readonly vsl: ValueStateLayer;
  private readonly pipelines: Map<string, PipelineDefinition> = new Map();
  private readonly handlers: Map<string, StageHandler> = new Map();

  constructor(contextId: string, eventEmitter: EventEmitter, vsl: ValueStateLayer) {
    this.contextId = contextId;
    this.eventEmitter = eventEmitter;
    this.vsl = vsl;
  }

  registerPipeline(definition: PipelineDefinition): void {
    this.pipelines.set(definition.pipeline_id, definition);
  }

  registerStageHandler(stageId: string, handler: StageHandler): void {
    this.handlers.set(stageId, handler);
  }

  async run(pipelineId: string, input: unknown): Promise<PipelineResult> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    const runId = uuidv4();
    const stageResults: StageResult[] = [];
    const startTime = Date.now();
    let currentInput = input;
    let pipelineStatus: PipelineResult["status"] = "completed";

    for (let i = 0; i < pipeline.stages.length; i++) {
      const stage = pipeline.stages[i];
      const stageStartTime = Date.now();

      // Emit "running" event
      const runningEvent = this.eventEmitter.createPipelineStageEvent(
        "stage_started",
        runId,
        stage.stage_id,
        "running",
        stage.stage_name,
        i,
      );
      this.eventEmitter.emit(runningEvent);
      await this.vsl.appendEvent(runningEvent);

      try {
        const handler = this.handlers.get(stage.stage_id);
        if (!handler) {
          throw new Error(`No handler for stage: ${stage.stage_id}`);
        }

        const context: StageContext = {
          pipeline_id: pipelineId,
          stage_id: stage.stage_id,
          context_id: this.contextId,
        };

        const output = await handler(currentInput, context);
        const duration = Date.now() - stageStartTime;

        stageResults.push({
          stage_id: stage.stage_id,
          status: "completed",
          output,
          duration_ms: duration,
        });

        // Emit "completed" event
        const completedEvent = this.eventEmitter.createPipelineStageEvent(
          "stage_completed",
          runId,
          stage.stage_id,
          "completed",
          stage.stage_name,
          i,
        );
        this.eventEmitter.emit(completedEvent);
        await this.vsl.appendEvent(completedEvent);

        currentInput = output;
      } catch (error) {
        const duration = Date.now() - stageStartTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        stageResults.push({
          stage_id: stage.stage_id,
          status: "failed",
          error: errorMessage,
          duration_ms: duration,
        });

        // Emit "failed" event
        const failedEvent = this.eventEmitter.createPipelineStageEvent(
          "stage_failed",
          runId,
          stage.stage_id,
          "failed",
          stage.stage_name,
          i,
        );
        this.eventEmitter.emit(failedEvent);
        await this.vsl.appendEvent(failedEvent);

        pipelineStatus = "failed";
        break;
      }
    }

    return {
      pipeline_id: pipelineId,
      status: pipelineStatus,
      stages: stageResults,
      total_duration_ms: Date.now() - startTime,
    };
  }
}
