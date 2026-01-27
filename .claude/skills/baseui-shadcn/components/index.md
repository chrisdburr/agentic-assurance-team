# Component Catalog

Overview of available UI components and their categories.

## Current Dashboard Components

Located in `team-dashboard/src/components/ui/`:

| Component | Primitive | Sub-components |
|-----------|-----------|----------------|
| `avatar` | Radix | Avatar, AvatarImage, AvatarFallback |
| `badge` | Native | Badge |
| `button` | Radix (Slot) | Button |
| `card` | Native | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| `command` | cmdk | Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem |
| `dialog` | Radix | Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter |
| `input` | Native | Input |
| `popover` | Radix | Popover, PopoverTrigger, PopoverContent |
| `scroll-area` | Radix | ScrollArea, ScrollBar |
| `separator` | Radix | Separator |
| `sheet` | Radix (Dialog) | Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription |
| `sidebar` | Custom | Sidebar, SidebarProvider, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem |
| `skeleton` | Native | Skeleton |
| `tooltip` | Radix | Tooltip, TooltipTrigger, TooltipContent, TooltipProvider |

## Component Categories

### Forms
Components for user input and data collection.
See `@file forms.md` for detailed patterns.

- Input, Textarea
- Checkbox, Radio, Switch
- Select, Combobox
- Field (Base UI validation wrapper)

### Overlays
Components that appear above the main content.
See `@file overlays.md` for detailed patterns.

- Dialog (modal)
- Sheet (slide-out panel)
- Popover (floating content)
- Tooltip (contextual hints)

### Navigation
Components for moving through the application.
See `@file navigation.md` for detailed patterns.

- Sidebar
- Tabs
- Menu, DropdownMenu
- Breadcrumb

### Feedback
Components that communicate status to users.
See `@file feedback.md` for detailed patterns.

- Toast (notifications)
- Alert
- Skeleton (loading state)
- Progress

### Layout
Structural components.

- Card
- Separator
- ScrollArea

## Adding New Components

### From shadcn registry

```bash
npx shadcn@latest add <component-name>
```

### Creating custom components

Follow the established pattern:

```tsx
import { cn } from "@/lib/utils"

function MyComponent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="my-component"
      className={cn("default-styles", className)}
      {...props}
    />
  )
}

export { MyComponent }
```

## Component Conventions

1. **Function declarations** over arrow functions
2. **data-slot attribute** for styling hooks
3. **className prop** spread via `cn()` helper
4. **Named exports** (not default exports)
5. **Forwarded refs** when wrapping primitives
