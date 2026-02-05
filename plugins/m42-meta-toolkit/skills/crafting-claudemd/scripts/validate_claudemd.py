#!/usr/bin/env python3
"""
validate_claudemd.py - Validate CLAUDE.md files against best practices

Usage:
    validate_claudemd.py <file-or-directory>
    validate_claudemd.py /path/to/CLAUDE.md        # Validate single file
    validate_claudemd.py /path/to/project           # Validate all CLAUDE.md files

Checks:
    - File size and line count (warns >300 lines, errors >500)
    - Structural issues (heading hierarchy, section organization)
    - Anti-patterns (vague instructions, duplicate linter rules, over-specification)
    - Writing style (imperative form, negative-only constraints, emphasis overuse)
    - Content coverage (essential sections present)
"""

import sys
import re
from pathlib import Path

PASS = "\033[32m✓\033[0m"
WARN = "\033[33m⚠\033[0m"
FAIL = "\033[31m✗\033[0m"
INFO = "\033[36mℹ\033[0m"


def find_claudemd_files(target: Path) -> list[Path]:
    """Find all CLAUDE.md and CLAUDE.local.md files in target."""
    if target.is_file():
        return [target]
    files = []
    for pattern in ["**/CLAUDE.md", "**/CLAUDE.local.md"]:
        files.extend(target.glob(pattern))
    return sorted(set(files))


def check_size(content: str, lines: list[str]) -> list[tuple[str, str, str]]:
    """Check file size constraints."""
    results = []
    line_count = len(lines)
    char_count = len(content)

    if line_count > 500:
        results.append((FAIL, "Line count", f"{line_count} lines (max recommended: 500)"))
    elif line_count > 300:
        results.append((WARN, "Line count", f"{line_count} lines (sweet spot: <300)"))
    else:
        results.append((PASS, "Line count", f"{line_count} lines"))

    if char_count > 12000:
        results.append((WARN, "Character count", f"{char_count} chars (Windsurf limit: 12,000)"))
    else:
        results.append((PASS, "Character count", f"{char_count} chars"))

    return results


def check_structure(lines: list[str]) -> list[tuple[str, str, str]]:
    """Check heading hierarchy and structure."""
    results = []
    headings = []

    for i, line in enumerate(lines, 1):
        match = re.match(r'^(#{1,6})\s+(.+)', line)
        if match:
            level = len(match.group(1))
            headings.append((i, level, match.group(2).strip()))

    # Check for H1
    h1_count = sum(1 for _, level, _ in headings if level == 1)
    if h1_count == 0:
        results.append((WARN, "H1 heading", "No H1 heading found (optional but recommended for project identity)"))
    elif h1_count > 1:
        results.append((WARN, "H1 heading", f"Multiple H1 headings ({h1_count}) - consider using one"))
    else:
        results.append((PASS, "H1 heading", "Single H1 heading"))

    # Check heading level jumps
    skip_found = False
    for idx in range(1, len(headings)):
        prev_level = headings[idx - 1][1]
        curr_level = headings[idx][1]
        if curr_level > prev_level + 1:
            line_no = headings[idx][0]
            results.append((WARN, f"Heading skip (line {line_no})",
                          f"H{prev_level} -> H{curr_level} (skipped H{prev_level + 1})"))
            skip_found = True

    if not skip_found and headings:
        results.append((PASS, "Heading hierarchy", "No level skips"))

    return results


