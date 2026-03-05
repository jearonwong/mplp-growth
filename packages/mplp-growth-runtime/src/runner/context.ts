import { AsyncLocalStorage } from "node:async_hooks";

export interface ExecutionContext {
  source?: string;
  run_id?: string;
}

export const executionContext = new AsyncLocalStorage<ExecutionContext>();
