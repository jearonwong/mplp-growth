/**
 * MPLP Module Types and Constructors
 *
 * 10 MPLP L2 Modules with required field validation per SSOT schemas.
 * Implementation follows the sealed implementation_plan.md contracts.
 */

import { v4 as uuidv4 } from "uuid";

// ============================================================================
// Common Types
// ============================================================================

/** Metadata block required by all modules */
export interface ModuleMeta {
  schema_version: string;
  created_at: string;
  updated_at: string;
}

/** Create default meta */
export function createMeta(): ModuleMeta {
  const now = new Date().toISOString();
  return {
    schema_version: "1.0.0",
    created_at: now,
    updated_at: now,
  };
}

// ============================================================================
// Core Module (Protocol manifest)
// ============================================================================

export type ModuleId =
  | "context"
  | "plan"
  | "confirm"
  | "trace"
  | "role"
  | "extension"
  | "dialog"
  | "collab"
  | "core"
  | "network";

export interface ModuleDescriptor {
  module_id: ModuleId;
  version: string;
  status: "enabled" | "disabled";
  required?: boolean;
  description?: string;
}

export interface Core {
  type: "Core";
  meta: ModuleMeta;
  core_id: string;
  protocol_version: string;
  status: "active" | "deprecated";
  modules: ModuleDescriptor[];
}

export function createCore(modules: ModuleDescriptor[]): Core {
  if (modules.length === 0) {
    throw new Error("Core: modules must have at least 1 module");
  }
  return {
    type: "Core",
    meta: createMeta(),
    core_id: uuidv4(),
    protocol_version: "1.0.0",
    status: "active",
    modules,
  };
}

// ============================================================================
// Context Module (World state)
// ============================================================================

export type ContextStatus = "draft" | "active" | "suspended" | "archived" | "closed";

/** Brand policy (lives in Context.root per PATCH-02) */
export interface BrandPolicy {
  name: string;
  tagline: string;
  positioning: string;
  forbidden_terms: string[];
  links: Record<string, string>;
}

/** Audience segment (lives in Context.root per PATCH-02) */
export interface AudienceSegment {
  segment: "developers" | "enterprise" | "standards";
  pain_points: string[];
  value_proposition: string;
  cta: string;
}

export interface ContextRoot {
  domain: string;
  environment: string;
  // Growth-specific extensions per PATCH-02
  brand?: BrandPolicy;
  audiences?: AudienceSegment[];
  cadence?: Record<string, unknown>;
}

export interface Context {
  type: "Context";
  meta: ModuleMeta;
  context_id: string;
  root: ContextRoot;
  title: string;
  status: ContextStatus;
  owner_role?: string;
  constraints?: Record<string, unknown>;
}

export interface CreateContextInput {
  title: string;
  domain: string;
  environment: string;
  owner_role?: string;
  brand?: BrandPolicy;
  audiences?: AudienceSegment[];
}

export function createContext(input: CreateContextInput): Context {
  return {
    type: "Context",
    meta: createMeta(),
    context_id: uuidv4(),
    root: {
      domain: input.domain,
      environment: input.environment,
      brand: input.brand,
      audiences: input.audiences,
    },
    title: input.title,
    status: "draft",
    owner_role: input.owner_role,
  };
}

/** SA invariant: sa_context_must_be_active */
export function validateContextActive(context: Context): void {
  if (context.status !== "active") {
    throw new Error(`Context ${context.context_id} must be active, got: ${context.status}`);
  }
}

// ============================================================================
// Role Module (Permissions)
// ============================================================================

export interface Role {
  type: "Role";
  meta: ModuleMeta;
  role_id: string;
  name: string;
  capabilities?: string[]; // resource.action pattern
  description?: string;
}

export function createRole(name: string, capabilities?: string[]): Role {
  return {
    type: "Role",
    meta: createMeta(),
    role_id: uuidv4(),
    name,
    capabilities,
  };
}

// ============================================================================
// Plan Module (Task decomposition)
// ============================================================================

export type PlanStatus =
  | "draft"
  | "proposed"
  | "approved"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "failed";
export type StepStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

export interface PlanStep {
  step_id: string;
  description: string;
  status: StepStatus;
  dependencies?: string[];
  agent_role?: string;
  order_index: number;
  // Contract-PLAN-02: Steps are operations, not entities
  action?: "create" | "update" | "format" | "publish" | "outreach";
  target_node_id?: string;
}

export interface Plan {
  type: "Plan";
  meta: ModuleMeta;
  plan_id: string;
  context_id: string;
  title: string;
  objective: string;
  status: PlanStatus;
  steps: PlanStep[];
}

