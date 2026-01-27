"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { type ComponentProps, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

function Popover({
  children,
  ...props
}: Omit<ComponentProps<typeof PopoverPrimitive.Root>, "children"> & {
  children?: ReactNode;
}) {
  return (
    <PopoverPrimitive.Root data-slot="popover" {...props}>
      {children}
    </PopoverPrimitive.Root>
  );
}

function PopoverTrigger({
  asChild,
  children,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Trigger> & {
  asChild?: boolean;
}) {
  if (asChild && isValidElement(children)) {
    return (
      <PopoverPrimitive.Trigger
        data-slot="popover-trigger"
        render={children}
        {...props}
      />
    );
  }
  return (
    <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props}>
      {children}
    </PopoverPrimitive.Trigger>
  );
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  side = "bottom",
  children,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Popup> & {
  align?: "start" | "center" | "end";
  sideOffset?: number;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          className={cn(
            "data-[ending-style]:fade-out-0 data-[open]:fade-in-0 data-[ending-style]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[ending-style]:animate-out data-[open]:animate-in",
            className,
          )}
          data-slot="popover-content"
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

/**
 * @deprecated Base UI doesn't have a separate Anchor component.
 * Use the `anchor` prop on PopoverContent's Positioner instead.
 * This stub is kept for backwards compatibility.
 */
function PopoverAnchor({ children, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="popover-anchor" {...props}>
      {children}
    </div>
  );
}

function PopoverHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1 text-sm", className)}
      data-slot="popover-header"
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <div
      className={cn("font-medium", className)}
      data-slot="popover-title"
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground", className)}
      data-slot="popover-description"
      {...props}
    />
  );
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
};
