# M42 Signs Plugin

Learning loop for agent evolution - extracts wisdom from session failures and applies them as signs in CLAUDE.md files.

## Installation

```bash
claude plugins add m42-signs
```

## Quick Example

```bash
# Add a learning manually
/m42-signs:add

# List all signs
/m42-signs:list

# Check backlog status
/m42-signs:status

# Extract from session transcript
/m42-signs:extract <session-id>

# Extract from large transcripts (auto-detects, or use --parallel)
/m42-signs:extract large-transcript.jsonl --parallel

# Review pending signs
/m42-signs:review

# Apply approved signs to CLAUDE.md
/m42-signs:apply
```

## Documentation

- **[Getting Started](docs/getting-started.md)** - Add your first sign in 5 minutes
- [How-To Guides](docs/how-to/) - Task-focused guides
  - [Handle Large Transcripts](docs/how-to/handle-large-transcripts.md) - Preprocessing for big sessions
- [Reference](docs/reference/) - Complete command reference

## License

MIT
