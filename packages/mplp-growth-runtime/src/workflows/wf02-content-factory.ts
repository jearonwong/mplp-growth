/**
 * WF-02: Content Factory Workflow
 *
 * Input: asset_type, audience?, channels?, topic?
 * Output: Plan + Trace + Confirm + ContentAsset (draft)
 *
 * Steps:
 * 1. load_context: Load Brand, Audiences, ChannelProfiles
 * 2. generate_draft: Create ContentAsset with initial content (LLM simulation)
 * 3. format_variants: Generate platform variants
 * 4. review_gate: Create Confirm for review
 * 5. persist: Write to PSG
 */

import { v4 as uuidv4 } from "uuid";
import type { EventEmitter } from "../glue/event-emitter";
import type { ProjectSemanticGraph } from "../psg/types";
import type { ValueStateLayer } from "../vsl/types";
import {
  createPlan,
  createTrace,
  createConfirm,
  type Plan,
  type Trace,
  type Confirm,
  type Context,
  type BrandPolicy,
  type AudienceSegment,
} from "../modules/mplp-modules";
import {
  createContentAsset,
  type ContentAssetNode,
  type ChannelProfileNode,
} from "../psg/growth-nodes";
import {
  type ContentFactoryInput,
  type WorkflowRunResult,
  createStep,
  generateRunId,
} from "./types";

interface ContentFactoryContext {
  psg: ProjectSemanticGraph;
  vsl: ValueStateLayer;
  eventEmitter: EventEmitter;
}

/**
 * WF-02 Content Factory Workflow
 */
