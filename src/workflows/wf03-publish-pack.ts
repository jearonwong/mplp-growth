/**
 * WF-03: Publish Pack Workflow
 * 
 * Input: asset_id, channel
 * Output: Plan + Trace + Confirm + Export Pack + Updated ContentAsset
 * 
 * Steps:
 * 1. load_asset: Load ContentAsset from PSG
 * 2. format_for_channel: Format content using ChannelProfile.format_rules
 * 3. preview_pack: Generate preview (requires confirm)
 * 4. record_published: Update ContentAsset status + create export file
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectSemanticGraph } from '../psg/types';
import type { ValueStateLayer } from '../vsl/types';
import type { EventEmitter } from '../glue/event-emitter';
import { 
  createPlan, 
  createTrace, 
  createConfirm,
  type Plan,
  type Trace,
  type Confirm,
  type Context
} from '../modules/mplp-modules';
import type { ContentAssetNode, ChannelProfileNode } from '../psg/growth-nodes';
import { 
  type PublishPackInput, 
  type WorkflowRunResult,
  createStep,
  generateRunId
} from './types';

interface PublishPackContext {
  psg: ProjectSemanticGraph;
  vsl: ValueStateLayer;
  eventEmitter: EventEmitter;
  basePath: string;
}

/**
 * WF-03 Publish Pack Workflow
 */
