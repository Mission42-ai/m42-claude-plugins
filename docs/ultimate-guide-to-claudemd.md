# The definitive guide to crafting CLAUDE.md files

**CLAUDE.md is the single highest-leverage configuration point in Claude Code**, loaded into every conversation as part of the system prompt. A well-crafted file dramatically improves Claude's code quality, consistency, and awareness of project conventions. A bloated one degrades performance across every interaction. This guide synthesizes official Anthropic documentation, community research, and real-world patterns into a comprehensive reference for building ideal CLAUDE.md files for any codebase.

The core tension: CLAUDE.md content consumes tokens on every session whether relevant or not, and Claude Code's system prompt already includes **~50 internal instructions**. Research suggests frontier thinking models can reliably follow only **~150–200 total instructions**, meaning your CLAUDE.md budget is roughly **100–150 instructions** — every line must earn its place.

---

## How Claude Code discovers and loads memory files

Claude Code reads CLAUDE.md files from multiple locations in a defined hierarchy. Understanding this loading behavior is essential to organizing instructions effectively.

**File locations and loading order:**

| Location | Scope | Loaded when | Version controlled? |
|---|---|---|---|
| Enterprise policy path (OS-specific) | Organization-wide | Session start | Managed via MDM/Ansible |
| `./CLAUDE.md` (project root) | Team-shared project | Session start | ✅ Yes (recommended) |
| `./.claude/CLAUDE.md` | Same as above (cleaner root) | Session start | ✅ Yes |
| `./CLAUDE.local.md` | Personal per-project | Session start | ❌ Auto-gitignored |
| `~/.claude/CLAUDE.md` | Personal across all projects | Session start | N/A |
| `.claude/rules/*.md` | Scoped project rules | Session start | ✅ Yes |
| `~/.claude/rules/*.md` | Personal global rules | Session start | N/A |
| Parent directory CLAUDE.md files | Monorepo inheritance | Session start (recursive upward) | Varies |
| Child directory CLAUDE.md files | Subtree-specific | **On-demand only** (lazy-loaded when Claude reads files there) | Varies |

At startup, Claude Code walks **upward** from the current working directory to (but not including) the filesystem root, loading every CLAUDE.md and CLAUDE.local.md it finds. Subdirectory CLAUDE.md files below the cwd are **lazy-loaded** — they only enter context when Claude accesses files in that subtree. This distinction is critical for monorepos: root instructions propagate everywhere, while component-specific instructions stay isolated until needed.

**Priority resolution** follows specificity: project rules override user rules, and enterprise policies sit at the top. Within a project, all loaded files **combine** rather than replace each other, with more specific files taking precedence on conflicts. The `.claude/rules/` directory files carry the same priority as `.claude/CLAUDE.md`.

A crucial technical detail: Claude Code wraps CLAUDE.md content in a `<system-reminder>` tag stating *"this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant."* This means Claude **actively ignores** instructions it deems irrelevant to the current task — making universally applicable instructions far more effective than situational ones.

---

## What belongs in a root CLAUDE.md and what doesn't

The ideal root CLAUDE.md follows a **WHAT/WHY/HOW framework**: what the project is, why components exist, and how to work with them. Official Anthropic guidance recommends keeping the file **under ~500 lines**. Community practitioners push further — **under 300 lines** is the consensus sweet spot, with some experts maintaining files as short as **60 lines**.

**Essential sections with high return on investment:**

1. **Project context** (1–3 lines): Tech stack, framework version, core purpose. Example: *"Next.js 14 e-commerce app with App Router, Stripe payments, and Prisma ORM."*

2. **Common commands** (5–15 lines): Build, test, lint, deploy with exact syntax. This is the single most universally useful section — Claude uses these commands constantly.

3. **Architecture and key directories** (5–10 lines): A brief codebase map focusing on non-obvious structure. Don't explain that `/components` contains components.

4. **Code style** (3–10 lines): **Only conventions Claude cannot infer from existing code.** This is where most people over-specify. If your codebase consistently uses named exports, Claude will follow that pattern without being told.

5. **Important gotchas and warnings** (3–10 lines): Things Claude will get wrong without explicit instruction — quirky workarounds, protected files, environment-specific behavior.

6. **Workflow instructions** (3–5 lines): How Claude should approach work — e.g., "Run typecheck after code changes" or "Prefer running single tests, not the full suite."

**A well-structured example from official Anthropic documentation:**

