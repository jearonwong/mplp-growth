/**
 * OpenClaw AEL Implementation
 * 
 * Wraps OpenClaw tools for AEL execution.
 * Emits RuntimeExecutionEvent for all executions.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ActionExecutionLayer, Action, ActionResult, ActionHandler, AELOptions } from './types.js';
import type { EventEmitter } from '../glue/event-emitter.js';
import type { ValueStateLayer } from '../vsl/types.js';

export class OpenClawAEL implements ActionExecutionLayer {
  private readonly contextId: string;
  private readonly handlers: Map<string, ActionHandler> = new Map();
  private readonly eventEmitter: EventEmitter;
  private readonly vsl: ValueStateLayer;

  constructor(options: AELOptions, eventEmitter: EventEmitter, vsl: ValueStateLayer) {
    this.contextId = options.contextId;
    this.eventEmitter = eventEmitter;
    this.vsl = vsl;
  }

  registerHandler(actionType: string, handler: ActionHandler): void {
    this.handlers.set(actionType, handler);
  }

  async execute(action: Action): Promise<ActionResult> {
    const executionId = uuidv4();
    const startTime = Date.now();
    
    // Emit "running" event
    const runningEvent = this.eventEmitter.createRuntimeExecutionEvent(
      'execution_started',
      executionId,
      'tool',
      'running'
    );
    this.eventEmitter.emit(runningEvent);
    await this.vsl.appendEvent(runningEvent);

    try {
      const handler = this.handlers.get(action.action_type);
      
      if (!handler) {
        throw new Error(`No handler registered for action type: ${action.action_type}`);
      }
      
      const data = await handler(action.params);
      const duration = Date.now() - startTime;
      
      // Emit "completed" event
      const completedEvent = this.eventEmitter.createRuntimeExecutionEvent(
        'execution_completed',
        executionId,
        'tool',
        'completed'
      );
      this.eventEmitter.emit(completedEvent);
      await this.vsl.appendEvent(completedEvent);
      
      return { success: true, data, duration_ms: duration };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Emit "failed" event
      const failedEvent = this.eventEmitter.createRuntimeExecutionEvent(
        'execution_failed',
        executionId,
        'tool',
        'failed'
      );
      this.eventEmitter.emit(failedEvent);
      await this.vsl.appendEvent(failedEvent);
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration 
      };
    }
  }
}