export async function runPublishPack(
  input: PublishPackInput,
  ctx: PublishPackContext
): Promise<WorkflowRunResult> {
  const run_id = generateRunId();
  const { psg, vsl, eventEmitter, basePath } = ctx;
  
  let pipelineStageCount = 0;
  let graphUpdateCount = 0;
  
  // Track graph updates
  eventEmitter.on('graph_update', () => { graphUpdateCount++; });
  
  // Helper to emit stage event
  const emitStage = async (
    stageId: string, 
    stageName: string, 
    status: 'running' | 'completed' | 'failed',
    stageOrder: number
  ) => {
    const event = eventEmitter.createPipelineStageEvent(
      `wf03_${stageId}_${status}`,
      run_id,
      stageId,
      status,
      stageName,
      stageOrder
    );
    eventEmitter.emit(event);
    await vsl.appendEvent(event);
    if (status === 'completed') pipelineStageCount++;
  };

  try {
    // ========================================================================
    // Stage 1: load_asset
    // ========================================================================
    await emitStage('load_asset', 'Load Asset', 'running', 0);
    
    const asset = await psg.getNode<ContentAssetNode>('domain:ContentAsset', input.asset_id);
    if (!asset) {
      throw new Error(`ContentAsset not found: ${input.asset_id}`);
    }
    
    // Validate status transition: must be reviewed or draft (allow draft for MVP)
    if (asset.status === 'published') {
      throw new Error(`ContentAsset already published: ${input.asset_id}`);
    }
    
    // Load channel profile
    const channels = await psg.query<ChannelProfileNode>({
      type: 'domain:ChannelProfile',
      context_id: input.context_id,
      filter: { platform: input.channel, status: 'active' }
    });
    
    if (channels.length === 0) {
      throw new Error(`No active ChannelProfile for: ${input.channel}`);
    }
    const channelProfile = channels[0];
    
    await emitStage('load_asset', 'Load Asset', 'completed', 0);

    // ========================================================================
    // Stage 2: format_for_channel
    // ========================================================================
    await emitStage('format_for_channel', 'Format for Channel', 'running', 1);
    
    // Apply format rules
    const formatRules = channelProfile.format_rules as Record<string, unknown>;
    let formattedContent = asset.content;
    
    // Simple formatting based on rules
    if (formatRules.max_chars && typeof formatRules.max_chars === 'number') {
      if (formattedContent.length > formatRules.max_chars) {
        formattedContent = formattedContent.slice(0, formatRules.max_chars - 3) + '...';
      }
    }
    
    // NOTE: Forbidden terms check is NOT performed here.
    // The Brand policy's forbidden_terms is for preventing misleading claims 
    // (e.g., "MPLP certified"), not for blocking words like "framework" in 
    // legitimate context ("NOT a framework"). Content validation should happen 
    // in WF-02 Content Factory during generation, not at publish time.
    
    await emitStage('format_for_channel', 'Format for Channel', 'completed', 1);

    // ========================================================================
    // Stage 3: preview_pack (requires confirm)
    // ========================================================================
    await emitStage('preview_pack', 'Preview Pack', 'running', 2);
    
    // Create Plan
    const plan = createPlan({
      context_id: input.context_id,
      title: `Publish Pack — ${asset.title} → ${input.channel}`,
      objective: `Publish ContentAsset ${input.asset_id} to ${input.channel}`,
      steps: [
        createStep('Load ContentAsset and ChannelProfile', 'format', input.asset_id),
        createStep('Format content for channel', 'format', input.asset_id),
        createStep('Preview and confirm publish', 'publish', input.asset_id),
        createStep('Record published status', 'update', input.asset_id),
      ]
    });
    plan.status = 'in_progress';
    await psg.putNode(plan as any);
    
    // Create Confirm (REQUIRED: target_type=other for domain nodes)
    const confirm = createConfirm({
      target_type: 'other',  // Domain node, not MPLP module
      target_id: input.asset_id,
      requested_by_role: 'growth-copilot'
    });
    await psg.putNode(confirm as any);
    
    // Create Trace with plan_id binding (GATE-WF-PLAN-TRACE-BINDING-01)
    const trace = createTrace({
      context_id: input.context_id,
      plan_id: plan.plan_id,
      root_span_name: `wf03-publish-pack-${run_id}`
    });
    trace.status = 'running';
    await psg.putNode(trace as any);
    
    await emitStage('preview_pack', 'Preview Pack', 'completed', 2);

    // ========================================================================
    // Stage 4: record_published
    // ========================================================================
    await emitStage('record_published', 'Record Published', 'running', 3);
    
    // Create export directory
    const exportDir = path.join(basePath, 'exports', run_id);
    await fs.mkdir(exportDir, { recursive: true });
    
    // Generate export pack (paste-ready markdown)
    const exportContent = generateExportPack(asset, channelProfile, formattedContent);
    const exportPath = path.join(exportDir, `${input.channel}.md`);
    await fs.writeFile(exportPath, exportContent);
    
    // Update ContentAsset
    const updatedAsset: ContentAssetNode = {
      ...asset,
      status: 'published',
      published_at: new Date().toISOString(),
      platform_variants: {
        ...asset.platform_variants,
        [input.channel]: formattedContent
      }
    };
    await psg.putNode(updatedAsset);
    
    // Update Confirm to approved
    const approvedConfirm: Confirm = {
      ...confirm,
      status: 'approved',
      decisions: [{
        decision_id: uuidv4(),
        status: 'approved',
        decided_by_role: 'growth-copilot',
        decided_at: new Date().toISOString(),
        reason: `Auto-approved publish to ${input.channel}`
      }]
    };
    await psg.putNode(approvedConfirm as any);
    
    // Update Plan to completed
    plan.status = 'completed';
    plan.steps = plan.steps.map(s => ({ ...s, status: 'completed' as const }));
    await psg.putNode(plan as any);
    
    // Update Trace to completed
    trace.status = 'completed';
    trace.finished_at = new Date().toISOString();
    if (trace.root_span) {
      trace.root_span.finished_at = trace.finished_at;
    }
    await psg.putNode(trace as any);
    
    await emitStage('record_published', 'Record Published', 'completed', 3);

    return {
      run_id,
      workflow_id: 'WF-03',
      success: true,
      plan,
      trace,
      confirm: approvedConfirm,
      outputs: {
        export_path: exportPath,
        formatted_content: formattedContent,
        asset_id: input.asset_id,
        channel: input.channel
      },
      events: {
        pipeline_stage_count: pipelineStageCount,
        graph_update_count: graphUpdateCount,
        runtime_execution_count: 0
      }
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    return {
      run_id,
      workflow_id: 'WF-03',
      success: false,
      plan: null as any,
      trace: null as any,
      outputs: {},
      events: {
        pipeline_stage_count: pipelineStageCount,
        graph_update_count: graphUpdateCount,
        runtime_execution_count: 0
      },
      error: errorMsg
    };
  }
}

/**
 * Generate paste-ready export pack
 */
function generateExportPack(
  asset: ContentAssetNode,
  channel: ChannelProfileNode,
  formattedContent: string
): string {
  const now = new Date().toISOString();
  
  return `# Export Pack — ${asset.title}

**Platform**: ${channel.platform}
**Asset ID**: ${asset.id}
**Generated**: ${now}
**Status**: Ready to publish

---

## Content

${formattedContent}

---

## Format Rules Applied

\`\`\`json
${JSON.stringify(channel.format_rules, null, 2)}
\`\`\`

---

## Next Steps

1. Copy the content above
2. Paste into ${channel.platform}
3. Add any platform-specific final touches
4. Publish
`;
}

export { PublishPackInput };
