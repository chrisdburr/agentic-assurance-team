"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { type ComponentProps, isValidElement } from "react";

import { cn } from "@/lib/utils";

function DropdownMenu({
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.Root>) {
  return (
    <MenuPrimitive.Root data-slot="dropdown-menu" {...props}>
      {children}
    </MenuPrimitive.Root>
  );
}

function DropdownMenuTrigger({
  asChild,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.Trigger> & {
  asChild?: boolean;
}) {
  if (asChild && isValidElement(children)) {
    return (
      <MenuPrimitive.Trigger
        data-slot="dropdown-menu-trigger"
        render={children}
        {...props}
      />
    );
  }
  return (
    <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props}>
      {children}
    </MenuPrimitive.Trigger>
  );
}

function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 4,
  side = "bottom",
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.Popup> & {
  align?: "start" | "center" | "end";
  sideOffset?: number;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        className="z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          className={cn(
            "data-[ending-style]:fade-out-0 data-[open]:fade-in-0 data-[ending-style]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden data-[ending-style]:animate-out data-[open]:animate-in",
            className,
          )}
          data-slot="dropdown-menu-content"
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      )}
      data-slot="dropdown-menu-item"
      {...props}
    />
  );
}

function DropdownMenuLabel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("px-2 py-1.5 text-sm font-semibold", className)}
      data-slot="dropdown-menu-label"
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-muted", className)}
      data-slot="dropdown-menu-separator"
      {...props}
    />
  );
}

function DropdownMenuGroup({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Group>) {
  return (
    <MenuPrimitive.Group
      className={cn("", className)}
      data-slot="dropdown-menu-group"
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
};
