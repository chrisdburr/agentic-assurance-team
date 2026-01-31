"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { type ComponentProps, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

function TooltipProvider({
  delayDuration = 0,
  children,
  ...props
}: {
  delayDuration?: number;
  children: ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delayDuration}
      {...props}
    >
      {children}
    </TooltipPrimitive.Provider>
  );
}

function Tooltip({
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipPrimitive.Root data-slot="tooltip" {...props}>
      {children}
    </TooltipPrimitive.Root>
  );
}

function TooltipTrigger({
  asChild,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Trigger> & {
  asChild?: boolean;
}) {
  // Base UI uses render prop instead of asChild
  // When asChild is true, we pass the single child element as render prop
  if (asChild && isValidElement(children)) {
    return (
      <TooltipPrimitive.Trigger
        data-slot="tooltip-trigger"
        render={children}
        {...props}
      />
    );
  }
  return (
    <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props}>
      {children}
    </TooltipPrimitive.Trigger>
  );
}

function TooltipContent({
  className,
  sideOffset = 0,
  side = "top",
  align = "center",
  children,
  hidden,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Popup> & {
  sideOffset?: number;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  hidden?: boolean;
}) {
  if (hidden) {
    return null;
  }

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        className="z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <TooltipPrimitive.Popup
          className={cn(
            "fade-in-0 zoom-in-95 data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit animate-in text-balance rounded-md bg-foreground px-3 py-1.5 text-background text-xs data-[ending-style]:animate-out",
            className
          )}
          data-slot="tooltip-content"
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] fill-foreground" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