export async function runContentFactory(
  input: ContentFactoryInput,
  ctx: ContentFactoryContext,
): Promise<WorkflowRunResult> {
  const run_id = generateRunId();
  const { psg, vsl, eventEmitter } = ctx;

  let pipelineStageCount = 0;
  let graphUpdateCount = 0;

  // Track graph updates
  eventEmitter.on("graph_update", () => {
    graphUpdateCount++;
  });

  // Helper to emit stage event
  const emitStage = async (
    stageId: string,
    stageName: string,
    status: "running" | "completed" | "failed",
    stageOrder: number,
  ) => {
    const event = eventEmitter.createPipelineStageEvent(
      `wf02_${stageId}_${status}`,
      run_id,
      stageId,
      status,
      stageName,
      stageOrder,
    );
    eventEmitter.emit(event);
    await vsl.appendEvent(event);
    if (status === "completed") {
      pipelineStageCount++;
    }
  };

  try {
    // ========================================================================
    // Stage 1: load_context
    // ========================================================================
    await emitStage("load_context", "Load Context", "running", 0);

    // Load Context
    const contexts = await psg.query<Context>({
      type: "Context",
      filter: { context_id: input.context_id },
    });

    if (contexts.length === 0) {
      throw new Error(`Context not found: ${input.context_id}`);
    }
    const context = contexts[0];

    const brand = context.root.brand;
    const audiences = context.root.audiences || [];

    if (!brand) {
      throw new Error("Context has no brand defined");
    }

    // Select audience
    let selectedAudience: AudienceSegment | undefined;
    if (input.audience) {
      selectedAudience = audiences.find((a) => a.segment === input.audience);
    } else if (audiences.length > 0) {
      selectedAudience = audiences[0]; // Default to first
    }

    // Load channel profiles
    const channelProfiles = await psg.query<ChannelProfileNode>({
      type: "domain:ChannelProfile",
      context_id: input.context_id,
      filter: { status: "active" },
    });

    // Filter by requested channels if specified
    let targetChannels = channelProfiles;
    if (input.channels && input.channels.length > 0) {
      targetChannels = channelProfiles.filter((c) => input.channels!.includes(c.platform));
    }

    await emitStage("load_context", "Load Context", "completed", 0);

    // ========================================================================
    // Stage 2: generate_draft
    // ========================================================================
    await emitStage("generate_draft", "Generate Draft", "running", 1);

    // Generate asset ID first (for Plan steps)
    const assetId = uuidv4();

    // Create Plan
    const plan = createPlan({
      context_id: input.context_id,
      title: `Create ${input.asset_type} — ${input.topic || "New Content"}`,
      objective: `Generate ${input.asset_type} for ${selectedAudience?.segment || "general"} audience`,
      steps: [
        createStep("Load brand and audience context", "create", assetId),
        createStep("Generate initial draft", "create", assetId),
        createStep("Format for target platforms", "format", assetId),
        createStep("Review gate (requires approval)", "update", assetId),
        createStep("Persist to PSG", "update", assetId),
      ],
    });
    plan.status = "in_progress";
    await psg.putNode(plan as any);

    // Simulate LLM content generation
    const generatedContent = generateContent(
      input.asset_type,
      brand,
      selectedAudience,
      input.topic,
    );

    // Create ContentAsset
    const asset = createContentAsset({
      context_id: input.context_id,
      asset_type: input.asset_type,
      title: input.topic || `${input.asset_type} for ${selectedAudience?.segment || "general"}`,
      content: generatedContent,
      plan_id: plan.plan_id,
    });
    // Override the auto-generated ID
    (asset as any).id = assetId;

    await psg.putNode(asset);

    await emitStage("generate_draft", "Generate Draft", "completed", 1);

    // ========================================================================
    // Stage 3: format_variants
    // ========================================================================
    await emitStage("format_variants", "Format Variants", "running", 2);

    // Generate platform variants
    const variants: Record<string, string> = {};
    for (const channel of targetChannels) {
      variants[channel.platform] = formatForChannel(
        generatedContent,
        channel.format_rules as Record<string, unknown>,
      );
    }

    // Update asset with variants
    const assetWithVariants: ContentAssetNode = {
      ...asset,
      platform_variants: variants,
    };
    await psg.putNode(assetWithVariants);

    await emitStage("format_variants", "Format Variants", "completed", 2);

    // ========================================================================
    // Stage 4: review_gate
    // ========================================================================
    await emitStage("review_gate", "Review Gate", "running", 3);

    // Create Confirm (REQUIRED: target_type=other for domain nodes)
    const confirm = createConfirm({
      target_type: "other",
      target_id: assetId,
      requested_by_role: "growth-copilot",
    });
    await psg.putNode(confirm as any);

    // Create Trace with plan_id binding
    const trace = createTrace({
      context_id: input.context_id,
      plan_id: plan.plan_id,
      root_span_name: `wf02-content-factory-${run_id}`,
    });
    trace.status = "running";
    await psg.putNode(trace as any);

    await emitStage("review_gate", "Review Gate", "completed", 3);

    // ========================================================================
    // Stage 5: persist
    // ========================================================================
    await emitStage("persist", "Persist", "running", 4);

    // For MVP: auto-approve and update to reviewed
    const approvedConfirm: Confirm = {
      ...confirm,
      status: "approved",
      decisions: [
        {
          decision_id: uuidv4(),
          status: "approved",
          decided_by_role: "growth-copilot",
          decided_at: new Date().toISOString(),
          reason: "Auto-approved for MVP demonstration",
        },
      ],
    };
    await psg.putNode(approvedConfirm as any);

    // Update asset status to reviewed
    const reviewedAsset: ContentAssetNode = {
      ...assetWithVariants,
      status: "reviewed" as any, // After confirm approval
    };
    await psg.putNode(reviewedAsset);

    // Update Plan to completed
    plan.status = "completed";
    plan.steps = plan.steps.map((s) => ({ ...s, status: "completed" as const }));
    await psg.putNode(plan as any);

    // Update Trace to completed
    trace.status = "completed";
    trace.finished_at = new Date().toISOString();
    if (trace.root_span) {
      trace.root_span.finished_at = trace.finished_at;
    }
    await psg.putNode(trace as any);

    await emitStage("persist", "Persist", "completed", 4);

    return {
      run_id,
      workflow_id: "WF-02",
      success: true,
      plan,
      trace,
      confirm: approvedConfirm,
      outputs: {
        asset_id: assetId,
        asset_type: input.asset_type,
        title: asset.title,
        variants: Object.keys(variants),
        content_preview: generatedContent.slice(0, 200) + "...",
      },
      events: {
        pipeline_stage_count: pipelineStageCount,
        graph_update_count: graphUpdateCount,
        runtime_execution_count: 0,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    return {
      run_id,
      workflow_id: "WF-02",
      success: false,
      plan: null as any,
      trace: null as any,
      outputs: {},
      events: {
        pipeline_stage_count: pipelineStageCount,
        graph_update_count: graphUpdateCount,
        runtime_execution_count: 0,
      },
      error: errorMsg,
    };
  }
}

/**
 * Simulate LLM content generation
 */
function generateContent(
  assetType: ContentAssetNode["asset_type"],
  brand: BrandPolicy,
  audience?: AudienceSegment,
  topic?: string,
): string {
  const audienceContext = audience
    ? `Target: ${audience.segment}\nPain points: ${audience.pain_points.join(", ")}\nValue prop: ${audience.value_proposition}`
    : "General audience";

  const templates: Record<string, string> = {
    thread: `🧵 Thread: ${topic || brand.tagline}

1/ ${brand.name} — ${brand.positioning}

${audienceContext}

2/ Why does this matter?
[Content about the problem space]

3/ The approach:
[Technical details]

4/ Key benefits:
• Observable by design
• Vendor-neutral
• Evidence-first

5/ Want to learn more?
${Object.entries(brand.links)
  .map(([k, v]) => `• ${k}: ${v}`)
  .join("\n")}

---
Generated by MPLP Growth Copilot`,

    post: `${brand.name} — ${brand.tagline}

${topic || brand.positioning}

${audienceContext}

Key points:
• Vendor-neutral protocol
• Observable governance
• Evidence-first validation

Learn more: ${brand.links.docs}`,

    article: `# ${topic || brand.name}

## Introduction

${brand.positioning}

## The Problem

${audience?.pain_points.join("\n- ") || "Multi-agent systems lack interoperability."}

## The Solution

${brand.name} provides a vendor-neutral protocol for multi-agent orchestration.

## Technical Details

[Detailed technical content]

## Conclusion

${audience?.cta || "Check out the documentation."}

---
*${brand.tagline}*`,

    video_script: `[INTRO - 15s]
Hook: "${topic || "Have you ever wondered how multi-agent systems work together?"}"

[AGENDA - 30s]
Today we'll cover:
1. The problem with current approaches
2. How ${brand.name} solves it
3. Demo and next steps

[CONTENT - 8min]
${brand.positioning}

[RECAP - 1min]
Key takeaways...

[CTA - 15s]
${audience?.cta || "Visit the docs for more."}`,

    outreach_email: `Subject: ${brand.name} — ${topic || "Collaboration Opportunity"}

Hi [Name],

${brand.positioning}

${audienceContext}

I'd love to discuss how ${brand.name} could be relevant to your work.

Best regards,
[Signature]`,
  };

  return templates[assetType] || templates.post;
}

/**
 * Format content for a specific channel
 */
function formatForChannel(content: string, rules: Record<string, unknown>): string {
  let formatted = content;

  if (rules.max_chars && typeof rules.max_chars === "number") {
    if (formatted.length > rules.max_chars) {
      formatted = formatted.slice(0, rules.max_chars - 3) + "...";
    }
  }

  if (rules.use_emojis === false) {
    // Simple emoji removal
    formatted = formatted.replace(/[\u{1F300}-\u{1F9FF}]/gu, "");
  }

  return formatted;
}

export { ContentFactoryInput };
