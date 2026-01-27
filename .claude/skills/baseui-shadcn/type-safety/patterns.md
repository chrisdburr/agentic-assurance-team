# TypeScript Patterns for Components

Type-safe patterns for building reusable UI components.

## Basic Component Props

Extend native element props with `React.ComponentProps`:

```tsx
function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn("...", className)}
      {...props}
    />
  )
}
```

This automatically includes all native input attributes: `value`, `onChange`, `disabled`, etc.

## Component Props with Extensions

Add custom props alongside native ones:

```tsx
function DialogContent({
  className,
  children,
  showCloseButton = true,  // Custom prop
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  // ...
}
```

## CVA Variants

Type variants with `class-variance-authority`:

```tsx
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva("inline-flex items-center justify-center", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground",
      destructive: "bg-destructive text-white",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3",
      lg: "h-10 rounded-md px-6",
      icon: "size-9",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
})

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

## Generic Components

Create type-safe generic components:

```tsx
// List component that works with any item type
interface ListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T, index: number) => string
  className?: string
}

function List<T>({
  items,
  renderItem,
  keyExtractor,
  className,
}: ListProps<T>) {
  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((item, index) => (
        <li key={keyExtractor(item, index)}>
          {renderItem(item, index)}
        </li>
      ))}
    </ul>
  )
}

// Usage
<List
  items={users}
  renderItem={(user) => <UserCard user={user} />}
  keyExtractor={(user) => user.id}
/>
```

## Discriminated Unions for Variants

Use discriminated unions for mutually exclusive states:

```tsx
type AlertProps = {
  className?: string
  children: React.ReactNode
} & (
  | { variant: "default" }
  | { variant: "destructive"; onDismiss?: () => void }
  | { variant: "success"; autoHide?: boolean }
)

function Alert(props: AlertProps) {
  const { variant, className, children } = props

  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border p-4",
        variant === "destructive" && "border-destructive bg-destructive/10",
        variant === "success" && "border-green-500 bg-green-500/10",
        className
      )}
    >
      {children}
      {variant === "destructive" && props.onDismiss && (
        <button onClick={props.onDismiss}>Dismiss</button>
      )}
    </div>
  )
}
```

## Polymorphic Components (asChild)

Support rendering as different elements:

```tsx
import { Slot } from "@radix-ui/react-slot"

interface ButtonProps extends React.ComponentProps<"button"> {
  asChild?: boolean
}

function Button({ asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button"
  return <Comp {...props} />
}

// Usage - renders as anchor but keeps button styles
<Button asChild>
  <a href="/home">Go Home</a>
</Button>
```

## Forwarding Refs

For components that need ref access:

```tsx
const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn("...", className)}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"
```

Note: Modern shadcn uses function declarations with `React.ComponentProps` which handles refs automatically in React 19+.

## Extracting Props Types

Export prop types for external use:

```tsx
// Component definition
function Card({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "bordered" | "elevated"
}) {
  // ...
}

// Export the props type
type CardProps = React.ComponentProps<typeof Card>

// Now external code can use CardProps
const cardProps: CardProps = {
  variant: "bordered",
  className: "my-card",
}
```

## Event Handler Types

Type event handlers correctly:

```tsx
interface FormFieldProps {
  value: string
  onChange: (value: string) => void  // Simplified
  onBlur?: React.FocusEventHandler<HTMLInputElement>  // Native event
}

function FormField({ value, onChange, onBlur }: FormFieldProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
  )
}
```

## Strict Mode Patterns

Avoid `any` and use strict patterns:

```tsx
// Bad: any props
function BadComponent(props: any) { ... }

// Good: explicit props
function GoodComponent(props: React.ComponentProps<"div">) { ... }

// Bad: loose event types
const handleClick = (e: any) => { ... }

// Good: specific event types
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => { ... }
```
