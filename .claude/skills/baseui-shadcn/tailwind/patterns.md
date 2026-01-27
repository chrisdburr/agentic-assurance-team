# Tailwind CSS Patterns

CSS variable theming and utility patterns for the dashboard.

## Color System

The project uses OKLch colors for perceptually uniform color mixing:

```css
/* Light mode */
:root {
  --background: oklch(0.9805 0.0130 82.4021);
  --foreground: oklch(0.3897 0.0169 78.0930);
  --primary: oklch(0.6081 0.0769 138.8300);
  --primary-foreground: oklch(0.9805 0.0130 82.4021);
  /* ... */
}

/* Dark mode */
.dark {
  --background: oklch(0.3144 0.0096 196.6725);
  --foreground: oklch(0.9204 0.0149 98.2970);
  /* ... */
}
```

### Why OKLch?

- Perceptually uniform lightness (L)
- Consistent chroma (C) across hues
- Better for programmatic color generation
- Supports wide gamut displays

### Semantic Color Variables

| Variable | Usage |
|----------|-------|
| `--background` | Page/app background |
| `--foreground` | Default text color |
| `--card` | Card backgrounds |
| `--card-foreground` | Text on cards |
| `--popover` | Popover/dropdown backgrounds |
| `--primary` | Primary actions, links |
| `--primary-foreground` | Text on primary backgrounds |
| `--secondary` | Secondary buttons |
| `--muted` | Subtle backgrounds |
| `--muted-foreground` | Subdued text |
| `--accent` | Highlighted elements |
| `--destructive` | Error states, delete actions |
| `--border` | Default border color |
| `--input` | Input backgrounds |
| `--ring` | Focus ring color |

## Using Colors in Components

Reference CSS variables through Tailwind:

```tsx
// Direct usage
className="bg-background text-foreground"
className="bg-primary text-primary-foreground"
className="border-border"
className="text-muted-foreground"

// Opacity modifiers (Tailwind v4)
className="bg-primary/90"    // 90% opacity
className="border-border/50" // 50% opacity
```

## Theme Configuration

Tailwind v4 maps CSS variables to color utilities:

```css
/* globals.css */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ... */
}
```

This enables `bg-background`, `text-foreground`, etc.

## Dark Mode

Implemented via `.dark` class on a parent element:

```tsx
// Toggle dark mode
document.documentElement.classList.toggle('dark')

// Conditional dark styles
@custom-variant dark (&:is(.dark *));
```

### Dark-specific Overrides

```tsx
// Standard pattern
className="bg-background dark:bg-card"

// Input with dark variant
className="bg-transparent dark:bg-input/30"
```

## Border Radius

Consistent radius using CSS variables:

```css
:root {
  --radius: 1rem;
}

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

Usage:

```tsx
className="rounded-sm"   // 12px
className="rounded-md"   // 14px
className="rounded-lg"   // 16px
className="rounded-xl"   // 20px
```

## Shadow System

Custom shadows with theming:

```css
:root {
  --shadow-sm: 0px 4px 12px 0px hsl(36 11% 26% / 0.08);
  --shadow: 0px 4px 12px 0px hsl(36 11% 26% / 0.08);
  --shadow-md: 0px 4px 12px 0px hsl(36 11% 26% / 0.08);
  /* Dark mode has higher opacity */
}

.dark {
  --shadow-sm: 0px 6px 15px 0px hsl(0 0% 0% / 0.25);
}
```

## Typography

Font stacks via CSS variables:

```css
:root {
  --font-sans: Quicksand, Inter, sans-serif;
  --font-mono: JetBrains Mono, monospace;
  --letter-spacing: -0.01em;
}

@theme inline {
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --tracking-normal: -0.01em;
}
```

## Utility Patterns

### Focus Rings

Consistent focus styling:

```tsx
className={cn(
  "outline-none",
  "focus-visible:ring-1 focus-visible:ring-ring",
  "focus-visible:border-ring"
)}

// Or with offset
className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
```

### Disabled States

```tsx
className="disabled:pointer-events-none disabled:opacity-50"
```

### Interactive States

```tsx
className={cn(
  "transition-colors",
  "hover:bg-accent hover:text-accent-foreground",
  "focus-visible:ring-1 focus-visible:ring-ring"
)}
```

### SVG Icon Sizing

```tsx
// Default sizing for icons in buttons
"[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"

// Shrink to fit
"[&_svg]:shrink-0"
```

## cn() Helper

The `cn()` utility merges Tailwind classes intelligently:

```tsx
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Usage:

```tsx
// Later classes win
cn("text-red-500", "text-blue-500") // => "text-blue-500"

// Conditional classes
cn("base-class", condition && "conditional-class")

// Merging with className prop
cn("default-styles", className)
```

## Base Layer Reset

Global resets in `@layer base`:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    letter-spacing: var(--tracking-normal);
  }
}
```
