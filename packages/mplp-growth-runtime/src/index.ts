/**
 * MPLP Growth Copilot Runtime
 *
 * This package provides the core runtime components for the Growth Copilot:
 * - VSL (Value State Layer): File-based persistent storage
 * - PSG (Project Semantic Graph): In-memory semantic graph with event emission
 * - AEL (Action Execution Layer): OpenClaw tool wrapper for external actions
 * - Event Emitter: GraphUpdateEvent, PipelineStageEvent emission
 *
 * @packageDocumentation
 */

// VSL exports
export { ValueStateLayer, type VSLOptions } from "./vsl/types.js";
export { FileVSL } from "./vsl/file-vsl.js";

// PSG exports
export { ProjectSemanticGraph, type PSGOptions } from "./psg/types.js";
export { InMemoryPSG } from "./psg/in-memory-psg.js";

// AEL exports
export { ActionExecutionLayer, type Action, type ActionResult } from "./ael/types.js";

// Event exports
export {
  EventEmitter,
  type GraphUpdateEvent,
  type PipelineStageEvent,
  type RuntimeExecutionEvent,
} from "./glue/event-emitter.js";

// Module exports (10 MPLP modules)
export * from "./modules/index.js";

// Domain Node exports
export * from "./psg/growth-nodes.js";