```markdown
# Project: ShopFront
Next.js 14 e-commerce application with App Router, Stripe payments, and Prisma ORM.

## Commands
- `npm run dev`: Start development server (port 3000)
- `npm run test`: Run Jest tests  
- `npm run lint`: ESLint check
- `npm run db:migrate`: Run Prisma migrations

## Architecture
- `/app`: Next.js App Router pages and layouts
- `/components/ui`: Reusable UI components
- `/lib`: Utilities and shared logic
- `/prisma`: Database schema and migrations

## Code Style
- TypeScript strict mode, no `any` types
- Use named exports, not default exports
- CSS: Tailwind utility classes, no custom CSS files

## Important Notes
- NEVER commit .env files
- Stripe webhook handler in /app/api/webhooks/stripe must validate signatures
- Product images stored in Cloudinary, not locally
- See @docs/authentication.md for auth flow details
```

**The litmus test for every line**: *"Would removing this cause Claude to make mistakes?"* If not, cut it. Instructions that Claude already follows correctly from codebase context are pure overhead.

---

## Writing style that Claude actually follows

The way instructions are written dramatically affects adherence. Research and practitioner consensus converge on several clear principles.

**Use imperative, specific directives.** Claude processes direct commands more reliably than suggestions or preferences. Write `"Use ES modules (import/export) syntax, not CommonJS"` rather than `"We generally prefer ES modules."` Write `"Run tests before committing"` rather than `"It would be nice to run tests."` Every instruction should be a clear, actionable directive.

**Always provide alternatives with prohibitions.** One of the most important findings from enterprise practitioners: **never issue negative-only constraints.** Writing `"Never use the --foo-bar flag"` leaves Claude stuck. Instead write `"Never use --foo-bar; prefer --baz-qux instead."` This gives Claude a clear path forward rather than just a wall.

**Use emphasis sparingly for truly critical rules.** Prefixing with `IMPORTANT:` or `YOU MUST` increases adherence for that specific instruction, but carries a cost — if everything is marked important, nothing is. Reserve emphasis for rules where violations cause real damage: `"IMPORTANT: Never modify the migrations folder directly."`

**Structure with bullet points under clear markdown headers.** Claude processes structured bullet points more efficiently than paragraphs. Group related instructions under descriptive headings. Keep individual bullets concise — one instruction per line. Avoid long narrative explanations; save those for referenced documentation files.

**Common mistakes in writing style:**

- **Vague instructions** like "Format code properly" or "Be careful with images" — these waste tokens without changing behavior
- **Duplicate linter work** — never send an LLM to do a linter's job. If ESLint enforces semicolons, don't add a CLAUDE.md rule for it. Set up a hook to run the linter instead
- **Explaining obvious structure** — don't write "The `/tests` directory contains test files"
- **Including extensive code examples** — they become outdated quickly and consume valuable token budget. Reference files instead: `"See @src/utils/example.ts for the pattern"`

---

## Subfolder CLAUDE.md files and monorepo strategy

Subdirectory CLAUDE.md files are Claude Code's mechanism for **lazy-loading context** — they only enter the prompt when Claude accesses files in that subtree. This makes them the primary tool for managing complex projects without bloating every session.

**When to create subfolder CLAUDE.md files:**

- When a subdirectory has distinct conventions, frameworks, or tooling (e.g., a React frontend vs. a Python backend)
- When component-specific instructions exceed 10–15 lines and don't apply to other components
- When your root CLAUDE.md grows beyond 300 lines and needs splitting
- In monorepos where teams own different sections with different standards

**The recommended monorepo pattern:**

```
/mymonorepo/
├── CLAUDE.md                    # Shared: commit conventions, repo-wide standards
├── CLAUDE.local.md              # Personal overrides (auto-gitignored)
├── .claude/
│   └── rules/
│       ├── security.md          # Always-on security rules
│       └── frontend/
│           └── react.md         # Conditional (paths: src/frontend/**)
├── frontend/
│   └── CLAUDE.md                # React patterns, component testing (lazy-loaded)
├── backend/
│   └── CLAUDE.md                # API patterns, DB conventions (lazy-loaded)
└── shared/
    └── CLAUDE.md                # Shared library conventions (lazy-loaded)
```

A documented case study reduced a monorepo CLAUDE.md from **47,000 words to 9,000 words** by splitting context across frontend, backend, and core services, making Claude Code "faster and more predictable."

**Critical distinction**: the `@import` syntax (`@path/to/file`) loads content **at startup** — it organizes files but doesn't reduce context. For actual lazy loading, you must use separate CLAUDE.md files in subdirectories. The `@import` syntax supports recursive imports up to **5 hops deep**, resolves relative paths from the importing file, and triggers an approval dialog on first use.

**Root vs. subfolder content allocation:** Root CLAUDE.md should contain only instructions that apply to **every possible task** in the repository. Architecture overviews, commit conventions, CI/CD commands, and cross-cutting concerns belong at root. Framework-specific patterns, component testing strategies, and directory-specific gotchas belong in subfolder files.

---

## The rules directory and conditional scoping

