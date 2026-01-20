/**
 * Tests for workflow reference expansion (single-phase, no for-each)
 *
 * Feature: Enable referencing another workflow for a single phase
 * This allows workflow composition where a phase can expand an entire
 * workflow's phases inline, prefixed with the parent phase ID.
 *
 * Test Scenarios:
 * 1. Expand workflow reference inline
 * 2. Phase ID prefixing for collision avoidance
 * 3. Mutual exclusivity of prompt and workflow
 * 4. Direct cycle detection (self-reference)
 * 5. Indirect cycle detection (A → B → A)
 * 6. Max depth limit enforcement
 * 7. Mixed phases (inline prompts + workflow references)
 * 8. Nested workflow expansion (within depth limit)
 */
export {};
//# sourceMappingURL=workflow-reference.test.d.ts.map