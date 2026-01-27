# Overlay Component Patterns

Patterns for Dialog, Sheet, Popover, and Tooltip components.

## Dialog

Modal dialog for focused interactions.

### Current Implementation (Radix)

```tsx
import * as DialogPrimitive from "@radix-ui/react-dialog"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-lg",
          "translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close className="absolute top-4 right-4 ...">
            <XIcon />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
```

### Base UI Pattern

```tsx
import { Dialog } from "@base-ui-components/react/dialog"

function DialogContent({ className, children, ...props }) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop
        className={cn(
          "fixed inset-0 z-50 bg-black/50",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        )}
      />
      <Dialog.Popup
        className={cn(
          "bg-background fixed top-[50%] left-[50%] z-50",
          "translate-x-[-50%] translate-y-[-50%]",
          // Same animation classes work
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          className
        )}
        {...props}
      >
        {children}
        <Dialog.Close className="absolute top-4 right-4 ...">
          <XIcon />
        </Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  )
}
```

### Usage

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Dialog description text.</DialogDescription>
    </DialogHeader>
    <div>Content goes here</div>
    <DialogFooter>
      <Button>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Sheet

Slide-out panel, typically from screen edge.

```tsx
function SheetContent({
  side = "right",
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-background fixed z-50 flex flex-col gap-4 shadow-lg",
          "transition-transform duration-300 ease-in-out",
          // Side-specific positioning and animations
          side === "right" && "inset-y-0 right-0 h-full w-3/4 sm:max-w-sm",
          side === "right" && "data-[state=open]:slide-in-from-right",
          side === "left" && "inset-y-0 left-0 h-full w-3/4 sm:max-w-sm",
          side === "left" && "data-[state=open]:slide-in-from-left",
          side === "top" && "inset-x-0 top-0 h-auto",
          side === "top" && "data-[state=open]:slide-in-from-top",
          side === "bottom" && "inset-x-0 bottom-0 h-auto",
          side === "bottom" && "data-[state=open]:slide-in-from-bottom",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          className
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}
```

## Popover

Floating content anchored to a trigger.

```tsx
import { Popover } from "@base-ui-components/react/popover"

function PopoverContent({ className, align = "center", sideOffset = 4, ...props }) {
  return (
    <Popover.Portal>
      <Popover.Positioner sideOffset={sideOffset}>
        <Popover.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2",
            "data-[side=top]:slide-in-from-bottom-2",
            className
          )}
          {...props}
        />
      </Popover.Positioner>
    </Popover.Portal>
  )
}
```

### Popover with Arrow

```tsx
<Popover.Portal>
  <Popover.Positioner>
    <Popover.Popup className="...">
      <Popover.Arrow className="fill-popover" />
      Content here
    </Popover.Popup>
  </Popover.Positioner>
</Popover.Portal>
```

## Tooltip

Contextual information on hover/focus.

```tsx
import { Tooltip } from "@base-ui-components/react/tooltip"

// Note: Base UI doesn't require TooltipProvider
function TooltipContent({ className, sideOffset = 4, ...props }) {
  return (
    <Tooltip.Portal>
      <Tooltip.Positioner sideOffset={sideOffset}>
        <Tooltip.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground",
            "animate-in fade-in-0 zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=top]:slide-in-from-bottom-2",
            className
          )}
          {...props}
        />
      </Tooltip.Positioner>
    </Tooltip.Portal>
  )
}
```

### Usage

```tsx
<Tooltip.Root>
  <Tooltip.Trigger asChild>
    <Button variant="outline">Hover me</Button>
  </Tooltip.Trigger>
  <TooltipContent>
    Helpful information here
  </TooltipContent>
</Tooltip.Root>
```

## Positioning

All overlay components support positioning via `Positioner`:

```tsx
<Popover.Positioner
  side="bottom"       // top | bottom | left | right
  align="center"      // start | center | end
  sideOffset={4}      // gap from anchor
  alignOffset={0}     // alignment adjustment
  avoidCollisions     // flip to avoid viewport edges
>
```

## Animation Patterns

Standard enter/exit with tw-animate-css:

```tsx
// Fade + scale (for centered overlays)
"data-[state=open]:animate-in data-[state=closed]:animate-out"
"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"

// Directional slide (for positioned overlays)
"data-[side=bottom]:slide-in-from-top-2"
"data-[side=left]:slide-in-from-right-2"
"data-[side=right]:slide-in-from-left-2"
"data-[side=top]:slide-in-from-bottom-2"
```