Beyond CLAUDE.md files, Claude Code supports a `.claude/rules/` directory for **modular, optionally scoped** instruction files. All `.md` files here are automatically loaded at session start with the same priority as the main CLAUDE.md.

**Conditional rules use YAML frontmatter** with glob patterns to scope instructions to specific files:

```markdown
---
paths:
  - "src/api/**/*.ts"
---
# API development rules
- All endpoints must include input validation
- Use the standard error response format from @src/api/shared/errors.ts
- Include OpenAPI documentation comments on all route handlers
```

Rules without a `paths` field apply unconditionally. The official guidance is to use conditional scoping **sparingly** — only when rules genuinely apply to specific file types and would be noise elsewhere. The directory supports subdirectory organization (e.g., `rules/frontend/`, `rules/backend/`), which is useful for teams managing different sections of a codebase.

User-level rules in `~/.claude/rules/` apply across all projects — ideal for personal coding preferences, preferred commit message format, or communication style. Project rules always take priority over user rules when they conflict.

---

## Advanced patterns for power users

**Progressive disclosure** is the most impactful advanced pattern. Instead of embedding all documentation in CLAUDE.md, keep detailed references in separate files and provide Claude with **motivated pointers** — brief descriptions explaining when and why to consult each file:

```markdown
# Reference docs
- For complex auth flows or AuthError debugging, see @docs/authentication.md
- For database migration procedures, see @docs/migrations.md
- For deployment runbook, see @docs/deploy.md
```

The key insight from enterprise practitioners: don't just list file paths (Claude may ignore them) and don't use `@imports` for everything (they load at startup). Instead, **pitch Claude on why and when** to read each file. This balances context efficiency with information availability.

**Self-improving CLAUDE.md** is a pattern where you ask Claude to reflect on failed tasks and suggest CLAUDE.md improvements. After completing work, prompt: *"What instructions in CLAUDE.md would have prevented the issues we encountered?"* Some teams pipe CI/CD failure logs through Claude to automatically identify common mistakes and propose new rules.

