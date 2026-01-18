# Step Context: step-5

## Task
## Phase 2.3: Target CLAUDE.md Inference

Implement logic to infer where signs should be stored:

### Tasks
1. Create scripts/infer-target.sh:
   - Input: file paths from tool calls
   - Extract common directory prefix
   - Check for existing CLAUDE.md in hierarchy
   - Suggest target CLAUDE.md path

2. Add rules:
   - Scripts/automation -> scripts/CLAUDE.md
   - API code -> api/CLAUDE.md
   - General/cross-cutting -> project root CLAUDE.md
   - Tool-specific -> create new CLAUDE.md if needed

3. Support manual override in extraction

### Success Criteria
- Inference is accurate for 90% of cases
- Edge cases have reasonable defaults
- User can override if needed

## Related Code Patterns

### Similar Implementation: plugins/m42-signs/scripts/find-retry-patterns.sh
```bash
#!/bin/bash
set -euo pipefail

# Header comment pattern with usage
# Usage: find-retry-patterns.sh <session-file.jsonl>
# Output: JSON with patterns array including confidence scores

FILE="${1:-}"

if [[ -z "$FILE" ]]; then
  echo "Error: Session file path required" >&2
  echo "Usage: find-retry-patterns.sh <session-file.jsonl>" >&2
  exit 1
fi

# Check required tool
if ! command -v jq &> /dev/null; then
  echo "Error: Required tool 'jq' is not installed" >&2
  exit 1
fi
```

### Similar Implementation: plugins/m42-signs/scripts/validate-backlog.sh
```bash
# Reporting results pattern
if [[ ${#ERRORS[@]} -eq 0 ]]; then
  echo "Validation passed."
  exit 0
else
  echo "Validation FAILED:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  exit 1
fi
```

### File Path Extraction in find-retry-patterns.sh
```jq
# Path extraction from tool inputs
if tool == "Read" or tool == "Write" then
  {
    field: "file_path",
    from: (failed.file_path // failed.path // null),
    to: (success.file_path // success.path // null)
  }
elif tool == "Edit" then
  {
    field: "file_path",
    from: (failed.file_path // null),
    to: (success.file_path // null)
  }
```

## Required Imports
### Internal
- No imports needed - standalone bash script

### External
- `jq`: JSON processing (optional, only for --json flag)
- Standard bash utilities: `dirname`, `basename`, `realpath`

## Types/Interfaces to Use
### Input Format
The script receives file paths as positional arguments:
```bash
infer-target.sh "src/foo.ts" "src/bar.ts" "tests/test.ts"
infer-target.sh --json "scripts/build.sh" "scripts/test.sh"
```

### Output Format (plain)
Single line with target path:
```
CLAUDE.md
scripts/CLAUDE.md
plugins/m42-signs/CLAUDE.md
```

### Output Format (JSON with --json flag)
```json
{
  "target": "scripts/CLAUDE.md",
  "reasoning": "Common prefix is scripts/, existing CLAUDE.md found at scripts/CLAUDE.md"
}
```

## Integration Points
- **Called by**: Future extraction command (step-7) will use this to infer targets
- **Calls**: Standard filesystem operations only
- **Tests**: Verification via Gherkin scenarios in artifacts/step-5-gherkin.md

### Gherkin Scenarios to Satisfy
1. Script exists at `plugins/m42-signs/scripts/infer-target.sh`
2. Script is executable
3. Handles missing arguments with usage message
4. Cross-cutting paths → root CLAUDE.md
5. Common prefix paths → subdirectory CLAUDE.md
6. Detects existing CLAUDE.md in hierarchy
7. Output is valid path ending in CLAUDE.md
8. JSON output mode with `--json` flag

## Implementation Notes

### Algorithm for Common Prefix Extraction
1. Split each path into directory components
2. Find longest common prefix across all paths
3. Return the common prefix directory

### Hierarchy Check Rules
1. From common prefix, walk UP the directory tree
2. At each level, check if CLAUDE.md exists
3. If found, suggest that existing CLAUDE.md
4. If not found, suggest common prefix + CLAUDE.md

### Fallback Rules
| Path Pattern | Target |
|-------------|--------|
| Paths from different top-level dirs | CLAUDE.md (root) |
| All paths in same subdir | {subdir}/CLAUDE.md |
| Existing CLAUDE.md in hierarchy | Use existing |
| Single file path | Parent dir + CLAUDE.md |

### Edge Cases
- Empty input → error with usage message
- Single path → use parent directory
- Relative vs absolute paths → handle both
- Non-existent paths → still compute prefix (don't require existence)
- Paths with trailing slashes → normalize

### Script Header Template
```bash
#!/bin/bash
set -euo pipefail

# Infer target CLAUDE.md for learning signs based on file paths
# Analyzes paths to find common directory prefix and existing CLAUDE.md files
#
# Usage: infer-target.sh [--json] <path1> [path2] [path3] ...
# Output: Target CLAUDE.md path (plain text or JSON with --json flag)
```