def check_antipatterns(content: str, lines: list[str]) -> list[tuple[str, str, str]]:
    """Check for common anti-patterns."""
    results = []

    # Vague instructions
    vague_patterns = [
        (r'\b(format|write|handle)\s+(code\s+)?properly\b', "vague instruction"),
        (r'\bbe careful with\b', "vague instruction"),
        (r'\btry to\b', "weak instruction (use imperative)"),
        (r'\bplease\b', "unnecessary politeness (use imperative)"),
    ]
    vague_count = 0
    for pattern, desc in vague_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        if matches:
            vague_count += len(matches)

    if vague_count == 0:
        results.append((PASS, "Vague instructions", "None detected"))
    elif vague_count <= 2:
        results.append((WARN, "Vague instructions", f"{vague_count} found - consider making more specific"))
    else:
        results.append((FAIL, "Vague instructions", f"{vague_count} found - rewrite as specific directives"))

    # Negative-only constraints (prohibitions without alternatives)
    negative_only = re.findall(
        r'^[*-]\s*(?:never|don\'?t|do not|avoid)\s+[^.]+(?:\.|$)',
        content, re.MULTILINE | re.IGNORECASE
    )
    # Filter out those that include "instead" or "prefer" or "use X"
    truly_negative = [n for n in negative_only
                      if not re.search(r'\b(instead|prefer|use|rather)\b', n, re.IGNORECASE)]
    if truly_negative:
        results.append((WARN, "Negative-only constraints",
                        f"{len(truly_negative)} prohibitions without alternatives"))
    else:
        results.append((PASS, "Negative-only constraints", "All prohibitions include alternatives"))

    # Emphasis overuse
    important_count = len(re.findall(r'\bIMPORTANT\b', content))
    must_count = len(re.findall(r'\bMUST\b', content))
    never_caps = len(re.findall(r'\bNEVER\b', content))
    emphasis_total = important_count + must_count + never_caps

    if emphasis_total > 10:
        results.append((FAIL, "Emphasis overuse",
                        f"{emphasis_total} emphatic markers (IMPORTANT/MUST/NEVER) - dilutes impact"))
    elif emphasis_total > 5:
        results.append((WARN, "Emphasis overuse",
                        f"{emphasis_total} emphatic markers - consider reserving for critical rules"))
    else:
        results.append((PASS, "Emphasis usage", f"{emphasis_total} emphatic markers (appropriate)"))

    # Obvious structure documentation
    obvious_patterns = [
        r'the\s+[/`]?tests[/`]?\s+(?:directory|folder)\s+contains\s+test',
        r'the\s+[/`]?src[/`]?\s+(?:directory|folder)\s+contains\s+source',
        r'the\s+[/`]?components[/`]?\s+(?:directory|folder)\s+contains\s+component',
    ]
    obvious_count = sum(1 for p in obvious_patterns if re.search(p, content, re.IGNORECASE))
    if obvious_count:
        results.append((WARN, "Obvious documentation",
                        f"{obvious_count} statements explaining obvious directory structure"))
    else:
        results.append((PASS, "Obvious documentation", "No trivially obvious statements"))

    # @import overuse
    import_count = len(re.findall(r'^@\S+\.md\s*$', content, re.MULTILINE))
    if import_count > 5:
        results.append((WARN, "@import usage",
                        f"{import_count} @imports (each loads at startup - consider motivated pointers)"))
    else:
        results.append((PASS, "@import usage", f"{import_count} @imports"))

    return results


def check_content_coverage(content: str) -> list[tuple[str, str, str]]:
    """Check essential content sections are present."""
    results = []

    sections = {
        "Commands": r'(?:##?\s+commands|```(?:bash|sh))',
        "Architecture/Structure": r'(?:##?\s+(?:architecture|structure|directories|project))',
    }

    for section, pattern in sections.items():
        if re.search(pattern, content, re.IGNORECASE):
            results.append((PASS, f"Section: {section}", "Present"))
        else:
            results.append((INFO, f"Section: {section}", "Not found (recommended for most projects)"))

    return results


def validate_file(filepath: Path) -> tuple[int, int, int]:
    """Validate a single CLAUDE.md file. Returns (pass, warn, fail) counts."""
    content = filepath.read_text(encoding="utf-8")
    lines = content.splitlines()

    print(f"\n{'='*60}")
    print(f"  {filepath}")
    print(f"{'='*60}")

    all_results = []
    all_results.extend(check_size(content, lines))
    all_results.extend(check_structure(lines))
    all_results.extend(check_antipatterns(content, lines))
    all_results.extend(check_content_coverage(content))

    for status, check, detail in all_results:
        print(f"  {status}  {check}: {detail}")

    passes = sum(1 for s, _, _ in all_results if s == PASS)
    warns = sum(1 for s, _, _ in all_results if s in (WARN, INFO))
    fails = sum(1 for s, _, _ in all_results if s == FAIL)

    print(f"\n  Score: {passes} passed, {warns} warnings, {fails} failed")
    return passes, warns, fails


def main():
    if len(sys.argv) < 2:
        print("Usage: validate_claudemd.py <file-or-directory>")
        print("  Validates CLAUDE.md files against best practices.")
        sys.exit(1)

    target = Path(sys.argv[1]).resolve()
    if not target.exists():
        print(f"Error: {target} does not exist")
        sys.exit(1)

    files = find_claudemd_files(target)
    if not files:
        print(f"No CLAUDE.md files found in {target}")
        sys.exit(1)

    total_pass = total_warn = total_fail = 0
    for f in files:
        try:
            p, w, fail = validate_file(f)
            total_pass += p
            total_warn += w
            total_fail += fail
        except (OSError, UnicodeDecodeError) as e:
            print(f"\n  Error reading {f}: {e}")
            total_fail += 1

    if len(files) > 1:
        print(f"\n{'='*60}")
        print(f"  Overall: {len(files)} files, {total_pass} passed, {total_warn} warnings, {total_fail} failed")
        print(f"{'='*60}")

    sys.exit(1 if total_fail > 0 else 0)


if __name__ == "__main__":
    main()
