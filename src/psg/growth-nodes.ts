/**
 * Growth Copilot Domain Nodes
 * 
 * Per PATCH-01: Domain Node type prefix = "domain:"
 * Per PATCH-04: All Domain Node IDs use UUID v4
 * Per Contract-PSG-01: Domain Nodes must emit GraphUpdateEvent on write
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Domain Node Types (per implementation_plan.md Domain Node Registry)
// ============================================================================

/** Content Asset - marketing content entity */
export interface ContentAssetNode {
  type: 'domain:ContentAsset';
  id: string;  // UUID v4 per PATCH-04
  context_id: string;
  asset_type: 'thread' | 'post' | 'article' | 'video_script' | 'outreach_email';
  status: 'draft' | 'reviewed' | 'published';
  title: string;
  content: string;
  platform_variants: Record<string, string>;  // platform -> formatted content
  created_at: string;
  published_at?: string;
  plan_id?: string;  // Optional: link to originating plan
}

export interface CreateContentAssetInput {
  context_id: string;
  asset_type: ContentAssetNode['asset_type'];
  title: string;
  content: string;
  plan_id?: string;
}

export function createContentAsset(input: CreateContentAssetInput): ContentAssetNode {
  return {
    type: 'domain:ContentAsset',
    id: uuidv4(),
    context_id: input.context_id,
    asset_type: input.asset_type,
    status: 'draft',
    title: input.title,
    content: input.content,
    platform_variants: {},
    created_at: new Date().toISOString(),
    plan_id: input.plan_id,
  };
}

/** Outreach Target - CRM target entity */
export interface OutreachTargetNode {
  type: 'domain:OutreachTarget';
  id: string;  // UUID v4 per PATCH-04
  context_id: string;
  name: string;
  org_type: 'foundation' | 'standards' | 'government' | 'consortium' | 'company';
  status: 'research' | 'drafted' | 'contacted' | 'in_discussion' | 'partnership' | 'declined';
  contact?: string;
  notes: string;
  last_contact_at?: string;
}

export interface CreateOutreachTargetInput {
  context_id: string;
  name: string;
  org_type: OutreachTargetNode['org_type'];
  notes?: string;
}

export function createOutreachTarget(input: CreateOutreachTargetInput): OutreachTargetNode {
  return {
    type: 'domain:OutreachTarget',
    id: uuidv4(),
    context_id: input.context_id,
    name: input.name,
    org_type: input.org_type,
    status: 'research',
    notes: input.notes || '',
  };
}

/** Channel Profile - platform publishing config */
export interface ChannelProfileNode {
  type: 'domain:ChannelProfile';
  id: string;  // UUID v4
  context_id: string;
  platform: 'x' | 'linkedin' | 'medium' | 'hn' | 'youtube' | 'substack';
  status: 'active' | 'inactive';
  handle?: string;
  format_rules: Record<string, unknown>;
}

export interface CreateChannelProfileInput {
  context_id: string;
  platform: ChannelProfileNode['platform'];
  handle?: string;
  format_rules?: Record<string, unknown>;
}

export function createChannelProfile(input: CreateChannelProfileInput): ChannelProfileNode {
  return {
    type: 'domain:ChannelProfile',
    id: uuidv4(),
    context_id: input.context_id,
    platform: input.platform,
    status: 'active',
    handle: input.handle,
    format_rules: input.format_rules || {},
  };
}

/** Interaction - social/email interaction record */
export interface InteractionNode {
  type: 'domain:Interaction';
  id: string;  // UUID v4
  context_id: string;
  platform: string;
  status: 'pending' | 'responded' | 'archived';
  content: string;
  author?: string;
  response?: string;
  received_at: string;
  responded_at?: string;
}

export interface CreateInteractionInput {
  context_id: string;
  platform: string;
  content: string;
  author?: string;
}

export function createInteraction(input: CreateInteractionInput): InteractionNode {
  return {
    type: 'domain:Interaction',
    id: uuidv4(),
    context_id: input.context_id,
    platform: input.platform,
    status: 'pending',
    content: input.content,
    author: input.author,
    received_at: new Date().toISOString(),
  };
}

/** Metric Snapshot - immutable metrics record */
export interface MetricSnapshotNode {
  type: 'domain:MetricSnapshot';
  id: string;  // UUID v4
  context_id: string;
  snapshot_at: string;
  period: 'daily' | 'weekly' | 'monthly';
  metrics: Record<string, number>;
}

export interface CreateMetricSnapshotInput {
  context_id: string;
  period: MetricSnapshotNode['period'];
  metrics: Record<string, number>;
}

export function createMetricSnapshot(input: CreateMetricSnapshotInput): MetricSnapshotNode {
  return {
    type: 'domain:MetricSnapshot',
    id: uuidv4(),
    context_id: input.context_id,
    snapshot_at: new Date().toISOString(),
    period: input.period,
    metrics: input.metrics,
  };
}
