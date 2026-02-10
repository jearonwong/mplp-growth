/**
 * Phase 4 Command Tests
 * 
 * Gate tests for OpenClaw command integration:
 * - GATE-CMD-WIRES-WF-01: /brief triggers WF-01
 * - GATE-CMD-WIRES-WF-02: /create triggers WF-02
 * - GATE-CMD-WIRES-WF-03: /publish triggers WF-03
 * - GATE-OUTPUT-CARD-01: Output contains required fields
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { cmdBrief, cmdCreate, cmdPublish, resetState } from './commands';
import { FileVSL } from './vsl/file-vsl';
import { InMemoryPSG } from './psg/in-memory-psg';
import { EventEmitter } from './glue/event-emitter';
import { createContext, type BrandPolicy, type AudienceSegment } from './modules/mplp-modules';
import { createChannelProfile, createContentAsset } from './psg/growth-nodes';

describe('Phase 4 Command Tests', () => {
  let basePath: string;
  let vsl: FileVSL;
  let psg: InMemoryPSG;
  let eventEmitter: EventEmitter;
  let contextId: string;
  
  beforeAll(async () => {
    // Create test directory
    basePath = path.join(os.tmpdir(), `mplp-phase4-test-${Date.now()}`);
    
    // Set env for orchestrator to use test directory
    process.env.MPLP_GROWTH_STATE_DIR = basePath;
    
    // Initialize VSL
    vsl = new FileVSL({ basePath });
    await vsl.init();
    
    // Create minimal test context
    const brand: BrandPolicy = {
      name: 'Test Brand',
      tagline: 'Test tagline',
      positioning: 'Test positioning',
      forbidden_terms: ['spam'],
      links: { website: 'https://test.io' },
    };
    
    const audiences: AudienceSegment[] = [
      { segment: 'developers', pain_points: ['test'], value_proposition: 'test', cta: 'test' },
    ];
    
    const context = createContext({
      title: 'Phase 4 Test Context',
      domain: 'growth',
      environment: 'test',
      brand,
      audiences,
    });
    context.status = 'active';
    (context.root as any).cadence = { weekly_rhythm: { monday: 'test' } };
    
    contextId = context.context_id;
    eventEmitter = new EventEmitter(contextId);
    psg = new InMemoryPSG({ contextId }, vsl, eventEmitter);
    
    // Save context
    await psg.putNode(context as any);
    
    // Create channel profiles
    const channels = ['x', 'linkedin', 'medium'] as const;
    for (const platform of channels) {
      const profile = createChannelProfile({
        context_id: contextId,
        platform,
        format_rules: { max_chars: 280 },
      });
      await psg.putNode(profile);
    }
    
    // Reset orchestrator state to pick up new env
    resetState();
  });
  
  afterAll(async () => {
    // Cleanup
    delete process.env.MPLP_GROWTH_STATE_DIR;
    resetState();
    await fs.rm(basePath, { recursive: true, force: true });
  });
  
  describe('GATE-CMD-WIRES-WF-01', () => {
    it('/brief triggers WF-01 and returns Plan+Trace', async () => {
      const output = await cmdBrief();
      
      // Should contain Plan reference
      expect(output).toContain('Plan');
      
      // Should contain Trace reference
      expect(output).toContain('Trace');
      
      // Should contain Weekly Brief title
      expect(output).toContain('Weekly Brief');
      
      // Should have next actions
      expect(output).toContain('/create');
    });
  });
  
  describe('GATE-CMD-WIRES-WF-02', () => {
    it('/create thread produces ContentAsset(status=reviewed)', async () => {
      const output = await cmdCreate(['thread']);
      
      // Should contain asset info
      expect(output).toContain('Content Created');
      expect(output).toContain('thread');
      
      // Should contain asset ID
      expect(output).toContain('Asset ID');
      
      // Should have next action for publish
      expect(output).toContain('/publish');
    });
    
    it('/create with invalid type returns error', async () => {
      const output = await cmdCreate(['invalid']);
      
      expect(output).toContain('Invalid type');
    });
    
    it('/create with no args returns error', async () => {
      const output = await cmdCreate([]);
      
      expect(output).toContain('Missing asset type');
    });
  });
  
  describe('GATE-CMD-WIRES-WF-03', () => {
    let assetId: string;
    
    beforeAll(async () => {
      // Create an asset first
      const asset = createContentAsset({
        context_id: contextId,
        asset_type: 'thread',
        title: 'Test publish asset',
        content: 'Test content for publishing',
      });
      asset.status = 'reviewed'; // Must be reviewed to publish
      await psg.putNode(asset);
      assetId = asset.id;
      
      // Reset orchestrator to reload state
      resetState();
    });
    
    it('/publish generates export file', async () => {
      const output = await cmdPublish([assetId, 'x']);
      
      // Should contain published info
      expect(output).toContain('Published');
      expect(output).toContain('x');
      
      // Should contain export path
      expect(output).toContain('Export');
      expect(output).toContain('.md');
    });
    
    it('/publish with missing args returns error', async () => {
      const output = await cmdPublish([]);
      
      expect(output).toContain('Missing arguments');
    });
    
    it('/publish with invalid channel returns error', async () => {
      const output = await cmdPublish([assetId, 'invalid']);
      
      expect(output).toContain('Invalid channel');
    });
  });
  
  describe('GATE-OUTPUT-CARD-01', () => {
    it('output contains Plan id / Trace id / Next action', async () => {
      const output = await cmdBrief();
      
      // Check for required card fields
      expect(output).toMatch(/Plan.*:/);
      expect(output).toMatch(/Trace.*:/);
      expect(output).toContain('Next Actions');
    });
  });
});
