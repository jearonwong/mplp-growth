/**
 * Phase 2 Seed Data for MPLP Growth Copilot
 * 
 * This script seeds the VSL with initial ground truth:
 * - Context with brand/audience/cadence
 * - 5 ChannelProfiles (X, LinkedIn, Medium, HN, YouTube)
 * - 1 OutreachTarget (Linux Foundation)
 * - 1 ContentAsset example
 * 
 * Run with: npx tsx src/seed.ts
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';
import os from 'node:os';
import { FileVSL } from './vsl/file-vsl.js';
import { InMemoryPSG } from './psg/in-memory-psg.js';
import { EventEmitter } from './glue/event-emitter.js';
import { 
  createContext, 
  type BrandPolicy, 
  type AudienceSegment,
  type Context 
} from './modules/mplp-modules.js';
import { 
  createChannelProfile, 
  createOutreachTarget, 
  createContentAsset,
  type ChannelProfileNode,
  type OutreachTargetNode,
  type ContentAssetNode 
} from './psg/growth-nodes.js';

// ============================================================================
// MPLP Brand Ground Truth (from V1.0_release canonical content)
// ============================================================================

const MPLP_BRAND: BrandPolicy = {
  name: 'MPLP (Multi-Agent Lifecycle Protocol)',
  tagline: 'MPLP — The Agent OS Protocol',
  positioning: 'Vendor-neutral, observable, governed protocol for multi-agent project orchestration. A specification — not a framework, not a product.',
  forbidden_terms: [
    'certification',
    'certified',
    'compliance certified',
    'MPLP certified',
    'endorsed by',
    'approved by',
    'framework',  // MPLP is a protocol, not a framework
    'product',
    'platform',
    'guaranteed',
    'ensures safety',
    '100% compliant'
  ],
  links: {
    website: 'https://mplp.io',
    docs: 'https://docs.mplp.io',
    validation_lab: 'https://lab.mplp.io',
    repo: 'https://github.com/mplp-protocol',
    spec: 'https://docs.mplp.io/specification',
  }
};

const MPLP_AUDIENCES: AudienceSegment[] = [
  {
    segment: 'developers',
    pain_points: [
      'No standard interface for multi-agent collaboration',
      'Vendor lock-in with every LLM/agent framework',
      'Can\'t trace or debug multi-agent workflows',
      'No replayable audit trail for agent decisions'
    ],
    value_proposition: 'Universal protocol = write once, run on any compliant runtime. W3C-style tracing. Git-like state snapshots.',
    cta: 'Start with the Quickstart guide'
  },
  {
    segment: 'enterprise',
    pain_points: [
      'AI governance requirements unclear',
      'Can\'t prove agent behavior to auditors',
      'No standard for multi-agent procurement',
      'Risk of vendor lock-in'
    ],
    value_proposition: 'Observable, governed, vendor-neutral. Evidence-first architecture for compliance. Enterprise procurement clarity.',
    cta: 'Review the Validation Lab evidence'
  },
  {
    segment: 'standards',
    pain_points: [
      'No reference point for multi-agent interop',
      'Each vendor has proprietary agent interface',
      'Emerging EU AI Act requirements need standard',
      'Industry fragmentation'
    ],
    value_proposition: 'POSIX-comparable abstraction layer. Constitutional governance model. W3C Trace Context alignment.',
    cta: 'Read the Protocol Specification'
  }
];

const MPLP_CADENCE = {
  weekly_rhythm: {
    monday: 'Review last week metrics, plan content themes',
    tuesday_wednesday: 'Content creation (thread drafts, articles)',
    thursday: 'Review and format for platforms',
    friday: 'Publish pack preparation, outreach follow-ups',
    weekend: 'Light monitoring, engagement responses'
  },
  content_types: ['thread', 'post', 'article', 'video_script', 'outreach_email'],
  publish_cadence: {
    x_twitter: '2-3 threads/week',
    linkedin: '1-2 posts/week',
    medium: '1 article/2 weeks',
    hn: 'Launch posts only (high-risk, confirm required)',
    youtube: 'Monthly deep-dive'
  }
};

// ============================================================================
// Channel Format Rules
// ============================================================================

const CHANNEL_CONFIGS: Array<{
  platform: ChannelProfileNode['platform'];
  handle?: string;
  format_rules: Record<string, unknown>;
}> = [
  {
    platform: 'x',
    handle: '@mplp_protocol',
    format_rules: {
      max_chars: 280,
      thread_max_tweets: 10,
      use_hashtags: ['#MPLP', '#MultiAgent', '#AI', '#AIGovernance'],
      avoid_hashtags: ['#certified', '#compliance'],
      link_strategy: 'final tweet only',
      tone: 'Technical but accessible, avoid hype',
      forbidden: MPLP_BRAND.forbidden_terms
    }
  },
  {
    platform: 'linkedin',
    handle: 'mplp-protocol',
    format_rules: {
      max_chars: 3000,
      structure: 'Hook → Problem → Solution → CTA',
      use_emojis: false,
      link_strategy: 'first comment for algorithm',
      tone: 'Professional, enterprise-friendly',
      forbidden: MPLP_BRAND.forbidden_terms
    }
  },
  {
    platform: 'medium',
    format_rules: {
      min_words: 800,
      max_words: 2500,
      structure: 'Intro → Problem → MPLP approach → Code/Diagram → Conclusion',
      use_code_blocks: true,
      use_mermaid: true,
      cross_post_to: ['dev.to', 'hashnode'],
      forbidden: MPLP_BRAND.forbidden_terms
    }
  },
  {
    platform: 'hn',
    format_rules: {
      title_style: 'Show HN: / Launch HN: (ask permission)',
      max_title_chars: 80,
      submission_type: 'link to lab.mplp.io or docs',
      engagement_rules: [
        'Never argue',
        'Respond with evidence links',
        'Admit unknowns',
        'Reference Validation Lab for claims'
      ],
      risk_level: 'HIGH - requires CONFIRM approval',
      forbidden: MPLP_BRAND.forbidden_terms
    }
  },
  {
    platform: 'youtube',
    format_rules: {
      video_length: '8-15 minutes',
      structure: 'Hook (15s) → Agenda → Content → Recap → CTA',
      thumbnail_style: 'Clean, minimal, protocol branding',
      chapters_required: true,
      description_links: ['docs', 'lab', 'repo'],
      forbidden: MPLP_BRAND.forbidden_terms
    }
  }
];

// ============================================================================
// Outreach Targets
// ============================================================================

const OUTREACH_TARGETS = [
  {
    name: 'Linux Foundation',
    org_type: 'foundation' as const,
    notes: `Vendor-neutral AI initiative alignment.
Outreach constraints:
- Lead with observability/governance, not "compliance"
- Reference Validation Lab as evidence-first approach
- Emphasize POSIX analogy for understanding
- No certification claims
- Potential: LF AI & Data landscape consideration`
  },
  {
    name: 'CNCF (Cloud Native Computing Foundation)',
    org_type: 'foundation' as const,
    notes: `Cloud-native multi-agent orchestration.
Focus areas:
- Kubernetes native multi-agent patterns
- OpenTelemetry alignment (W3C Trace Context)
- Observability-first design
- Vendor-neutral governance model`
  }
];

// ============================================================================
// Seed Execution
// ============================================================================

async function seed() {
  console.log('🌱 MPLP Growth Copilot — Phase 2 Seed Data\n');
  
  // Initialize VSL at standard location
  const basePath = path.join(os.homedir(), '.openclaw', 'mplp-growth');
  const vsl = new FileVSL({ basePath });
  await vsl.init();
  console.log(`📁 VSL initialized at: ${basePath}`);
  
  // Create Context
  const context = createContext({
    title: 'MPLP Growth Copilot',
    domain: 'growth',
    environment: 'production',
    owner_role: 'growth-agent',
    brand: MPLP_BRAND,
    audiences: MPLP_AUDIENCES,
  });
  
  // Add cadence to root
  (context.root as any).cadence = MPLP_CADENCE;
  
  // Set Context to active (required by SA invariants)
  context.status = 'active';
  
  // Initialize EventEmitter and PSG
  const eventEmitter = new EventEmitter(context.context_id);
  const psg = new InMemoryPSG({ contextId: context.context_id }, vsl, eventEmitter);
  
  // Wire up event persistence
  eventEmitter.on('graph_update', async (event) => {
    console.log(`  📊 GraphUpdateEvent: ${event.event_type}`);
  });
  
  // Write Context to PSG
  console.log('\n📝 Writing Context...');
  await psg.putNode(context as any);
  console.log(`  ✅ Context: ${context.context_id}`);
  
  // Write ChannelProfiles
  console.log('\n📝 Writing ChannelProfiles...');
  const channelProfiles: ChannelProfileNode[] = [];
  for (const config of CHANNEL_CONFIGS) {
    const profile = createChannelProfile({
      context_id: context.context_id,
      platform: config.platform,
      handle: config.handle,
      format_rules: config.format_rules
    });
    await psg.putNode(profile);
    channelProfiles.push(profile);
    console.log(`  ✅ ${config.platform}: ${profile.id}`);
  }
  
  // Write OutreachTargets
  console.log('\n📝 Writing OutreachTargets...');
  const outreachTargets: OutreachTargetNode[] = [];
  for (const target of OUTREACH_TARGETS) {
    const node = createOutreachTarget({
      context_id: context.context_id,
      name: target.name,
      org_type: target.org_type,
      notes: target.notes
    });
    await psg.putNode(node);
    outreachTargets.push(node);
    console.log(`  ✅ ${target.name}: ${node.id}`);
  }
  
  // Write example ContentAsset (smoke test)
  console.log('\n📝 Writing example ContentAsset...');
  const exampleAsset = createContentAsset({
    context_id: context.context_id,
    asset_type: 'thread',
    title: 'MPLP Introduction Thread',
    content: `Thread: What is MPLP?

1/ MPLP (Multi-agent Project Lifecycle Protocol) is the POSIX for multi-agent systems.

Not a framework. Not a product. A specification.

2/ Why does this matter? Today every AI agent framework has its own interface...

[Draft - to be expanded by WF-02]`
  });
  await psg.putNode(exampleAsset);
  console.log(`  ✅ ContentAsset: ${exampleAsset.id}`);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Seed Summary');
  console.log('='.repeat(60));
  console.log(`Context ID: ${context.context_id}`);
  console.log(`Brand: ${MPLP_BRAND.name}`);
  console.log(`Audiences: ${MPLP_AUDIENCES.length}`);
  console.log(`ChannelProfiles: ${channelProfiles.length}`);
  console.log(`OutreachTargets: ${outreachTargets.length}`);
  console.log(`ContentAssets: 1`);
  console.log('');
  console.log('✅ Phase 2 seed data complete!');
  console.log(`📁 Data location: ${basePath}/vsl/objects/`);
  
  return {
    context,
    channelProfiles,
    outreachTargets,
    exampleAsset
  };
}

// Run if executed directly
seed().catch(console.error);

export { seed, MPLP_BRAND, MPLP_AUDIENCES, MPLP_CADENCE, CHANNEL_CONFIGS, OUTREACH_TARGETS };
