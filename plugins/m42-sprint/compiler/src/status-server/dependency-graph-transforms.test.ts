/**
 * Tests for dependency graph transforms in transforms.ts
 * Tests DAG visualization for status dashboard
 *
 * Covers:
 * - buildDependencyGraphForPhase
 * - buildDependencyGraphs
 * - toStatusUpdateWithGraph
 * - statusToColor
 * - Layout computation (topological sort)
 * - Blocked-by information
 * - Injected step highlighting
 */

import type {
  CompiledProgress,
  CompiledTopPhase,
  CompiledStep,
  PhaseStatus,
} from '../types.js';

// Simple test runner (consistent with project patterns)
function test(name: string, fn: () => void | Promise<void>): void {
  const result = fn();
  if (result instanceof Promise) {
    result
      .then(() => console.log(`✓ ${name}`))
      .catch((error) => {
        console.error(`✗ ${name}`);
        console.error(`  ${error}`);
        process.exitCode = 1;
      });
  } else {
    try {
      console.log(`✓ ${name}`);
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  ${error}`);
      process.exitCode = 1;
    }
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected "${expected}", got "${actual}"`);
  }
}

function assertDeepEqual<T>(actual: T, expected: T, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('\n--- Dependency Graph Transforms Tests ---\n');

// ============================================================================
// Test: statusToColor mapping
// ============================================================================

test('statusToColor should map all PhaseStatus values to colors', async () => {
  const { statusToColor } = await import('./transforms.js');

  assertEqual(statusToColor('pending'), 'gray', 'pending -> gray');
  assertEqual(statusToColor('in-progress'), 'blue', 'in-progress -> blue');
  assertEqual(statusToColor('completed'), 'green', 'completed -> green');
  assertEqual(statusToColor('failed'), 'red', 'failed -> red');
  assertEqual(statusToColor('blocked'), 'orange', 'blocked -> orange');
  assertEqual(statusToColor('skipped'), 'yellow', 'skipped -> yellow');
});

// ============================================================================
// Test: Simple linear DAG (A -> B -> C)
// ============================================================================

test('buildDependencyGraphForPhase should handle linear dependencies', async () => {
  const { buildDependencyGraphForPhase } = await import('./transforms.js');

  const phase: CompiledTopPhase = {
    id: 'dev-phase',
    status: 'in-progress',
    steps: [
      {
        id: 'step-A',
        prompt: 'First step',
        status: 'completed',
        'depends-on': [],
        phases: [],
      },
      {
        id: 'step-B',
        prompt: 'Second step',
        status: 'in-progress',
        'depends-on': ['step-A'],
        phases: [],
      },
      {
        id: 'step-C',
        prompt: 'Third step',
        status: 'pending',
        'depends-on': ['step-B'],
        phases: [],
      },
    ] as any,
  };

  const depGraphs = [
    {
      'phase-id': 'dev-phase',
      nodes: [
        { id: 'step-A', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-B', 'depends-on': ['step-A'], 'blocked-by': [] },
        { id: 'step-C', 'depends-on': ['step-B'], 'blocked-by': ['step-B'] },
      ],
    },
  ];

  const graph = buildDependencyGraphForPhase(phase, depGraphs, new Set());

  assert(graph !== null, 'Graph should not be null');
  assertEqual(graph!.nodes.length, 3, 'Should have 3 nodes');
  assertEqual(graph!.edges.length, 2, 'Should have 2 edges (A->B, B->C)');

  // Check layout - linear chain should be vertical
  const nodeA = graph!.nodes.find(n => n.id === 'step-A')!;
  const nodeB = graph!.nodes.find(n => n.id === 'step-B')!;
  const nodeC = graph!.nodes.find(n => n.id === 'step-C')!;

  assertEqual(nodeA.layoutRow, 0, 'step-A should be at row 0');
  assertEqual(nodeB.layoutRow, 1, 'step-B should be at row 1');
  assertEqual(nodeC.layoutRow, 2, 'step-C should be at row 2');

  // Check statuses
  assertEqual(nodeA.status, 'completed', 'step-A status');
  assertEqual(nodeB.status, 'in-progress', 'step-B status');
  assertEqual(nodeC.status, 'pending', 'step-C status');

  // Check blocked-by label
  assertEqual(nodeC.blockedByLabel, 'Waiting for step-B', 'step-C blockedByLabel');
});

// ============================================================================
// Test: Diamond DAG (A -> B, A -> C, B -> D, C -> D)
// ============================================================================

test('buildDependencyGraphForPhase should handle diamond dependencies', async () => {
  const { buildDependencyGraphForPhase } = await import('./transforms.js');

  const phase: CompiledTopPhase = {
    id: 'diamond-phase',
    status: 'in-progress',
    steps: [
      {
        id: 'step-A',
        prompt: 'Root step',
        status: 'completed',
        'depends-on': [],
        phases: [],
      },
      {
        id: 'step-B',
        prompt: 'Left branch',
        status: 'completed',
        'depends-on': ['step-A'],
        phases: [],
      },
      {
        id: 'step-C',
        prompt: 'Right branch',
        status: 'in-progress',
        'depends-on': ['step-A'],
        phases: [],
      },
      {
        id: 'step-D',
        prompt: 'Join step',
        status: 'pending',
        'depends-on': ['step-B', 'step-C'],
        phases: [],
      },
    ] as any,
  };

  const depGraphs = [
    {
      'phase-id': 'diamond-phase',
      nodes: [
        { id: 'step-A', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-B', 'depends-on': ['step-A'], 'blocked-by': [] },
        { id: 'step-C', 'depends-on': ['step-A'], 'blocked-by': [] },
        { id: 'step-D', 'depends-on': ['step-B', 'step-C'], 'blocked-by': ['step-C'] },
      ],
    },
  ];

  const graph = buildDependencyGraphForPhase(phase, depGraphs, new Set());

  assert(graph !== null, 'Graph should not be null');
  assertEqual(graph!.nodes.length, 4, 'Should have 4 nodes');
  assertEqual(graph!.edges.length, 4, 'Should have 4 edges');

  // Check layout
  const nodeA = graph!.nodes.find(n => n.id === 'step-A')!;
  const nodeB = graph!.nodes.find(n => n.id === 'step-B')!;
  const nodeC = graph!.nodes.find(n => n.id === 'step-C')!;
  const nodeD = graph!.nodes.find(n => n.id === 'step-D')!;

  assertEqual(nodeA.layoutRow, 0, 'step-A should be at row 0');
  assertEqual(nodeB.layoutRow, 1, 'step-B should be at row 1');
  assertEqual(nodeC.layoutRow, 1, 'step-C should be at row 1 (parallel with B)');
  assertEqual(nodeD.layoutRow, 2, 'step-D should be at row 2');

  // step-D blocked-by label should mention step-C only (step-B is completed)
  assertEqual(nodeD.blockedByLabel, 'Waiting for step-C', 'step-D blockedByLabel');

  // Check stats
  assertEqual(graph!.stats.completedNodes, 2, 'completedNodes');
  assertEqual(graph!.stats.runningNodes, 1, 'runningNodes');
  // step-D is pending but has blockedBy, so it counts as blocked
  assert(graph!.stats.blockedNodes >= 1, 'blockedNodes should include step-D');
});

// ============================================================================
// Test: Wide parallel DAG (A, B, C all independent -> D depends on all)
// ============================================================================

test('buildDependencyGraphForPhase should handle wide parallel DAG', async () => {
  const { buildDependencyGraphForPhase } = await import('./transforms.js');

  const phase: CompiledTopPhase = {
    id: 'parallel-phase',
    status: 'in-progress',
    steps: [
      {
        id: 'step-A',
        prompt: 'Independent A',
        status: 'in-progress',
        'depends-on': [],
        phases: [],
      },
      {
        id: 'step-B',
        prompt: 'Independent B',
        status: 'in-progress',
        'depends-on': [],
        phases: [],
      },
      {
        id: 'step-C',
        prompt: 'Independent C',
        status: 'pending',
        'depends-on': [],
        phases: [],
      },
      {
        id: 'step-D',
        prompt: 'Final step',
        status: 'pending',
        'depends-on': ['step-A', 'step-B', 'step-C'],
        phases: [],
      },
    ] as any,
  };

  const depGraphs = [
    {
      'phase-id': 'parallel-phase',
      nodes: [
        { id: 'step-A', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-B', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-C', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-D', 'depends-on': ['step-A', 'step-B', 'step-C'], 'blocked-by': ['step-A', 'step-B', 'step-C'] },
      ],
    },
  ];

  const graph = buildDependencyGraphForPhase(phase, depGraphs, new Set());

  assert(graph !== null, 'Graph should not be null');
  assertEqual(graph!.nodes.length, 4, 'Should have 4 nodes');
  assertEqual(graph!.edges.length, 3, 'Should have 3 edges (all to D)');

  // Check layout - A, B, C should be at row 0, D at row 1
  const nodeA = graph!.nodes.find(n => n.id === 'step-A')!;
  const nodeB = graph!.nodes.find(n => n.id === 'step-B')!;
  const nodeC = graph!.nodes.find(n => n.id === 'step-C')!;
  const nodeD = graph!.nodes.find(n => n.id === 'step-D')!;

  assertEqual(nodeA.layoutRow, 0, 'step-A should be at row 0');
  assertEqual(nodeB.layoutRow, 0, 'step-B should be at row 0');
  assertEqual(nodeC.layoutRow, 0, 'step-C should be at row 0');
  assertEqual(nodeD.layoutRow, 1, 'step-D should be at row 1');

  // Check columns - should be different for A, B, C
  const row0Columns = [nodeA.layoutColumn, nodeB.layoutColumn, nodeC.layoutColumn];
  const uniqueColumns = new Set(row0Columns);
  assertEqual(uniqueColumns.size, 3, 'A, B, C should have different columns');

  // Check blocked-by label for D (multiple dependencies)
  const blockedLabel = nodeD.blockedByLabel ?? '';
  assert(
    blockedLabel.includes('step-A') && blockedLabel.includes('step-B'),
    'step-D blockedByLabel should mention multiple deps'
  );

  // Check maxColumn
  assertEqual(graph!.maxColumn, 2, 'maxColumn should be 2 (3 items in row 0: columns 0,1,2)');
});

// ============================================================================
// Test: Injected steps are highlighted
// ============================================================================

test('buildDependencyGraphForPhase should highlight injected steps', async () => {
  const { buildDependencyGraphForPhase } = await import('./transforms.js');

  const phase: CompiledTopPhase = {
    id: 'injection-phase',
    status: 'in-progress',
    steps: [
      {
        id: 'step-original',
        prompt: 'Original step',
        status: 'completed',
        'depends-on': [],
        phases: [],
      },
      {
        id: 'step-injected',
        prompt: 'Dynamically injected step',
        status: 'in-progress',
        'depends-on': ['step-original'],
        injected: true,
        phases: [],
      },
    ] as any,
  };

  const depGraphs = [
    {
      'phase-id': 'injection-phase',
      nodes: [
        { id: 'step-original', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-injected', 'depends-on': ['step-original'], 'blocked-by': [] },
      ],
    },
  ];

  // Mark step-injected as injected via the injectedStepIds set
  const injectedStepIds = new Set(['step-injected']);
  const graph = buildDependencyGraphForPhase(phase, depGraphs, injectedStepIds);

  assert(graph !== null, 'Graph should not be null');

  const originalNode = graph!.nodes.find(n => n.id === 'step-original')!;
  const injectedNode = graph!.nodes.find(n => n.id === 'step-injected')!;

  assertEqual(originalNode.isInjected, false, 'Original step should not be marked as injected');
  assertEqual(injectedNode.isInjected, true, 'Injected step should be marked as injected');
  assertEqual(injectedNode.isRunning, true, 'Injected step should be marked as running');
});

// ============================================================================
// Test: Ready steps detection
// ============================================================================

test('buildDependencyGraphForPhase should detect ready steps', async () => {
  const { buildDependencyGraphForPhase } = await import('./transforms.js');

  const phase: CompiledTopPhase = {
    id: 'ready-phase',
    status: 'in-progress',
    steps: [
      {
        id: 'step-done',
        prompt: 'Completed step',
        status: 'completed',
        'depends-on': [],
        phases: [],
      },
      {
        id: 'step-ready',
        prompt: 'Ready to run (no blockers)',
        status: 'pending',
        'depends-on': ['step-done'],
        phases: [],
      },
      {
        id: 'step-blocked',
        prompt: 'Blocked by step-ready',
        status: 'pending',
        'depends-on': ['step-ready'],
        phases: [],
      },
    ] as any,
  };

  const depGraphs = [
    {
      'phase-id': 'ready-phase',
      nodes: [
        { id: 'step-done', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-ready', 'depends-on': ['step-done'], 'blocked-by': [] },  // All deps satisfied
        { id: 'step-blocked', 'depends-on': ['step-ready'], 'blocked-by': ['step-ready'] },  // Still has blocker
      ],
    },
  ];

  const graph = buildDependencyGraphForPhase(phase, depGraphs, new Set());

  assert(graph !== null, 'Graph should not be null');

  const readyNode = graph!.nodes.find(n => n.id === 'step-ready')!;
  const blockedNode = graph!.nodes.find(n => n.id === 'step-blocked')!;

  assertEqual(readyNode.isReady, true, 'step-ready should be marked as ready');
  assertEqual(blockedNode.isReady, false, 'step-blocked should not be ready');

  // Check stats
  assertEqual(graph!.stats.readyNodes, 1, 'Should have 1 ready node');
});

// ============================================================================
// Test: Edge status based on source completion
// ============================================================================

test('buildDependencyGraphForPhase should set edge status correctly', async () => {
  const { buildDependencyGraphForPhase } = await import('./transforms.js');

  const phase: CompiledTopPhase = {
    id: 'edge-phase',
    status: 'in-progress',
    steps: [
      {
        id: 'step-complete',
        prompt: 'Completed',
        status: 'completed',
        'depends-on': [],
        phases: [],
      },
      {
        id: 'step-failed',
        prompt: 'Failed',
        status: 'failed',
        'depends-on': [],
        phases: [],
      },
      {
        id: 'step-pending',
        prompt: 'Pending',
        status: 'pending',
        'depends-on': [],
        phases: [],
      },
      {
        id: 'step-target',
        prompt: 'Target',
        status: 'pending',
        'depends-on': ['step-complete', 'step-failed', 'step-pending'],
        phases: [],
      },
    ] as any,
  };

  const depGraphs = [
    {
      'phase-id': 'edge-phase',
      nodes: [
        { id: 'step-complete', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-failed', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-pending', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-target', 'depends-on': ['step-complete', 'step-failed', 'step-pending'], 'blocked-by': ['step-pending'] },
      ],
    },
  ];

  const graph = buildDependencyGraphForPhase(phase, depGraphs, new Set());

  assert(graph !== null, 'Graph should not be null');
  assertEqual(graph!.edges.length, 3, 'Should have 3 edges');

  const edgeFromComplete = graph!.edges.find(e => e.from === 'step-complete')!;
  const edgeFromFailed = graph!.edges.find(e => e.from === 'step-failed')!;
  const edgeFromPending = graph!.edges.find(e => e.from === 'step-pending')!;

  assertEqual(edgeFromComplete.status, 'satisfied', 'Edge from completed should be satisfied');
  assertEqual(edgeFromFailed.status, 'failed', 'Edge from failed should be failed');
  assertEqual(edgeFromPending.status, 'pending', 'Edge from pending should be pending');
});

// ============================================================================
// Test: toStatusUpdateWithGraph integration
// ============================================================================

test('toStatusUpdateWithGraph should include dependency graphs', async () => {
  const { toStatusUpdateWithGraph } = await import('./transforms.js');

  const progress: CompiledProgress = {
    'sprint-id': 'test-sprint',
    status: 'in-progress',
    current: { phase: 0, step: 0, 'sub-phase': null },
    stats: {
      'started-at': '2025-01-20T10:00:00Z',
      'total-phases': 1,
      'completed-phases': 0,
    },
    phases: [
      {
        id: 'dev-phase',
        status: 'in-progress',
        steps: [
          {
            id: 'step-A',
            prompt: 'First step',
            status: 'completed',
            'depends-on': [],
            phases: [],
          },
          {
            id: 'step-B',
            prompt: 'Second step',
            status: 'in-progress',
            'depends-on': ['step-A'],
            phases: [],
          },
        ] as any,
      },
    ],
    'dependency-graph': [
      {
        'phase-id': 'dev-phase',
        nodes: [
          { id: 'step-A', 'depends-on': [], 'blocked-by': [] },
          { id: 'step-B', 'depends-on': ['step-A'], 'blocked-by': [] },
        ],
      },
    ],
  };

  const update = toStatusUpdateWithGraph(progress);

  assert(update.dependencyGraphs !== undefined, 'Should include dependencyGraphs');
  assertEqual(update.dependencyGraphs!.length, 1, 'Should have 1 dependency graph');
  assertEqual(update.hasParallelExecution ?? false, true, 'Should have parallel execution enabled');

  const graph = update.dependencyGraphs![0];
  assertEqual(graph.phaseId, 'dev-phase', 'Graph phaseId');
  assertEqual(graph.nodes.length, 2, 'Graph should have 2 nodes');
  assertEqual(graph.parallelEnabled, true, 'Graph should have parallel enabled');
});

// ============================================================================
// Test: buildDependencyGraphs with multiple phases
// ============================================================================

test('buildDependencyGraphs should build graphs for all phases with steps', async () => {
  const { buildDependencyGraphs } = await import('./transforms.js');

  const progress: CompiledProgress = {
    'sprint-id': 'multi-phase-sprint',
    status: 'in-progress',
    current: { phase: 1, step: 0, 'sub-phase': null },
    stats: {
      'started-at': '2025-01-20T10:00:00Z',
      'total-phases': 3,
      'completed-phases': 1,
    },
    phases: [
      {
        id: 'simple-phase',
        status: 'completed',
        prompt: 'No steps, just a prompt',
        // No steps - should not generate a graph
      },
      {
        id: 'phase-with-deps',
        status: 'in-progress',
        steps: [
          {
            id: 'step-1',
            prompt: 'Step 1',
            status: 'completed',
            'depends-on': [],
            phases: [],
          },
          {
            id: 'step-2',
            prompt: 'Step 2',
            status: 'in-progress',
            'depends-on': ['step-1'],
            phases: [],
          },
        ] as any,
      },
      {
        id: 'phase-no-deps',
        status: 'pending',
        steps: [
          {
            id: 'step-solo',
            prompt: 'Solo step',
            status: 'pending',
            phases: [],
          },
        ] as any,
      },
    ],
    'dependency-graph': [
      {
        'phase-id': 'phase-with-deps',
        nodes: [
          { id: 'step-1', 'depends-on': [], 'blocked-by': [] },
          { id: 'step-2', 'depends-on': ['step-1'], 'blocked-by': [] },
        ],
      },
    ],
  };

  const graphs = buildDependencyGraphs(progress);

  // Should have 2 graphs (one for each phase with steps)
  assertEqual(graphs.length, 2, 'Should have 2 graphs');

  // First graph should be for phase-with-deps
  const graph1 = graphs.find(g => g.phaseId === 'phase-with-deps');
  assert(graph1 !== undefined, 'Should have graph for phase-with-deps');
  assertEqual(graph1!.parallelEnabled, true, 'phase-with-deps should have parallel enabled');

  // Second graph should be for phase-no-deps (has steps but no dependency graph)
  const graph2 = graphs.find(g => g.phaseId === 'phase-no-deps');
  assert(graph2 !== undefined, 'Should have graph for phase-no-deps');
  assertEqual(graph2!.parallelEnabled, false, 'phase-no-deps should not have parallel enabled');
});

// ============================================================================
// Test: Empty phase (no steps) returns null
// ============================================================================

test('buildDependencyGraphForPhase should return null for phases without steps', async () => {
  const { buildDependencyGraphForPhase } = await import('./transforms.js');

  const phase: CompiledTopPhase = {
    id: 'empty-phase',
    status: 'pending',
    prompt: 'A simple phase with no steps',
    // No steps array
  };

  const graph = buildDependencyGraphForPhase(phase, [], new Set());

  assertEqual(graph, null, 'Should return null for phase without steps');
});

// ============================================================================
// Test: Label truncation
// ============================================================================

test('GraphNode labels should be truncated for long prompts', async () => {
  const { buildDependencyGraphForPhase } = await import('./transforms.js');

  const longPrompt = 'This is a very long prompt that exceeds the maximum label length and should be truncated with an ellipsis';

  const phase: CompiledTopPhase = {
    id: 'truncate-phase',
    status: 'in-progress',
    steps: [
      {
        id: 'step-long',
        prompt: longPrompt,
        status: 'pending',
        phases: [],
      },
    ] as any,
  };

  const graph = buildDependencyGraphForPhase(phase, [], new Set());

  assert(graph !== null, 'Graph should not be null');

  const node = graph!.nodes[0];
  assert(node.label.length <= 40, `Label should be truncated to 40 chars, got ${node.label.length}`);
  assert(node.label.endsWith('...'), 'Truncated label should end with ellipsis');
});

// ============================================================================
// Test: Stats calculation
// ============================================================================

test('buildDependencyGraphForPhase should calculate stats correctly', async () => {
  const { buildDependencyGraphForPhase } = await import('./transforms.js');

  const phase: CompiledTopPhase = {
    id: 'stats-phase',
    status: 'in-progress',
    steps: [
      { id: 'step-1', prompt: 'Completed', status: 'completed', phases: [] },
      { id: 'step-2', prompt: 'Completed', status: 'completed', phases: [] },
      { id: 'step-3', prompt: 'Running', status: 'in-progress', phases: [] },
      { id: 'step-4', prompt: 'Failed', status: 'failed', phases: [] },
      { id: 'step-5', prompt: 'Skipped', status: 'skipped', phases: [] },
      { id: 'step-6', prompt: 'Blocked', status: 'blocked', phases: [] },
      { id: 'step-7', prompt: 'Pending ready', status: 'pending', 'depends-on': [], phases: [] },
      { id: 'step-8', prompt: 'Pending blocked', status: 'pending', 'depends-on': ['step-3'], phases: [] },
    ] as any,
  };

  const depGraphs = [
    {
      'phase-id': 'stats-phase',
      nodes: [
        { id: 'step-1', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-2', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-3', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-4', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-5', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-6', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-7', 'depends-on': [], 'blocked-by': [] },
        { id: 'step-8', 'depends-on': ['step-3'], 'blocked-by': ['step-3'] },
      ],
    },
  ];

  const graph = buildDependencyGraphForPhase(phase, depGraphs, new Set());

  assert(graph !== null, 'Graph should not be null');

  assertEqual(graph!.stats.totalNodes, 8, 'totalNodes');
  assertEqual(graph!.stats.completedNodes, 2, 'completedNodes');
  assertEqual(graph!.stats.runningNodes, 1, 'runningNodes');
  assertEqual(graph!.stats.failedNodes, 1, 'failedNodes');
  assertEqual(graph!.stats.skippedNodes, 1, 'skippedNodes');
  // blocked status + pending with blockers = blockedNodes
  // step-6 (blocked) + step-8 (pending with blockers) = 2
  assertEqual(graph!.stats.blockedNodes, 2, 'blockedNodes');
  // step-7 is pending with no blockers = ready
  assertEqual(graph!.stats.readyNodes, 1, 'readyNodes');
});

// ============================================================================
// Test: Complex DAG shape - fork and join multiple times
// ============================================================================

test('buildDependencyGraphForPhase should handle complex fork-join DAG', async () => {
  const { buildDependencyGraphForPhase } = await import('./transforms.js');

  // Shape:
  //     A
  //    / \
  //   B   C
  //    \ /
  //     D
  //    / \
  //   E   F
  //    \ /
  //     G

  const phase: CompiledTopPhase = {
    id: 'complex-phase',
    status: 'in-progress',
    steps: [
      { id: 'A', prompt: 'Start', status: 'completed', 'depends-on': [], phases: [] },
      { id: 'B', prompt: 'Fork 1 Left', status: 'completed', 'depends-on': ['A'], phases: [] },
      { id: 'C', prompt: 'Fork 1 Right', status: 'completed', 'depends-on': ['A'], phases: [] },
      { id: 'D', prompt: 'Join 1', status: 'completed', 'depends-on': ['B', 'C'], phases: [] },
      { id: 'E', prompt: 'Fork 2 Left', status: 'in-progress', 'depends-on': ['D'], phases: [] },
      { id: 'F', prompt: 'Fork 2 Right', status: 'pending', 'depends-on': ['D'], phases: [] },
      { id: 'G', prompt: 'Final Join', status: 'pending', 'depends-on': ['E', 'F'], phases: [] },
    ] as any,
  };

  const depGraphs = [
    {
      'phase-id': 'complex-phase',
      nodes: [
        { id: 'A', 'depends-on': [], 'blocked-by': [] },
        { id: 'B', 'depends-on': ['A'], 'blocked-by': [] },
        { id: 'C', 'depends-on': ['A'], 'blocked-by': [] },
        { id: 'D', 'depends-on': ['B', 'C'], 'blocked-by': [] },
        { id: 'E', 'depends-on': ['D'], 'blocked-by': [] },
        { id: 'F', 'depends-on': ['D'], 'blocked-by': [] },
        { id: 'G', 'depends-on': ['E', 'F'], 'blocked-by': ['E', 'F'] },
      ],
    },
  ];

  const graph = buildDependencyGraphForPhase(phase, depGraphs, new Set());

  assert(graph !== null, 'Graph should not be null');
  assertEqual(graph!.nodes.length, 7, 'Should have 7 nodes');
  assertEqual(graph!.edges.length, 8, 'Should have 8 edges');

  // Check layout rows
  const nodeA = graph!.nodes.find(n => n.id === 'A')!;
  const nodeB = graph!.nodes.find(n => n.id === 'B')!;
  const nodeC = graph!.nodes.find(n => n.id === 'C')!;
  const nodeD = graph!.nodes.find(n => n.id === 'D')!;
  const nodeE = graph!.nodes.find(n => n.id === 'E')!;
  const nodeF = graph!.nodes.find(n => n.id === 'F')!;
  const nodeG = graph!.nodes.find(n => n.id === 'G')!;

  assertEqual(nodeA.layoutRow, 0, 'A at row 0');
  assertEqual(nodeB.layoutRow, 1, 'B at row 1');
  assertEqual(nodeC.layoutRow, 1, 'C at row 1');
  assertEqual(nodeD.layoutRow, 2, 'D at row 2');
  assertEqual(nodeE.layoutRow, 3, 'E at row 3');
  assertEqual(nodeF.layoutRow, 3, 'F at row 3');
  assertEqual(nodeG.layoutRow, 4, 'G at row 4');

  assertEqual(graph!.maxRow, 4, 'maxRow should be 4');
});

console.log('\nDependency Graph Transforms tests completed.\n');
