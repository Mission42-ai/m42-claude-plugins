"use strict";
/**
 * TypeScript interfaces for the Sprint Workflow System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.guards = void 0;
/**
 * Guard functions object - provides reusable condition checks for transitions.
 */
exports.guards = {
    /** Check if there are more phases to process */
    hasMorePhases: (_state, ctx, _event) => {
        return ctx.current.phase < (ctx.phases?.length ?? 0) - 1;
    },
    /** Check if there are more steps within the current phase */
    hasMoreSteps: (_state, ctx, _event) => {
        if (ctx.current.step === null)
            return false;
        const phase = ctx.phases?.[ctx.current.phase];
        if (!phase?.steps)
            return false;
        return ctx.current.step < phase.steps.length - 1;
    },
    /** Check if there are more sub-phases within the current step */
    hasMoreSubPhases: (_state, ctx, _event) => {
        if (ctx.current.step === null || ctx.current['sub-phase'] === null)
            return false;
        const phase = ctx.phases?.[ctx.current.phase];
        const step = phase?.steps?.[ctx.current.step];
        if (!step?.phases)
            return false;
        return ctx.current['sub-phase'] < step.phases.length - 1;
    },
    /** Check if the error is retryable based on retry configuration */
    isRetryable: (_state, ctx, event) => {
        if (event.type !== 'PHASE_FAILED' && event.type !== 'STEP_FAILED')
            return false;
        if (!ctx.retry?.retryOn)
            return false;
        return ctx.retry.retryOn.includes(event.category);
    },
    /** Check if there are steps in the step queue */
    hasStepQueue: (_state, ctx, _event) => {
        return (ctx['step-queue']?.length ?? 0) > 0;
    },
    /** Check if orchestration is enabled */
    orchestrationEnabled: (_state, ctx, _event) => {
        return ctx.orchestration?.enabled === true;
    },
    /** Check if auto-approve is enabled for orchestration */
    autoApproveEnabled: (_state, ctx, _event) => {
        return ctx.orchestration?.autoApprove === true;
    },
};
//# sourceMappingURL=types.js.map