# tw-animate-css Patterns

Animation patterns using tw-animate-css with Tailwind CSS v4.

## Setup

The project uses tw-animate-css for declarative animations:

```css
/* globals.css */
@import "tailwindcss";
@import "tw-animate-css";
```

## Core Animation Classes

### Enter Animations

```tsx
// Base enter animation (required)
"animate-in"

// Fade
"fade-in-0"      // Start invisible
"fade-in-50"     // Start half visible

// Scale/Zoom
"zoom-in-95"     // Start at 95% scale
"zoom-in-90"     // Start at 90% scale
"zoom-in-50"     // Start at 50% scale

// Slide
"slide-in-from-top-2"      // 0.5rem from top
"slide-in-from-bottom-4"   // 1rem from bottom
"slide-in-from-left-2"     // 0.5rem from left
"slide-in-from-right-2"    // 0.5rem from right

// Spin
"spin-in-180"    // Rotate from 180deg
```

### Exit Animations

```tsx
// Base exit animation (required)
"animate-out"

// Fade
"fade-out-0"     // End invisible
"fade-out-50"    // End half visible

// Scale/Zoom
"zoom-out-95"    // End at 95% scale
"zoom-out-90"    // End at 90% scale

// Slide
"slide-out-to-top-2"
"slide-out-to-bottom-2"
"slide-out-to-left-2"
"slide-out-to-right-2"
```

## State-Driven Animations

Use `data-[state=*]` selectors to trigger animations based on component state:

```tsx
// Dialog overlay
className={cn(
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
)}

// Dialog content
className={cn(
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
)}
```

## Directional Animations

For positioned elements (popovers, tooltips), animate based on placement:

```tsx
className={cn(
  "data-[side=bottom]:slide-in-from-top-2",
  "data-[side=left]:slide-in-from-right-2",
  "data-[side=right]:slide-in-from-left-2",
  "data-[side=top]:slide-in-from-bottom-2"
)}
```

## Duration and Timing

Control animation timing with Tailwind utilities:

```tsx
// Duration
"duration-200"   // 200ms (default for most shadcn)
"duration-300"   // 300ms (for sheets/panels)
"duration-500"   // 500ms (slower)

// Easing
"ease-in-out"    // Standard easing
"ease-out"       // Deceleration (for enters)
"ease-in"        // Acceleration (for exits)
```

Example with custom duration:

```tsx
className="animate-in fade-in-0 duration-300 ease-out"
```

## Common Component Patterns

### Modal/Dialog

```tsx
// Overlay (backdrop)
const overlayClasses = cn(
  "fixed inset-0 z-50 bg-black/50",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
)

// Content (dialog box)
const contentClasses = cn(
  "fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "duration-200"
)
```

### Sheet (Slide-out Panel)

```tsx
// Right side sheet
const sheetRightClasses = cn(
  "fixed inset-y-0 right-0 z-50 w-3/4 sm:max-w-sm",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
  "duration-300 ease-in-out"
)

// Bottom sheet
const sheetBottomClasses = cn(
  "fixed inset-x-0 bottom-0 z-50",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
  "duration-300 ease-in-out"
)
```

### Popover/Dropdown

```tsx
const popoverClasses = cn(
  "z-50 rounded-md border bg-popover p-4 shadow-md",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  // Directional slide based on placement
  "data-[side=bottom]:slide-in-from-top-2",
  "data-[side=left]:slide-in-from-right-2",
  "data-[side=right]:slide-in-from-left-2",
  "data-[side=top]:slide-in-from-bottom-2"
)
```

### Tooltip

```tsx
const tooltipClasses = cn(
  "z-50 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground",
  "animate-in fade-in-0 zoom-in-95",
  // Exit animation
  "data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
)
```

## Combining with Transitions

For hover/focus states, combine with Tailwind transitions:

```tsx
className={cn(
  // Base transition for hover/focus
  "transition-colors",
  // Separate animation for open/close
  "data-[state=open]:animate-in data-[state=closed]:animate-out"
)}
```

## Accessibility

Respect user motion preferences:

```tsx
// tw-animate-css respects prefers-reduced-motion automatically
// But you can also be explicit:
className="motion-safe:animate-in motion-safe:fade-in-0"
```

## Debugging Animations

Slow down animations temporarily:

```tsx
// Add to component for debugging
style={{ animationDuration: "2s" }}
```
