---
paths:
  - "team-dashboard/**/*.{ts,tsx}"
---

# shadcn/ui Component Rules

Always prefer shadcn/ui components over custom implementations, HTML elements, or third-party UI libraries.

## Before building any UI

1. Check if a shadcn component exists for the pattern you need (dialog, select, dropdown, tabs, toast, etc.)
2. Check if it's already installed in `team-dashboard/src/components/ui/`
3. If not installed, add it before using it:
   ```bash
   cd team-dashboard && bunx --bun shadcn@latest add {component_name}
   ```

## Rules

- **Never** install shadcn component packages directly with `bun add` — always use the `bunx --bun shadcn@latest add` CLI
- **Never** build custom versions of components that shadcn already provides (dialogs, dropdowns, selects, tooltips, popovers, tabs, toasts, etc.)
- **Never** use raw HTML elements (`<select>`, `<dialog>`, `<input>`) when a shadcn equivalent exists
- Import from `@/components/ui/{component}` — these are the project's canonical UI primitives
- Compose shadcn primitives for complex UI rather than reaching for external libraries

## Currently installed components

Check `team-dashboard/src/components/ui/` for what's already available. If unsure, run:
```bash
ls team-dashboard/src/components/ui/
```

## Reference

Full component list: https://ui.shadcn.com/docs/components
