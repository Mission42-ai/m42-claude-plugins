/**
 * Progress Injector - Dynamic Step Injection into Running Sprints
 *
 * Allows adding steps to PROGRESS.yaml at runtime:
 * - Add single steps to a specific position
 * - Compile a workflow to add multiple steps
 * - Choose insertion point (after current, end of phase, specific position)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  readProgress,
  writeProgressAtomic,
  backupProgress,
  cleanupBackup,
  type CompiledProgress,
} from './yaml-ops.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Position types for step injection
 */
export type InsertPosition =
  | { type: 'after-current' }
  | { type: 'after-step'; stepId: string }
  | { type: 'end-of-phase'; phaseId: string }
  | { type: 'end-of-workflow' }
  | { type: 'before-step'; stepId: string };

/**
 * Single step injection request
 */
export interface StepInjection {
  step: {
    id: string;
    prompt: string;
    model?: string;
  };
  position: InsertPosition;
}

/**
 * Workflow injection request
 */
export interface WorkflowInjection {
  workflow: string;
  context?: {
    step?: { prompt: string; id: string };
    variables?: Record<string, unknown>;
  };
  position: InsertPosition;
  idPrefix: string;
}

/**
 * Injected phase marker
 */
export interface InjectedPhase {
  id: string;
  status: 'pending';
  prompt: string;
  injected: true;
  'injected-at': string;
  model?: string;
}

// ============================================================================
// ProgressInjector Class
// ============================================================================

export class ProgressInjector {
  private progressPath: string;
  private workflowsDir: string | null;

  constructor(progressPath: string, workflowsDir?: string) {
    this.progressPath = progressPath;
    this.workflowsDir = workflowsDir ?? null;
  }

  /**
   * Inject a single step into the progress file
   */
  async injectStep(injection: StepInjection): Promise<void> {
    const progress = readProgress(this.progressPath);
    const insertIndex = this.resolvePosition(progress, injection.position);

    // Create injected phase
    const phase: InjectedPhase = {
      id: injection.step.id,
      status: 'pending',
      prompt: injection.step.prompt,
      injected: true,
      'injected-at': new Date().toISOString(),
    };

    if (injection.step.model) {
      phase.model = injection.step.model;
    }

    // Insert at position
    const phases = (progress.phases ?? []) as unknown[];
    phases.splice(insertIndex, 0, phase);
    progress.phases = phases;

    // Recalculate stats
    this.updateStats(progress);

    // Write atomically
    backupProgress(this.progressPath);
    await writeProgressAtomic(this.progressPath, progress);
    cleanupBackup(this.progressPath);
  }

  /**
   * Inject a compiled workflow into the progress file
   */
  async injectWorkflow(injection: WorkflowInjection): Promise<void> {
    // Load workflow phases
    const workflowPhases = this.loadWorkflowPhases(injection.workflow);

    const progress = readProgress(this.progressPath);
    const insertIndex = this.resolvePosition(progress, injection.position);

    // Create injected phases with prefix
    const now = new Date().toISOString();
    const injectedPhases: InjectedPhase[] = workflowPhases.map((p) => ({
      id: `${injection.idPrefix}-${p.id}`,
      status: 'pending' as const,
      prompt: p.prompt,
      injected: true as const,
      'injected-at': now,
      ...(p.model ? { model: p.model } : {}),
    }));

    // Insert all phases at position
    const phases = (progress.phases ?? []) as unknown[];
    phases.splice(insertIndex, 0, ...injectedPhases);
    progress.phases = phases;

    // Recalculate stats
    this.updateStats(progress);

    // Write atomically
    backupProgress(this.progressPath);
    await writeProgressAtomic(this.progressPath, progress);
    cleanupBackup(this.progressPath);
  }

  /**
   * Resolve position to insert index
   */
  private resolvePosition(progress: CompiledProgress, pos: InsertPosition): number {
    const phases = (progress.phases ?? []) as { id: string }[];

    switch (pos.type) {
      case 'after-current':
        return progress.current.phase + 1;

      case 'after-step': {
        const index = this.findStepIndex(phases, pos.stepId);
        return index + 1;
      }

      case 'before-step': {
        return this.findStepIndex(phases, pos.stepId);
      }

      case 'end-of-workflow':
        return phases.length;

      case 'end-of-phase': {
        // For end-of-phase, find the phase and return index after it
        const index = this.findStepIndex(phases, pos.phaseId);
        return index + 1;
      }

      default:
        throw new Error(`Unknown position type: ${(pos as { type: string }).type}`);
    }
  }

  /**
   * Find index of step by ID
   */
  private findStepIndex(phases: { id: string }[], stepId: string): number {
    const index = phases.findIndex((p) => p.id === stepId);
    if (index === -1) {
      throw new Error(`Step not found: ${stepId}`);
    }
    return index;
  }

  /**
   * Recalculate stats after injection
   */
  private updateStats(progress: CompiledProgress): void {
    const phases = (progress.phases ?? []) as {
      status?: string;
      steps?: { phases: { status?: string }[] }[];
    }[];

    let totalPhases = 0;
    let completedPhases = 0;

    for (const phase of phases) {
      // Count the phase itself
      totalPhases++;
      if (phase.status === 'completed') {
        completedPhases++;
      }

      if (phase.steps) {
        // For-each phase: also count sub-phases within steps
        for (const step of phase.steps) {
          totalPhases += step.phases.length;
          for (const subPhase of step.phases) {
            if (subPhase.status === 'completed') {
              completedPhases++;
            }
          }
        }
      }
    }

    progress.stats['total-phases'] = totalPhases;
    progress.stats['completed-phases'] = completedPhases;
  }

  /**
   * Load workflow phases from YAML file
   */
  private loadWorkflowPhases(
    workflowName: string
  ): { id: string; prompt: string; model?: string }[] {
    const workflowPath = this.findWorkflowPath(workflowName);
    if (!workflowPath) {
      throw new Error(`Workflow not found: ${workflowName}`);
    }

    const content = fs.readFileSync(workflowPath, 'utf8');
    const workflow = yaml.load(content) as {
      phases?: { id: string; prompt?: string; model?: string }[];
    };

    return (workflow.phases ?? [])
      .filter((p) => p.prompt)
      .map((p) => ({ id: p.id, prompt: p.prompt!, model: p.model }));
  }

  /**
   * Find workflow file path
   */
  private findWorkflowPath(workflowName: string): string | null {
    if (!this.workflowsDir) {
      // Try to find workflows directory relative to progress file
      const sprintDir = path.dirname(this.progressPath);
      const possibleDirs = [
        path.join(sprintDir, '.claude', 'workflows'),
        path.join(sprintDir, 'workflows'),
      ];

      for (const dir of possibleDirs) {
        const foundPath = this.tryFindWorkflow(dir, workflowName);
        if (foundPath) return foundPath;
      }

      return null;
    }

    return this.tryFindWorkflow(this.workflowsDir, workflowName);
  }

  /**
   * Try to find workflow file in a directory
   */
  private tryFindWorkflow(dir: string, workflowName: string): string | null {
    const possiblePaths = [
      path.join(dir, `${workflowName}.yaml`),
      path.join(dir, `${workflowName}.yml`),
      path.join(dir, workflowName),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }
}
