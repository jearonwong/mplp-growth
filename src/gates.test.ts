/**
 * Gate Tests - Testing the 3 implementation gates
 * 
 * GATE-TRACE-ROOTSPAN-01: Trace.root_span must not be empty
 * GATE-CONFIRM-TARGETTYPE-01: Confirm.target_type must be valid enum
 * GATE-EXTENSION-SEMVER-01: Extension.version must be SemVer
 */

import { describe, it, expect } from 'vitest';
import { 
  createTrace, 
  createConfirm, 
  createExtension 
} from '../src/modules/mplp-modules.js';

describe('GATE-TRACE-ROOTSPAN-01', () => {
  it('should create trace with valid root_span', () => {
    const trace = createTrace({
      context_id: '123e4567-e89b-12d3-a456-426614174000',
      root_span_name: 'test-span',
    });
    
    expect(trace.root_span).toBeDefined();
    expect(trace.root_span.span_id).toBeDefined();
    expect(trace.root_span.name).toBe('test-span');
  });
});

describe('GATE-CONFIRM-TARGETTYPE-01', () => {
  const validTypes = ['context', 'plan', 'trace', 'extension', 'other'] as const;
  
  validTypes.forEach((targetType) => {
    it(`should accept valid target_type: ${targetType}`, () => {
      const confirm = createConfirm({
        target_type: targetType,
        target_id: '123e4567-e89b-12d3-a456-426614174000',
        requested_by_role: 'test-role',
      });
      
      expect(confirm.target_type).toBe(targetType);
    });
  });

  it('should reject invalid target_type', () => {
    expect(() => {
      createConfirm({
        target_type: 'invalid' as any,
        target_id: '123',
        requested_by_role: 'test',
      });
    }).toThrow('GATE-CONFIRM-TARGETTYPE-01');
  });
});

describe('GATE-EXTENSION-SEMVER-01', () => {
  const validVersions = ['1.0.0', '0.1.0', '10.20.30', '1.0.0-alpha'];
  
  validVersions.forEach((version) => {
    it(`should accept valid SemVer: ${version}`, () => {
      const extension = createExtension({
        context_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'test-extension',
        extension_type: 'capability',
        version,
      });
      
      expect(extension.version).toBe(version);
    });
  });

  const invalidVersions = ['1.0', 'v1.0.0', '1.0.0.0', 'latest', ''];
  
  invalidVersions.forEach((version) => {
    it(`should reject invalid version: "${version}"`, () => {
      expect(() => {
        createExtension({
          context_id: '123',
          name: 'test',
          extension_type: 'capability',
          version,
        });
      }).toThrow('GATE-EXTENSION-SEMVER-01');
    });
  });
});

describe('Contract-PLAN-02: Plan steps minItems=1', () => {
  it('should reject plan with zero steps', async () => {
    const { createPlan } = await import('../src/modules/mplp-modules.js');
    
    expect(() => {
      createPlan({
        context_id: '123',
        title: 'Test Plan',
        objective: 'Test',
        steps: [],
      });
    }).toThrow('sa_plan_has_steps');
  });
});

describe('Contract-COLLAB: Collab participants minItems=1', () => {
  it('should reject collab with zero participants', async () => {
    const { createCollab } = await import('../src/modules/mplp-modules.js');
    
    expect(() => {
      createCollab({
        context_id: '123',
        title: 'Test Collab',
        purpose: 'Test',
        mode: 'broadcast',
        participants: [],
      });
    }).toThrow('at least 1 participant');
  });
});