export interface CreatePlanInput {
  context_id: string;
  title: string;
  objective: string;
  steps: Omit<PlanStep, "step_id" | "order_index">[];
}

export function createPlan(input: CreatePlanInput): Plan {
  if (input.steps.length === 0) {
    throw new Error("Plan: steps must have at least 1 step (sa_plan_has_steps)");
  }

  return {
    type: "Plan",
    meta: createMeta(),
    plan_id: uuidv4(),
    context_id: input.context_id,
    title: input.title,
    objective: input.objective,
    status: "draft",
    steps: input.steps.map((step, idx) => ({
      ...step,
      step_id: uuidv4(),
      order_index: idx,
    })),
  };
}

// ============================================================================
// Trace Module (Execution audit)
// ============================================================================

export type TraceStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface TraceSpan {
  span_id: string;
  name: string;
  started_at: string;
  finished_at?: string;
}

export interface TraceSegment {
  segment_id: string;
  name: string;
  started_at: string;
  finished_at?: string;
  events?: unknown[];
}

export interface Trace {
  type: "Trace";
  meta: ModuleMeta;
  trace_id: string;
  context_id: string;
  root_span: TraceSpan; // REQUIRED per GATE-TRACE-ROOTSPAN-01
  status: TraceStatus;
  plan_id?: string;
  started_at: string;
  finished_at?: string;
  segments?: TraceSegment[];
}

export interface CreateTraceInput {
  context_id: string;
  plan_id?: string;
  root_span_name: string;
}

export function createTrace(input: CreateTraceInput): Trace {
  const now = new Date().toISOString();
  const rootSpan: TraceSpan = {
    span_id: uuidv4(),
    name: input.root_span_name,
    started_at: now,
  };

  // GATE-TRACE-ROOTSPAN-01: root_span must never be empty
  if (!rootSpan.span_id) {
    throw new Error("Trace: root_span.span_id is required (GATE-TRACE-ROOTSPAN-01)");
  }

  return {
    type: "Trace",
    meta: createMeta(),
    trace_id: uuidv4(),
    context_id: input.context_id,
    root_span: rootSpan,
    status: "pending",
    plan_id: input.plan_id,
    started_at: now,
  };
}

// ============================================================================
// Confirm Module (Approval workflow)
// ============================================================================

export type ConfirmStatus = "pending" | "approved" | "rejected" | "expired";
export type ConfirmTargetType = "context" | "plan" | "trace" | "extension" | "other";

const VALID_TARGET_TYPES: ConfirmTargetType[] = ["context", "plan", "trace", "extension", "other"];

export interface ConfirmDecision {
  decision_id: string;
  status: "approved" | "rejected";
  decided_by_role: string;
  decided_at: string;
  reason?: string;
}

export interface Confirm {
  type: "Confirm";
  meta: ModuleMeta;
  confirm_id: string;
  target_type: ConfirmTargetType; // GATE-CONFIRM-TARGETTYPE-01
  target_id: string;
  status: ConfirmStatus;
  requested_by_role: string;
  requested_at: string;
  decisions?: ConfirmDecision[];
}

export interface CreateConfirmInput {
  target_type: ConfirmTargetType;
  target_id: string;
  requested_by_role: string;
}

export function createConfirm(input: CreateConfirmInput): Confirm {
  // GATE-CONFIRM-TARGETTYPE-01
  if (!VALID_TARGET_TYPES.includes(input.target_type)) {
    throw new Error(
      `Confirm: target_type must be one of ${VALID_TARGET_TYPES.join(", ")} (GATE-CONFIRM-TARGETTYPE-01)`,
    );
  }

  return {
    type: "Confirm",
    meta: createMeta(),
    confirm_id: uuidv4(),
    target_type: input.target_type,
    target_id: input.target_id,
    status: "pending",
    requested_by_role: input.requested_by_role,
    requested_at: new Date().toISOString(),
  };
}

// ============================================================================
// Dialog Module (Conversations)
// ============================================================================

export type DialogStatus = "open" | "closed" | "paused";
export type MessageRole = "user" | "assistant" | "system" | "agent";

export interface DialogMessage {
  role: MessageRole;
  content: string;
  timestamp: string;
}

export interface Dialog {
  type: "Dialog";
  meta: ModuleMeta;
  dialog_id: string;
  context_id: string;
  status: DialogStatus;
  messages: DialogMessage[];
  thread_id?: string;
  started_at?: string;
  ended_at?: string;
}