**Hooks complement CLAUDE.md** for deterministic rules. CLAUDE.md handles heuristic guidance ("prefer named exports"), while hooks enforce hard requirements ("always run the formatter after editing"). A `PreToolUse` hook running your linter is far more reliable than a CLAUDE.md instruction saying "follow PEP 8." Configure hooks in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write",
      "hooks": [{ "type": "command", "command": "npx prettier --write $FILE" }]
    }]
  }
}
```

**Skills for specialized knowledge**: Claude Code Skills (stored in `.claude/skills/`) load **on-demand** unlike CLAUDE.md which loads every session. Moving specialized instructions — like database migration procedures or complex deployment workflows — into skills keeps base context lean while preserving access to detailed guidance when needed.

**MCP server documentation** belongs in CLAUDE.md when your project uses MCP tools. Document tool names, usage patterns, rate limits, and when to invoke them. However, MCP configuration itself lives separately in `.mcp.json` or settings files. Be aware that connecting MCP servers consumes significant context — one case documented **67,000 tokens** just from four connected servers before any user prompt. Claude Code v2.1.7+ introduced Tool Search to mitigate this with a **46.9% token reduction**.

---

## What other AI coding tools teach us about CLAUDE.md

Comparing CLAUDE.md with similar configuration systems reveals both shared best practices and unique features worth understanding.

**AGENTS.md** (OpenAI Codex, now an emerging cross-tool standard under the Linux Foundation) uses a similar hierarchical model with one notable addition: **override files** (`AGENTS.override.md`) that take precedence in the same directory without editing the base file — useful for temporary changes. AGENTS.md has a **32 KiB default size limit** and is supported by 20+ tools including Cursor, Copilot, Windsurf, and Gemini CLI. Claude Code does not natively support AGENTS.md but can reference it via `@AGENTS.md` import.

**Cursor's .cursor/rules/** system introduced a concept Claude Code has partially adopted: **activation modes** (Always, Auto-Attached via globs, Agent-Requested, Manual). Cursor's conditional rules are more granular — each rule file independently declares its activation type. Claude Code's equivalent is the `paths` frontmatter in `.claude/rules/` files, though without the "agent-requested" mode where the AI decides relevance from a description.

**Windsurf** contributes the idea of **auto-generated memories** from conversations — the AI can create and store observations during work. Windsurf also enforces an explicit **12,000 character per file** limit, which enforces the conciseness that CLAUDE.md best practices recommend but don't enforce.

**GitHub Copilot** (`/.github/copilot-instructions.md`) takes the simplest approach: one file for repository-wide instructions plus path-specific `.instructions.md` files with `applyTo` frontmatter. Copilot uniquely offers **organization-level instructions** managed at the GitHub org level — a pattern mirrored by Claude Code's enterprise policy files.

The universal lesson across all tools: **specific, concise, universally-applicable instructions outperform lengthy, situational documentation.** Every tool's community independently converged on this principle.

---

## Anti-patterns that degrade Claude Code performance

**The over-specified CLAUDE.md** is the most common failure mode. When the file grows too long, important rules get lost in noise and Claude begins ignoring instructions wholesale. If Claude keeps doing something you've explicitly forbidden, the file is probably too long and the rule is being drowned out. The fix is aggressive pruning — remove anything Claude already does correctly without instruction.

**Putting code style rules in CLAUDE.md** is the second most common mistake. LLMs are powerful in-context learners: if your codebase consistently follows a pattern, Claude follows it without being told. More importantly, LLMs are comparably expensive and slow at enforcing formatting rules versus traditional linters. Move all deterministic style enforcement to linters and formatters run via hooks.

**Relying solely on `/init` auto-generation** produces generic, bloated files. The `/init` command analyzes your codebase and generates a starter CLAUDE.md — it's a useful starting point but should never be the final product. Auto-generated content typically includes obvious information Claude doesn't need and misses the project-specific gotchas that matter most.

**Importing files indiscriminately with `@`** bloats context because imported content loads at startup. Instead of `@path/to/docs.md` on its own line, provide context-aware pointers: *"For complex FooBar usage or if you encounter FooBarError, see `path/to/docs.md`."* This lets Claude decide when to fetch the content rather than loading it every session.

**Including sensitive information** in committed CLAUDE.md files — API keys, database connection strings, or detailed security vulnerability descriptions — creates security risks. Use environment variables and reference them by name rather than value. Note that Claude Code **can read .env files** even when gitignored; use permission deny rules in `.claude/settings.json` to prevent this: `"deny": ["Read(.env)"]`.

---

## Content categories checklist for comprehensive coverage

While every project is different, these categories represent the complete set of topics practitioners have found valuable in CLAUDE.md files. Not every project needs every category — include only what changes Claude's behavior.

- **Project identity**: One-liner description, tech stack with versions, core purpose
- **Commands**: Build, test (single test and full suite), lint, format, deploy, database operations — exact syntax
- **Architecture**: Key directories, entry points, data flow, service boundaries
- **Coding conventions**: Only those not inferrable from code — naming patterns, import style, error handling approach
- **Testing requirements**: Framework, fixture locations, mocking patterns, coverage expectations
- **Git workflow**: Branch naming, commit message format, merge vs. rebase, PR requirements
- **Security boundaries**: Protected files, authentication flow references, input validation requirements
- **Environment specifics**: Required env vars (names not values), local setup quirks, platform-specific behavior
- **Domain knowledge**: Business logic that affects code decisions, terminology definitions, regulatory constraints
- **Gotchas and warnings**: Things that look wrong but are intentional, known fragile areas, "never modify" zones
- **MCP tools**: Available tools, when to use them, rate limits, usage examples

---

## Maintaining CLAUDE.md as a living document

The most effective teams treat CLAUDE.md as **code that requires review, testing, and iteration**. A maintenance tracking table helps formalize this:

| Failure case | Proposed instruction | Contributor | Decision |
|---|---|---|---|
| Claude uses `typing.Dict` instead of `dict` | "Use `dict` not `typing.Dict` for type hints" | @alice | Included |
| Missing docstrings on public functions | "Add docstrings to all public functions" | @bob | Deferred to linter |
| Wrong test runner invocation | "Use `pytest tests/ -v`, not `python -m pytest`" | @carol | Included |

**The maintenance cycle**: When Claude makes a mistake, determine whether a CLAUDE.md instruction would prevent it. If so, add the instruction and observe whether behavior changes. If a rule doesn't change behavior after testing, remove it — it's consuming token budget without providing value. Periodically audit the entire file, asking for each line whether it still earns its place.

For team environments, commit CLAUDE.md changes through the same review process as code. Get agreement from frequent Claude Code users and codebase experts. Notify the team when rules change so everyone benefits from collective learning. Personal preferences go in `CLAUDE.local.md` (auto-gitignored) or `~/.claude/CLAUDE.md` (user-level), keeping the shared file focused on universal team standards.

## Conclusion

The most effective CLAUDE.md files share a counterintuitive quality: they are **short**. The research converges on a clear principle — every instruction has a cost (consumed tokens, diluted attention, potential for being ignored), and only instructions that demonstrably change Claude's behavior justify that cost. Start with the minimum viable CLAUDE.md: project identity, key commands, and the one or two gotchas Claude keeps hitting. Add instructions reactively when Claude makes mistakes, not proactively against hypothetical problems. Use the `.claude/rules/` directory for scoped conventions, subfolder CLAUDE.md files for lazy-loaded component context, and Skills for specialized workflows. Treat the file as your highest-leverage prompt engineering surface — because across every session, every task, and every line of code Claude generates, it is exactly that.