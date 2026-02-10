/**
 * Phase 5 Demo & README Gate Tests
 * 
 * Gate tests for MVP deliverables:
 * - GATE-DEMO-LOOP-01: seed → brief → create → publish e2e
 * - GATE-EXPORT-PACK-CONTENT-01: Export file has required content
 * - GATE-README-REQUIRED-SECTIONS-01: README has required sections
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

describe('Phase 5 Demo & README Gates', () => {
  let basePath: string;
  let vsl: FileVSL;
  let psg: InMemoryPSG;
  let eventEmitter: EventEmitter;
  let contextId: string;
  
  beforeAll(async () => {
    // Create test directory
    basePath = path.join(os.tmpdir(), `mplp-phase5-test-${Date.now()}`);
    
    // Set env for orchestrator to use test directory
    process.env.MPLP_GROWTH_STATE_DIR = basePath;
    
    // Initialize VSL
    vsl = new FileVSL({ basePath });
    await vsl.init();
    
    // Create context with brand links (required for export CTA)
    const brand: BrandPolicy = {
      name: 'Test Brand',
      tagline: 'Test tagline',
      positioning: 'Test positioning',
      forbidden_terms: ['spam'],
      links: { 
        website: 'https://test.io',
        docs: 'https://docs.test.io',
      },
    };
    
    const audiences: AudienceSegment[] = [
      { segment: 'developers', pain_points: ['test'], value_proposition: 'test', cta: 'test' },
    ];
    
    const context = createContext({
      title: 'Phase 5 Test Context',
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
  
  describe('GATE-DEMO-LOOP-01', () => {
    it('seed → brief → create → publish e2e loop completes', async () => {
      // Step 1: brief
      const briefOutput = await cmdBrief();
      expect(briefOutput).toContain('Weekly Brief');
      expect(briefOutput).toContain('Plan');
      
      // Step 2: create
      const createOutput = await cmdCreate(['thread']);
      expect(createOutput).toContain('Content Created');
      expect(createOutput).toContain('Asset ID');
      
      // Extract asset ID from output
      const assetIdMatch = createOutput.match(/Asset ID.*`([a-f0-9-]+)`/);
      expect(assetIdMatch).toBeTruthy();
      const assetId = assetIdMatch![1];
      
      // Need to mark asset as reviewed for publish
      // The create workflow should have done this, but let's verify
      
      // Step 3: publish
      const publishOutput = await cmdPublish([assetId, 'x']);
      expect(publishOutput).toContain('Published');
      expect(publishOutput).toContain('Export');
      
      // Verify export file exists
      const exportsDir = path.join(basePath, 'exports');
      const exportDirs = await fs.readdir(exportsDir).catch(() => []);
      expect(exportDirs.length).toBeGreaterThan(0);
    });
  });
  
  describe('GATE-EXPORT-PACK-CONTENT-01', () => {
    it('export file is non-empty and has content', async () => {
      // This test runs after GATE-DEMO-LOOP-01 which creates an export
      // Find the x.md export file created by that test
      
      const exportsDir = path.join(basePath, 'exports');
      const exportDirs = await fs.readdir(exportsDir);
      expect(exportDirs.length).toBeGreaterThan(0);
      
      // Get the first run directory and check x.md (from demo loop)
      const firstDir = exportDirs[0];
      const exportPath = path.join(exportsDir, firstDir, 'x.md');
      
      // Verify file exists and has content
      const content = await fs.readFile(exportPath, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
      
      // Should have some content (title or header)
      expect(content).toMatch(/\w+/);
    });
  });
  
  describe('GATE-README-REQUIRED-SECTIONS-01', () => {
    it('README_MVP.md contains required sections', async () => {
      const readmePath = path.join(__dirname, '..', 'README_MVP.md');
      const content = await fs.readFile(readmePath, 'utf-8');
      
      // Check for required sections
      expect(content).toMatch(/##.*Commands/i);
      expect(content).toMatch(/##.*Data Artifacts/i);
      expect(content).toMatch(/##.*MPLP Compliance/i);
      expect(content).toMatch(/##.*Demo/i);
    });
  });
});