export function createDialog(context_id: string, initialMessage?: DialogMessage): Dialog {
  const messages = initialMessage ? [initialMessage] : [];

  return {
    type: "Dialog",
    meta: createMeta(),
    dialog_id: uuidv4(),
    context_id,
    status: "open",
    messages,
    started_at: new Date().toISOString(),
  };
}

// ============================================================================
// Collab Module (Multi-agent sessions)
// ============================================================================

export type CollabMode = "broadcast" | "round_robin" | "orchestrated" | "swarm" | "pair";
export type CollabStatus = "pending" | "active" | "paused" | "completed" | "cancelled";
export type ParticipantKind = "agent" | "human" | "system" | "external";

export interface CollabParticipant {
  participant_id: string;
  role_id?: string;
  kind: ParticipantKind;
  display_name: string;
}

export interface Collab {
  type: "Collab";
  meta: ModuleMeta;
  collab_id: string;
  context_id: string;
  title: string;
  purpose: string;
  mode: CollabMode;
  status: CollabStatus;
  participants: CollabParticipant[];
  created_at: string;
}

export interface CreateCollabInput {
  context_id: string;
  title: string;
  purpose: string;
  mode: CollabMode;
  participants: Omit<CollabParticipant, "participant_id">[];
}

export function createCollab(input: CreateCollabInput): Collab {
  if (input.participants.length === 0) {
    throw new Error("Collab: participants must have at least 1 participant");
  }

  return {
    type: "Collab",
    meta: createMeta(),
    collab_id: uuidv4(),
    context_id: input.context_id,
    title: input.title,
    purpose: input.purpose,
    mode: input.mode,
    status: "pending",
    participants: input.participants.map((p) => ({
      ...p,
      participant_id: uuidv4(),
    })),
    created_at: new Date().toISOString(),
  };
}

// ============================================================================
// Extension Module (Plugin system)
// ============================================================================

export type ExtensionType =
  | "capability"
  | "policy"
  | "integration"
  | "transformation"
  | "validation"
  | "other";
export type ExtensionStatus = "active" | "inactive" | "deprecated";

// GATE-EXTENSION-SEMVER-01
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-.+)?$/;

export interface Extension {
  type: "Extension";
  meta: ModuleMeta;
  extension_id: string;
  context_id: string;
  name: string;
  extension_type: ExtensionType;
  version: string; // Must be SemVer
  status: ExtensionStatus;
  config?: Record<string, unknown>;
}

export interface CreateExtensionInput {
  context_id: string;
  name: string;
  extension_type: ExtensionType;
  version: string;
  config?: Record<string, unknown>;
}

export function createExtension(input: CreateExtensionInput): Extension {
  // GATE-EXTENSION-SEMVER-01
  if (!SEMVER_RE.test(input.version)) {
    throw new Error(
      `Extension: version must be SemVer format (GATE-EXTENSION-SEMVER-01), got: ${input.version}`,
    );
  }

  return {
    type: "Extension",
    meta: createMeta(),
    extension_id: uuidv4(),
    context_id: input.context_id,
    name: input.name,
    extension_type: input.extension_type,
    version: input.version,
    status: "active",
    config: input.config,
  };
}

// ============================================================================
// Network Module (Agent topology)
// ============================================================================

export type TopologyType =
  | "single_node"
  | "hub_spoke"
  | "mesh"
  | "hierarchical"
  | "hybrid"
  | "other";
export type NetworkStatus = "active" | "inactive" | "maintenance";
export type NetworkNodeKind = "agent" | "service" | "database" | "gateway" | "external";

export interface NetworkNode {
  node_id: string;
  name: string;
  kind: NetworkNodeKind;
  role_id?: string;
  status: "online" | "offline" | "degraded";
}

export interface Network {
  type: "Network";
  meta: ModuleMeta;
  network_id: string;
  context_id: string;
  name: string;
  topology_type: TopologyType;
  status: NetworkStatus;
  nodes?: NetworkNode[];
}

export interface CreateNetworkInput {
  context_id: string;
  name: string;
  topology_type: TopologyType;
  nodes?: Omit<NetworkNode, "node_id">[];
}

export function createNetwork(input: CreateNetworkInput): Network {
  return {
    type: "Network",
    meta: createMeta(),
    network_id: uuidv4(),
    context_id: input.context_id,
    name: input.name,
    topology_type: input.topology_type,
    status: "active",
    nodes: input.nodes?.map((n) => ({
      ...n,
      node_id: uuidv4(),
    })),
  };
}
