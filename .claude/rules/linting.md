---
paths:
  - "**/*.{ts,tsx,js,jsx}"
---

# Linting & Formatting — Ultracite (Biome)

This project uses [ultracite](https://docs.ultracite.ai) wrapping Biome, with the `ultracite/biome/core` preset (see `biome.jsonc`).

## Commands

```bash
# Check for lint/format issues (read-only)
bunx ultracite check

# Auto-fix lint and formatting issues
bunx ultracite fix
```

- Always use `bunx` to run ultracite, not `npx`
- Unknown flags are passed through to Biome, so any Biome flag works (e.g. `--max-diagnostics`)
- Run `bunx ultracite fix` after making code changes, before committing
- Do not use Prettier or add any other formatter
- ESLint is also configured in `team-dashboard/` for Next.js-specific rules (`eslint-config-next`), but ultracite/Biome handles all formatting and general linting
