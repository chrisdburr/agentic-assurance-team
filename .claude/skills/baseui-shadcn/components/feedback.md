# Feedback Component Patterns

Patterns for Toast, Alert, Skeleton, and progress indicators.

## Skeleton

Loading placeholder component (already in dashboard):

```tsx
function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-muted animate-pulse rounded-md",
        className
      )}
      {...props}
    />
  )
}
```

### Usage Patterns

```tsx
// Text placeholder
<Skeleton className="h-4 w-[250px]" />

// Avatar placeholder
<Skeleton className="h-12 w-12 rounded-full" />

// Card placeholder
<div className="space-y-3">
  <Skeleton className="h-[125px] w-full rounded-xl" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
</div>

// List placeholder
{Array.from({ length: 5 }).map((_, i) => (
  <Skeleton key={i} className="h-12 w-full" />
))}
```

## Alert

Status message component:

```tsx
import { cva, type VariantProps } from "class-variance-authority"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        success:
          "border-green-500/50 text-green-700 dark:text-green-400 [&>svg]:text-green-600",
        warning:
          "border-yellow-500/50 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<"h5">) {
  return (
    <h5
      data-slot="alert-title"
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-sm [&_p]:leading-relaxed", className)}
      {...props}
    />
  )
}
```

### Usage

```tsx
<Alert variant="destructive">
  <AlertCircleIcon className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Your session has expired. Please log in again.
  </AlertDescription>
</Alert>
```

## Toast

Notification system (using Sonner recommended):

```bash
npx shadcn@latest add sonner
```

```tsx
// Provider setup in layout
import { Toaster } from "@/components/ui/sonner"

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

### Triggering Toasts

```tsx
import { toast } from "sonner"

// Basic toast
toast("Event has been created")

// With description
toast("Event created", {
  description: "Sunday, December 03, 2025 at 9:00 AM",
})

// Success variant
toast.success("Your changes have been saved")

// Error variant
toast.error("Something went wrong", {
  description: "Please try again later",
})

// With action
toast("File deleted", {
  action: {
    label: "Undo",
    onClick: () => restoreFile(),
  },
})

// Promise toast
toast.promise(saveData(), {
  loading: "Saving...",
  success: "Data saved!",
  error: "Could not save",
})
```

## Progress

Linear progress indicator:

```tsx
function Progress({
  value = 0,
  className,
  ...props
}: React.ComponentProps<"div"> & { value?: number }) {
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
```

### Indeterminate Progress

```tsx
<div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
  <div
    className={cn(
      "h-full w-1/3 bg-primary",
      "animate-[progress_1s_ease-in-out_infinite]"
    )}
  />
</div>

// Add to globals.css or as inline keyframes
@keyframes progress {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
```

## Spinner

Loading spinner:

```tsx
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4 animate-spin", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
```

### Button with Loading State

```tsx
function LoadingButton({
  loading,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { loading?: boolean }) {
  return (
    <Button disabled={loading} {...props}>
      {loading && <Spinner className="mr-2" />}
      {children}
    </Button>
  )
}
```

## Empty State

Placeholder for empty content:

```tsx
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && (
        <Icon className="h-12 w-12 text-muted-foreground/50 mb-4" />
      )}
      <h3 className="text-lg font-medium">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
```
