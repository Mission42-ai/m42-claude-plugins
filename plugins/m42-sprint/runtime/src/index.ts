/**
 * Public API exports for @m42/sprint-runtime
 *
 * This module exports the main loop functionality for programmatic usage.
 */

// Re-export main loop functionality
export {
  runLoop,
  LoopOptions,
  LoopResult,
  LoopDependencies,
  isTerminalState,
  recoverFromInterrupt,
} from './loop.js';

// Re-export types that may be needed
export type {
  SprintState,
  SprintEvent,
  CompiledProgress,
} from './transition.js';
