# Radix to Base UI Migration

Step-by-step guide for migrating components from Radix UI to Base UI primitives.

## Migration Strategy

### Option 1: Component-by-Component (Recommended)

Replace components individually, testing each change:

```bash
# Replace a single component
npx shadcn@latest add dialog --overwrite
```

### Option 2: Full Migration

Update `components.json` and regenerate all components:

```json
{
  "library": "base-ui"
}
```

```bash
# Regenerate all (backup first!)
npx shadcn@latest add --all --overwrite
```

## Import Changes

### Dialog

```tsx
// Radix (before)
import * as DialogPrimitive from "@radix-ui/react-dialog"

// Base UI (after)
import { Dialog } from "@base-ui-components/react/dialog"

// Usage changes
// Radix: DialogPrimitive.Root, DialogPrimitive.Content
// Base UI: Dialog.Root, Dialog.Popup, Dialog.Backdrop
```

### Popover

```tsx
// Radix (before)
import * as PopoverPrimitive from "@radix-ui/react-popover"

// Base UI (after)
import { Popover } from "@base-ui-components/react/popover"

// Note: Base UI uses Popover.Popup instead of Popover.Content
```

### Tooltip

```tsx
// Radix (before)
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

// Base UI (after)
import { Tooltip } from "@base-ui-components/react/tooltip"

// Note: Base UI doesn't require a Provider wrapper
```

## API Differences

### Content vs Popup

Base UI uses `.Popup` where Radix uses `.Content`:

```tsx
// Radix
<Dialog.Content>...</Dialog.Content>

// Base UI
<Dialog.Popup>...</Dialog.Popup>
```

### Overlay vs Backdrop

```tsx
// Radix
<Dialog.Overlay className="..." />

// Base UI
<Dialog.Backdrop className="..." />
```

### Portal Usage

Both use Portal similarly, but Base UI nests differently:

```tsx
// Radix pattern
<DialogPrimitive.Portal>
  <DialogPrimitive.Overlay />
  <DialogPrimitive.Content>
    {children}
  </DialogPrimitive.Content>
</DialogPrimitive.Portal>

// Base UI pattern
<Dialog.Portal>
  <Dialog.Backdrop />
  <Dialog.Popup>
    {children}
  </Dialog.Popup>
</Dialog.Portal>
```

## State Attributes

Both libraries use `data-state` but Base UI adds more:

```tsx
// Both support
data-state="open" | "closed"

// Base UI additions
data-open        // Boolean presence attribute
data-starting-style  // For enter animations
data-ending-style    // For exit animations
```

### Animation Migration

Update animation selectors if using Base UI attributes:

```tsx
// Radix style (still works)
className="data-[state=open]:animate-in data-[state=closed]:animate-out"

// Base UI alternative (CSS)
.my-dialog[data-starting-style] { opacity: 0; }
.my-dialog[data-open] { opacity: 1; }
.my-dialog[data-ending-style] { opacity: 0; }
```

## Form Components

Base UI's Field component replaces manual label/input wiring:

```tsx
// Radix (manual wiring)
import * as LabelPrimitive from "@radix-ui/react-label"

<div>
  <LabelPrimitive.Root htmlFor="email">Email</LabelPrimitive.Root>
  <input id="email" type="email" aria-describedby="email-error" />
  {error && <span id="email-error">{error}</span>}
</div>

// Base UI (automatic wiring)
import { Field } from "@base-ui-components/react/field"

<Field.Root>
  <Field.Label>Email</Field.Label>
  <Field.Control type="email" />
  <Field.Error>{error}</Field.Error>
</Field.Root>
```

## Component-Specific Migration

### Dialog Migration Checklist

- [ ] Replace `DialogPrimitive` imports
- [ ] Change `.Content` to `.Popup`
- [ ] Change `.Overlay` to `.Backdrop`
- [ ] Update animation classes if using Base UI attributes
- [ ] Test keyboard navigation (Escape to close)
- [ ] Test focus trap behavior

### Tooltip Migration Checklist

- [ ] Replace `TooltipPrimitive` imports
- [ ] Remove `TooltipProvider` wrapper (not needed in Base UI)
- [ ] Change `.Content` to `.Popup`
- [ ] Test delay behavior (may differ)

## Testing After Migration

1. **Visual**: Compare before/after screenshots
2. **Keyboard**: Tab through, Escape to close
3. **Screen reader**: Test with VoiceOver/NVDA
4. **Animations**: Verify enter/exit transitions
5. **Dark mode**: Toggle and verify styles
