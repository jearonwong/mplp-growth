/**
 * MPLP Growth Copilot - Command Orchestrator
 * 
 * Bridges OpenClaw commands to mplp-growth-runtime workflows.
 * Handles:
 * - Runtime initialization
 * - Command parsing
 * - Workflow execution
 * - Output formatting
 */

import path from 'node:path';
import os from 'node:os';
import { FileVSL } from '../vsl/file-vsl';
import { InMemoryPSG } from '../psg/in-memory-psg';
import { EventEmitter } from '../glue/event-emitter';
import { runWeeklyBrief } from '../workflows/wf01-weekly-brief';
import { runContentFactory, type ContentFactoryInput } from '../workflows/wf02-content-factory';
import { runPublishPack, type PublishPackInput } from '../workflows/wf03-publish-pack';
import type { Context } from '../modules/mplp-modules';
import type { ChannelProfileNode, ContentAssetNode } from '../psg/growth-nodes';
import {
  formatBriefCard,
  formatCreateCard,
  formatPublishCard,
  formatErrorCard,
  renderCardToMarkdown,
  type CommandCard,
} from './cards';

/** Command orchestrator state */
interface OrchestratorState {
  vsl: FileVSL;
  psg: InMemoryPSG;
  eventEmitter: EventEmitter;
  contextId: string;
  basePath: string;
}

let state: OrchestratorState | null = null;

/**
 * Initialize the orchestrator
 */
async function init(): Promise<OrchestratorState> {
  if (state) return state;
  
  const basePath = process.env.MPLP_GROWTH_STATE_DIR 
    || path.join(os.homedir(), '.openclaw', 'mplp-growth');
  
  const vsl = new FileVSL({ basePath });
  await vsl.init();
  
  // Load existing context
  const contextKeys = await vsl.listKeys('Context');
  if (contextKeys.length === 0) {
    throw new Error('No context found. Run seed first: npm run seed');
  }
  
  const context = await vsl.get<Context>(contextKeys[0]);
  if (!context) {
    throw new Error('Failed to load context');
  }
  
  const contextId = context.context_id;
  const eventEmitter = new EventEmitter(contextId);
  const psg = new InMemoryPSG({ contextId }, vsl, eventEmitter);
  
  // Load context into PSG
  await psg.putNode(context as any);
  
  // Load channel profiles
  const channelKeys = await vsl.listKeys('domain:ChannelProfile');
  for (const key of channelKeys) {
    const node = await vsl.get(key);
    if (node) await psg.putNode(node as any);
  }
  
  // Load content assets
  const assetKeys = await vsl.listKeys('domain:ContentAsset');
  for (const key of assetKeys) {
    const node = await vsl.get(key);
    if (node) await psg.putNode(node as any);
  }
  
  state = { vsl, psg, eventEmitter, contextId, basePath };
  return state;
}

/**
 * /brief command handler
 */
export async function cmdBrief(): Promise<string> {
  try {
    const { psg, vsl, eventEmitter, contextId } = await init();
    
    const result = await runWeeklyBrief(
      { context_id: contextId },
      { psg, vsl, eventEmitter }
    );
    
    if (!result.success) {
      return renderCardToMarkdown(formatErrorCard('Weekly Brief', result.error || 'Unknown error'));
    }
    
    return renderCardToMarkdown(formatBriefCard(result));
  } catch (error) {
    return renderCardToMarkdown(formatErrorCard('Weekly Brief', error instanceof Error ? error.message : String(error)));
  }
}

/**
 * /create command handler
 * @param args - Command arguments: <type> [audience] [channel]
 */
export async function cmdCreate(args: string[]): Promise<string> {
  try {
    const { psg, vsl, eventEmitter, contextId } = await init();
    
    // Parse arguments
    const assetType = args[0] as ContentFactoryInput['asset_type'];
    if (!assetType) {
      return renderCardToMarkdown(formatErrorCard('Content Factory', 'Missing asset type. Usage: /create <type> [audience] [channel]'));
    }
    
    const validTypes = ['thread', 'post', 'article', 'video_script', 'outreach_email'];
    if (!validTypes.includes(assetType)) {
      return renderCardToMarkdown(formatErrorCard('Content Factory', `Invalid type: ${assetType}. Valid: ${validTypes.join(', ')}`));
    }
    
    const audience = args[1] as ContentFactoryInput['audience'] | undefined;
    const channels = args[2] ? [args[2] as ChannelProfileNode['platform']] : undefined;
    
    const result = await runContentFactory(
      {
        context_id: contextId,
        asset_type: assetType,
        audience,
        channels,
      },
      { psg, vsl, eventEmitter }
    );
    
    if (!result.success) {
      return renderCardToMarkdown(formatErrorCard('Content Factory', result.error || 'Unknown error'));
    }
    
    return renderCardToMarkdown(formatCreateCard(result));
  } catch (error) {
    return renderCardToMarkdown(formatErrorCard('Content Factory', error instanceof Error ? error.message : String(error)));
  }
}

/**
 * /publish command handler
 * @param args - Command arguments: <asset_id> <channel>
 */
export async function cmdPublish(args: string[]): Promise<string> {
  try {
    const { psg, vsl, eventEmitter, contextId, basePath } = await init();
    
    const assetId = args[0];
    const channel = args[1] as ChannelProfileNode['platform'];
    
    if (!assetId || !channel) {
      return renderCardToMarkdown(formatErrorCard('Publish Pack', 'Missing arguments. Usage: /publish <asset_id> <channel>'));
    }
    
    const validChannels = ['x', 'linkedin', 'medium', 'hn', 'youtube'];
    if (!validChannels.includes(channel)) {
      return renderCardToMarkdown(formatErrorCard('Publish Pack', `Invalid channel: ${channel}. Valid: ${validChannels.join(', ')}`));
    }
    
    const result = await runPublishPack(
      {
        context_id: contextId,
        asset_id: assetId,
        channel,
      },
      { psg, vsl, eventEmitter, basePath }
    );
    
    if (!result.success) {
      return renderCardToMarkdown(formatErrorCard('Publish Pack', result.error || 'Unknown error'));
    }
    
    return renderCardToMarkdown(formatPublishCard(result));
  } catch (error) {
    return renderCardToMarkdown(formatErrorCard('Publish Pack', error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Reset orchestrator state (for testing)
 */
export function resetState(): void {
  state = null;
}
