import { cva, type VariantProps } from "class-variance-authority";
import {
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border border-transparent px-2 py-0.5 font-medium text-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface RenderProps {
  className?: string;
  children?: ReactNode;
}

function Badge({
  className,
  variant = "default",
  asChild = false,
  render,
  children,
  ...props
}: ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    render?: ReactElement<RenderProps>;
  }) {
  const combinedClassName = cn(badgeVariants({ variant }), className);

  // Base UI render prop pattern (preferred)
  if (render && isValidElement(render)) {
    return cloneElement(render, {
      ...props,
      "data-slot": "badge",
      "data-variant": variant,
      className: cn(combinedClassName, render.props.className),
      children: children ?? render.props.children,
    } as RenderProps);
  }

  // Legacy asChild pattern (for backwards compatibility)
  if (asChild && isValidElement<RenderProps>(children)) {
    return cloneElement(children, {
      ...props,
      "data-slot": "badge",
      "data-variant": variant,
      className: cn(combinedClassName, children.props.className),
    } as RenderProps);
  }

  return (
    <span
      className={combinedClassName}
      data-slot="badge"
      data-variant={variant}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
