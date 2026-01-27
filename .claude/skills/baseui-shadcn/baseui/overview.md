# Base UI Overview

Base UI is MUI's library of unstyled, accessible React components. As of December 2025, shadcn/ui officially supports Base UI as an alternative to Radix.

## Design Philosophy

**Unstyled by default**: Components ship without CSS. You apply styles via className props or Tailwind.

**Accessible**: Built on WAI-ARIA patterns. Keyboard navigation, focus management, and screen reader support included.

**Composable**: Compound component pattern allows granular control over structure.

## Compound Component Pattern

Base UI uses compound components for complex UI:

```tsx
import { Field } from '@base-ui-components/react/field'

<Field.Root>
  <Field.Label>Email</Field.Label>
  <Field.Control placeholder="Enter email" />
  <Field.Error>Please enter a valid email</Field.Error>
</Field.Root>
```

Compare to Radix:

```tsx
import * as LabelPrimitive from '@radix-ui/react-label'

<div>
  <LabelPrimitive.Root>Email</LabelPrimitive.Root>
  <input placeholder="Enter email" />
</div>
```

### Key Differences from Radix

| Aspect | Radix | Base UI |
|--------|-------|---------|
| Import style | `import * as X from '@radix-ui/react-x'` | `import { X } from '@base-ui-components/react/x'` |
| Component access | `X.Root`, `X.Trigger` | `X.Root`, `X.Trigger` (same pattern) |
| Form integration | Manual | Built-in Field component |
| Bundle size | Per-component packages | Single package, tree-shakes |

### Shared API Patterns

Both libraries use similar patterns that shadcn abstracts:

```tsx
// Portal usage (same concept)
<Dialog.Portal>
  <Dialog.Backdrop />
  <Dialog.Popup>...</Dialog.Popup>
</Dialog.Portal>

// State attributes (same approach)
data-state="open" | "closed"
data-side="top" | "bottom" | "left" | "right"
```

## When to Choose Base UI

**Choose Base UI when:**
- Starting a new project and want form validation built-in
- Need smaller bundle size (single package)
- Want MUI ecosystem compatibility

**Choose Radix when:**
- Existing project already uses Radix
- Need specific Radix-only components
- Team is familiar with Radix patterns

## shadcn/ui Compatibility

shadcn/ui `npx shadcn create` lets you choose your primitive library:

```
? Which primitives would you like to use?
  ● Radix UI
  ○ Base UI
```

The generated components have the same external API regardless of underlying library. This means your application code stays the same when switching.
