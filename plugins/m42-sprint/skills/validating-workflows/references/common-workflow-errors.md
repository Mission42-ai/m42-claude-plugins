---
title: Common Workflow Validation Errors
description: Catalog of frequent workflow validation errors with explanations and fixes
keywords: validation errors, workflow errors, troubleshooting, error fixes
file-type: reference
skill: validating-workflows
---

# Common Workflow Validation Errors

## Structure Errors

| Error Code | Message | Cause | Fix |
|------------|---------|-------|-----|
| MISSING_WORKFLOW_NAME | Workflow must have a name | Missing `name` field | Add `name: "Workflow Name"` |
| MISSING_PHASES | Workflow must have a phases array | Missing or non-array `phases` | Add `phases: []` |
| EMPTY_WORKFLOW | Workflow has zero phases | Empty `phases` array | Add at least one phase |
| INVALID_WORKFLOW | Workflow must be a valid YAML object | Malformed YAML | Fix YAML syntax errors |

## Phase Errors

| Error Code | Message | Cause | Fix |
|------------|---------|-------|-----|
| MISSING_PHASE_ID | Phase must have an id | Missing `id` field in phase | Add `id: "phase-name"` to each phase |
| DUPLICATE_PHASE_ID | Duplicate phase ID | Two phases with same `id` | Ensure all phase IDs are unique |
| PHASE_MISSING_ACTION | Phase must have prompt, for-each, or workflow | Phase missing action | Add `prompt`, `for-each`, or `workflow` field |
| PROMPT_WORKFLOW_MUTUAL_EXCLUSIVE | Phase cannot have both prompt and workflow | Both `prompt` and `workflow` specified | Remove either `prompt` or `workflow` |

## Collection Errors

| Error Code | Message | Cause | Fix |
|------------|---------|-------|-----|
| COLLECTION_NOT_FOUND | Phase references non-existent collection | `for-each` references missing collection | Ensure collection exists in SPRINT.yaml or fix collection name |
| INVALID_FOREACH | for-each must be a string | `for-each` is not a string | Use string value: `for-each: "step"` |
| EMPTY_FOREACH | for-each cannot be empty | `for-each: ""` | Provide collection name: `for-each: "step"` |
| INVALID_COLLECTION_REF | collection must be a string | `collection` field not string | Use string value: `collection: "my-collection"` |

## Model Selection Errors

| Error Code | Message | Cause | Fix |
|------------|---------|-------|-----|
| INVALID_MODEL | Invalid model value | Model not in [sonnet, opus, haiku] | Use valid model: `model: "sonnet"` |

## Workflow Reference Errors

| Error Code | Message | Cause | Fix |
|------------|---------|-------|-----|
| WORKFLOW_NOT_FOUND | Referenced workflow file not found | `workflow` field points to missing file | Ensure workflow file exists at specified path |
| CIRCULAR_WORKFLOW_REF | Circular workflow reference detected | Workflow A includes B includes A | Remove circular dependency |

## Gate Errors

| Error Code | Message | Cause | Fix |
|------------|---------|-------|-----|
| GATE_MISSING_SCRIPT | Gate must have a script property | Missing `script` in gate | Add `script: "bash command"` |
| GATE_EMPTY_SCRIPT | Gate script cannot be empty | Empty `script` value | Provide non-empty script command |
| GATE_MISSING_ON_FAIL | Gate must have an on-fail configuration | Missing `on-fail` in gate | Add `on-fail: {prompt: "..."}` |
| GATE_MISSING_ON_FAIL_PROMPT | Gate on-fail must have a prompt | Missing `prompt` in `on-fail` | Add `prompt: "Fix instructions"` |
| GATE_INVALID_MAX_RETRIES | Gate on-fail max-retries must be positive integer | Invalid `max-retries` value | Use: `max-retries: 3` |
| GATE_INVALID_TIMEOUT | Gate timeout must be positive number | Invalid `timeout` value | Use: `timeout: 30` (seconds) |

## Worktree Configuration Errors

| Error Code | Message | Cause | Fix |
|------------|---------|-------|-----|
| WORKTREE_MISSING_ENABLED | Worktree configuration must specify enabled | Missing `enabled` field | Add `enabled: true` or `enabled: false` |
| WORKTREE_INVALID_BRANCH_NAME | Worktree branch is not valid git branch name | Invalid characters or format | Use valid git branch name format |
| WORKTREE_INVALID_CLEANUP_MODE | Worktree cleanup must be valid mode | Invalid `cleanup` value | Use: never, on-complete, or on-merge |

## Ralph Mode Errors

| Error Code | Message | Cause | Fix |
|------------|---------|-------|-----|
| RALPH_MISSING_GOAL | Ralph mode requires goal field | Missing `goal` in SPRINT.yaml | Add `goal: "Sprint objective"` |
| RALPH_INVALID_HOOK | Per-iteration hook must have workflow or prompt | Hook missing both fields | Add either `workflow` or `prompt` |
| HOOK_AMBIGUOUS_ACTION | Hook cannot have both workflow and prompt | Both fields specified | Remove either `workflow` or `prompt` |
| RALPH_INVALID_HOOK_OVERRIDE | Hook override doesn't match workflow hook | Invalid hook ID in override | Use hook ID from workflow definition |

## Variable Template Errors

| Error Code | Message | Cause | Fix |
|------------|---------|-------|-----|
| UNRESOLVED_VARIABLES | Unresolved template variables | Variables like `{var}` not substituted | Ensure variable is defined or use --strict mode |

## Warning Codes (Non-Blocking)

| Warning Code | Message | Recommended Action |
|--------------|---------|-------------------|
| PARALLEL_FOREACH_WARNING | parallel: true on for-each not supported | Move `parallel: true` to item workflow phases instead |
| SCHEMA_VERSION_OUTDATED | Schema version is outdated | Update to current schema version |
