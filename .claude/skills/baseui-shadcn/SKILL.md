---
name: baseui-shadcn
description: Guide for building UI components with shadcn/ui and Base UI primitives. Use when creating, modifying, or reviewing React components in the dashboard.
user-invocable: true
---

# Base UI + shadcn/ui Component Guide

This skill provides guidance for building accessible, themeable UI components using shadcn/ui with Base UI primitives.

## Current Project State

The `team-dashboard` currently uses **Radix UI** primitives. This skill documents both the current patterns and Base UI migration paths.

**Current stack:**
- Radix UI primitives (`@radix-ui/react-*`)
- `tw-animate-css` for animations
- Tailwind CSS v4 with OKLch color system
- `class-variance-authority` (CVA) for variants

## Quick Reference

### Component Import Pattern

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
```

### Standard Component Structure

```tsx
function MyComponent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="my-component"
      className={cn("base-styles", className)}
      {...props}
    />
  )
}
```

### Variant Pattern (CVA)

```tsx
const variants = cva("base-styles", {
  variants: {
    variant: { default: "...", secondary: "..." },
    size: { sm: "...", md: "...", lg: "..." },
  },
  defaultVariants: { variant: "default", size: "md" },
})
```

### Animation Pattern (tw-animate-css)

```tsx
className={cn(
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
  "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
)}
```

### Color Variables

Use semantic color variables (not raw values):
- `bg-background`, `text-foreground` - Base colors
- `bg-primary`, `text-primary-foreground` - Primary actions
- `bg-muted`, `text-muted-foreground` - Subdued content
- `bg-destructive` - Destructive actions

## Detailed Documentation

### Base UI Fundamentals
- `@file baseui/overview.md` - Design philosophy and compound components
- `@file baseui/setup.md` - Project setup with shadcn create
- `@file baseui/migration.md` - Radix to Base UI migration patterns

### Component Patterns
- `@file components/index.md` - Component catalog overview
- `@file components/forms.md` - Field, Input, Checkbox, Select patterns
- `@file components/overlays.md` - Dialog, Popover, Tooltip, Sheet
- `@file components/navigation.md` - Sidebar, Tabs, Menu patterns
- `@file components/feedback.md` - Toast, Alert, Skeleton patterns

### Styling & Animation
- `@file tailwind/patterns.md` - CSS variables, theming, utilities
- `@file animations/tw-animate.md` - tw-animate-css patterns
- `@file animations/motion.md` - Framer Motion integration

### Type Safety
- `@file type-safety/patterns.md` - TypeScript interfaces, generics, props

### Blocks System
- `@file blocks/patterns.md` - Using shadcn blocks for common layouts

## Common Tasks

### Creating a New Component

1. Check if shadcn has the component: `npx shadcn@latest add <name>`
2. If not, create in `src/components/ui/` following existing patterns
3. Use `data-slot` attribute for styling hooks
4. Export from single file, use function declarations (not `const`)

### Modifying Existing Components

1. Read the component file first
2. Preserve existing `data-slot` attributes
3. Keep CVA variants consistent with project style
4. Test dark mode (`className="dark"` on parent)

### Adding Animations

1. Use `tw-animate-css` classes with `data-[state=*]` selectors
2. Pair enter/exit animations (fade-in/fade-out, zoom-in/zoom-out)
3. See `@file animations/tw-animate.md` for patterns
