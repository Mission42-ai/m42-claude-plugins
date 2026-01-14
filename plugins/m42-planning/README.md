# M42 Planning Plugin

Epic and story planning with GitHub integration for Claude Code.

## Installation

```bash
claude plugin install m42-planning
```

Or from URL:
```bash
claude plugin add https://github.com/mission42-ai/m42-planning-plugin
```

## Features

### Epic/Story Planning Skill

Automatically activates when you mention "create epic", "detail story", "acceptance criteria", etc.

Provides:
- Epic breakdown workflows
- User story formatting (As a/I want/So that)
- Gherkin acceptance criteria patterns
- DEEP estimation methodology

### GitHub Issue Templates

Copy templates to your project:

```bash
mkdir -p .github/ISSUE_TEMPLATE
cp ~/.claude/plugins/*/m42-planning/templates/*.yml .github/ISSUE_TEMPLATE/
```

**Available templates:**
- `epic.yml` - Epic creation with goals and acceptance criteria
- `story.yml` - Story creation with gherkin and task breakdown

### Label Strategy

Recommended GitHub labels:

| Label | Purpose |
|-------|---------|
| `type-epic` | Epic issues |
| `type-story` | Story issues |
| `status-planning` | In planning phase |
| `status-ready` | Ready for implementation |
| `priority-critical/high/medium/low` | Priority levels |

## Usage

### Create an Epic

```
Create an epic for user authentication including:
- Login/logout functionality
- Password reset
- Session management
```

### Detail a Story

```
Detail this story with full gherkin:
As a user, I want to reset my password so that I can regain access to my account
```

### Estimate Work

The plugin uses DEEP estimation:
- **D**etailed appropriately
- **E**stimated (relative sizing)
- **E**mergent
- **P**rioritized

## Structure

```
m42-planning-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── epic-story-planning/
│       ├── SKILL.md
│       └── references/
│           ├── gherkin-patterns.md
│           └── estimation-guide.md
├── templates/
│   ├── epic.yml
│   └── story.yml
└── README.md
```

## License

MIT
