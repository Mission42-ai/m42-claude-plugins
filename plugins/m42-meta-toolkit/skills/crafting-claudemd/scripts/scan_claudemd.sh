#!/usr/bin/env bash
# scan_claudemd.sh - Discover all CLAUDE.md configuration files in a project
#
# Usage: scan_claudemd.sh [project-root]
#   project-root: Directory to scan (default: current directory)
#
# Output: Structured report of all CLAUDE.md files, rules, and local overrides
#         with line counts and loading behavior annotations.

set -euo pipefail

PROJECT_ROOT="${1:-.}"
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"

echo "=== CLAUDE.md Configuration Scan ==="
echo "Project: $PROJECT_ROOT"
echo ""

# Track totals
TOTAL_FILES=0
TOTAL_LINES=0

# --- Section 1: Root-level files (loaded at startup) ---
echo "## Startup-loaded files"
echo ""

for pattern in CLAUDE.md .claude/CLAUDE.md; do
  filepath="$PROJECT_ROOT/$pattern"
  if [ -f "$filepath" ]; then
    lines=$(wc -l < "$filepath")
    TOTAL_FILES=$((TOTAL_FILES + 1))
    TOTAL_LINES=$((TOTAL_LINES + lines))
    echo "  $pattern  ($lines lines) [startup]"
  fi
done

# --- Section 2: Local overrides (not version controlled) ---
if [ -f "$PROJECT_ROOT/CLAUDE.local.md" ]; then
  lines=$(wc -l < "$PROJECT_ROOT/CLAUDE.local.md")
  TOTAL_FILES=$((TOTAL_FILES + 1))
  TOTAL_LINES=$((TOTAL_LINES + lines))
  echo "  CLAUDE.local.md  ($lines lines) [startup, personal]"
fi

echo ""

# --- Section 3: Rules directory ---
echo "## Rules directory (.claude/rules/)"
echo ""

rules_dir="$PROJECT_ROOT/.claude/rules"
if [ -d "$rules_dir" ]; then
  rule_count=0
  while IFS= read -r -d '' rulefile; do
    relpath="${rulefile#"$PROJECT_ROOT/"}"
    lines=$(wc -l < "$rulefile")
    TOTAL_FILES=$((TOTAL_FILES + 1))
    TOTAL_LINES=$((TOTAL_LINES + lines))
    rule_count=$((rule_count + 1))

    # Check for paths: frontmatter (conditional rule)
    if head -5 "$rulefile" | grep -q "^paths:" 2>/dev/null; then
      echo "  $relpath  ($lines lines) [conditional]"
    else
      echo "  $relpath  ($lines lines) [always-on]"
    fi
  done < <(find "$rules_dir" -name "*.md" -type f -print0 | sort -z)

  if [ "$rule_count" -eq 0 ]; then
    echo "  (no rule files found)"
  fi
else
  echo "  (directory not found)"
fi

echo ""

# --- Section 4: Subfolder CLAUDE.md files (lazy-loaded) ---
echo "## Subfolder CLAUDE.md files (lazy-loaded)"
echo ""

subfolder_count=0
while IFS= read -r -d '' subfile; do
  # Skip root-level files already reported
  relpath="${subfile#"$PROJECT_ROOT/"}"
  dir=$(dirname "$relpath")
  if [ "$dir" = "." ] || [ "$dir" = ".claude" ]; then
    continue
  fi

  lines=$(wc -l < "$subfile")
  TOTAL_FILES=$((TOTAL_FILES + 1))
  TOTAL_LINES=$((TOTAL_LINES + lines))
  subfolder_count=$((subfolder_count + 1))
  echo "  $relpath  ($lines lines) [lazy]"
done < <(find "$PROJECT_ROOT" \( -name "CLAUDE.md" -o -name "CLAUDE.local.md" \) -print0 | sort -z)

if [ "$subfolder_count" -eq 0 ]; then
  echo "  (none found)"
fi

echo ""

# --- Section 5: User-level files ---
echo "## User-level files"
echo ""

user_claude="$HOME/.claude/CLAUDE.md"
if [ -f "$user_claude" ]; then
  lines=$(wc -l < "$user_claude")
  echo "  ~/.claude/CLAUDE.md  ($lines lines) [global]"
else
  echo "  ~/.claude/CLAUDE.md  (not found)"
fi

user_rules="$HOME/.claude/rules"
if [ -d "$user_rules" ]; then
  while IFS= read -r -d '' userule; do
    relpath="${userule#"$HOME/"}"
    lines=$(wc -l < "$userule")
    echo "  ~/$relpath  ($lines lines) [global rule]"
  done < <(find "$user_rules" -name "*.md" -type f -print0 | sort -z)
fi

echo ""

# --- Summary ---
echo "## Summary"
echo "  Total project files: $TOTAL_FILES"
echo "  Total project lines: $TOTAL_LINES"

if [ "$TOTAL_LINES" -gt 500 ]; then
  echo "  WARNING: Total lines exceed 500 - consider splitting or pruning"
elif [ "$TOTAL_LINES" -gt 300 ]; then
  echo "  NOTE: Total lines above 300 - review for unnecessary content"
else
  echo "  OK: Total lines within recommended budget"
fi
