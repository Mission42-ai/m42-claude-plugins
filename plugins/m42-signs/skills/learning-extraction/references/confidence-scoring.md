---
title: Confidence Scoring Rubric
description: Framework for scoring learning confidence based on evidence strength and verification
keywords: confidence, scoring, evidence, verification, high medium low
file-type: reference
skill: learning-extraction
---

# Confidence Scoring

Framework for assigning confidence levels (high/medium/low) to extracted learnings based on evidence strength.

## Confidence Levels

| Level | Criteria | When to Assign |
|-------|----------|----------------|
| **High** | Clear pattern + explicit verification + highly reusable | Error resolved, tests pass, pattern used successfully multiple times |
| **Medium** | Good insight + reasonable evidence + somewhat reusable | Reasonable conclusion from investigation, single success, clear reasoning |
| **Low** | Possible pattern + limited evidence + context-specific | Speculation, single observation, unverified hypothesis |

## Evidence Types (Strongest to Weakest)

### 1. Verified Through Execution (Strongest)
**Examples**:
- Error occurred → investigated → fixed → tests pass
- Build failed → corrected → build succeeds
- Integration attempted → works correctly on first try

**Confidence**: High

**Example**: "When making TypeScript interface fields optional, ALL consumers must add null checks or build fails with TS18048."
- ✅ Error observed (TS18048)
- ✅ Root cause identified (optional field without null check)
- ✅ Fix verified (build succeeds after adding checks)
- **Confidence: High**

### 2. Explicitly Explained with Context
**Examples**:
- Detailed reasoning about why approach works
- Architectural explanation with supporting evidence
- Pattern observed across multiple files

**Confidence**: Medium to High

**Example**: "The compiler has three phases: parse → validate → emit. Validation must complete before emit."
- ✅ Explicit explanation of phases
- ✅ Rationale provided (emit relies on validation)
- ⚠️ Not verified through failure/recovery
- **Confidence: Medium-High**

### 3. Inferred from Investigation
**Examples**:
- Reading multiple related files reveals relationships
- Tool sequence suggests approach
- Successful complex operation

**Confidence**: Medium

**Example**: "Changes to WorkflowDefinition require updates to validate.ts, compile.ts, status-server.ts."
- ✅ Investigation sequence (read all three files)
- ⚠️ Not verified through actual breaking change
- **Confidence: Medium**

### 4. Single Observation
**Examples**:
- One-time successful command
- Single file read revealing pattern
- Isolated decision

**Confidence**: Low to Medium

**Example**: "Status server emits 'progress-update' events."
- ✅ Observed in code
- ⚠️ Not used in practice during session
- **Confidence: Low-Medium**

### 5. Speculation or Hypothesis (Weakest)
**Examples**:
- "This might cause...", "Could be...", "Possibly..."
- Unverified assumptions
- Guesses without evidence

**Confidence**: Low (consider skipping)

**Example**: "This might be why the tests are flaky."
- ❌ Not investigated
- ❌ Not verified
- **Confidence: Low** (skip unless investigated)

## Scoring Decision Tree

```
Was the learning verified through execution (error fixed, test passed)?
├─ YES → High Confidence
└─ NO
    └─ Was it explicitly explained with clear rationale?
        ├─ YES → Medium-High Confidence
        └─ NO
            └─ Was it inferred from multi-file investigation or successful operation?
                ├─ YES → Medium Confidence
                └─ NO
                    └─ Was it a single observation or educated guess?
                        ├─ Single observation → Low-Medium Confidence
                        └─ Guess/speculation → Low Confidence (consider skipping)
```

## Reusability Impact on Confidence

Reusability affects final confidence score:

| Reusability Scope | Confidence Adjustment |
|-------------------|----------------------|
| **Broadly applicable** (many similar future tasks) | +0 (maintain score) |
| **Narrowly applicable** (specific scenario) | -1 level (e.g., High → Medium) |
| **One-time only** (won't recur) | Skip extraction |

**Example**: 
- Learning: "yq requires `yq '.key['"$VAR"']'` syntax for variable expansion"
- Evidence: Error → investigation → fix → success (High)
- Reusability: Applies to all shell scripts using yq (Broad)
- **Final Confidence: High**

**Example**:
- Learning: "Test file tests/integration/workflow.test.ts requires fixture setup"
- Evidence: Test failed → added fixture → test passed (High)
- Reusability: Only for this specific test file (Narrow)
- **Final Confidence: Medium** (reduced from High due to narrow scope)

## Confidence Thresholds

### Minimum for Extraction

| Confidence | Extract? | Notes |
|------------|----------|-------|
| **High** | ✅ Always | Strong evidence, highly reliable |
| **Medium** | ✅ Usually | Good insight, reasonable confidence |
| **Low** | ⚠️ Selective | Only if fills important gap |

### Confidence Filters

Commands may allow confidence filtering:
- `--confidence-min high`: Only extract high-confidence learnings
- `--confidence-min medium`: Extract high + medium (default)
- `--confidence-min low`: Extract all (noisy, use sparingly)

## Evidence Checklist

Use this checklist when scoring confidence:

**High Confidence Requires**:
- [ ] Clear pattern observed
- [ ] Explicitly verified (error fixed, test passed, operation succeeded)
- [ ] Highly reusable across similar tasks
- [ ] Strong causal link (know WHY it works)

**Medium Confidence Requires** (2 of 4):
- [ ] Pattern observed
- [ ] Some verification (investigation, reasoning, single success)
- [ ] Somewhat reusable
- [ ] Reasonable explanation

**Low Confidence** (anything else):
- Single observation without verification
- Speculation or hypothesis
- Very narrow applicability
- Unclear causality

## Common Scenarios

| Scenario | Evidence | Confidence |
|----------|----------|------------|
| Build error → fix → build succeeds | Execution verification | High |
| Read 3+ related files, notice pattern | Multi-file investigation | Medium |
| Complex command works on first try | Single success | Medium |
| Explained architectural reasoning | Explicit explanation | Medium-High |
| "This file probably uses..." | Speculation | Low (skip) |
| Pattern observed in 1 file only | Single observation | Low-Medium |
| Error fixed but unsure why fix works | Weak causality | Medium |
| Successfully integrated 2 systems | Integration success | Medium-High |

## Adjusting Confidence Post-Extraction

During quality review, confidence may be adjusted:

**Increase confidence** if:
- Additional evidence found in later transcript sections
- Pattern confirmed across multiple occurrences
- Explicit verification discovered

**Decrease confidence** if:
- Evidence weaker than initially assessed
- Reusability narrower than expected
- Causality unclear

**Skip extraction** if:
- Confidence drops to Low
- Learning becomes duplicate after investigation
- Evidence insufficient upon deeper review
