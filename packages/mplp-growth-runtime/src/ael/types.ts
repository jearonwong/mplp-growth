/**
 * Action Execution Layer (AEL) Types
 *
 * AEL is the "CPU" of the MPLP runtime - executing side-effects and external interactions.
 * Per MPLP v1.0: MUST intercept all external requests, validate schemas, emit RuntimeExecutionEvent.
 */

/** Action request - what to execute */
export interface Action {
  action_type: string;
  params: Record<string, unknown>;
  /** Optional timeout in ms */
  timeout_ms?: number;
}

/** Action result - what happened */
export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** Duration in ms */
  duration_ms: number;
}

/** AEL initialization options */
export interface AELOptions {
  /** Context ID for event emission */
  contextId: string;
}

/**
 * Action Execution Layer interface
 *
 * Primary security boundary per MPLP docs.
 */
export interface ActionExecutionLayer {
  /** Execute an action and return result */
  execute(action: Action): Promise<ActionResult>;

  /** Register an action handler */
  registerHandler(actionType: string, handler: ActionHandler): void;
}

/** Handler function for an action type */
export type ActionHandler = (params: Record<string, unknown>) => Promise<unknown>;
