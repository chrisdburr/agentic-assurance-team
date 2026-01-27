# Form Component Patterns

Patterns for building accessible forms with Base UI and shadcn.

## Base UI Field Component

The Field component provides automatic label association, error handling, and validation:

```tsx
import { Field } from "@base-ui-components/react/field"

function EmailField() {
  return (
    <Field.Root>
      <Field.Label className="text-sm font-medium">
        Email
      </Field.Label>
      <Field.Control
        type="email"
        placeholder="you@example.com"
        className={cn(
          "flex h-9 w-full rounded-md border bg-transparent px-3 py-1",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      />
      <Field.Error className="text-sm text-destructive">
        Please enter a valid email address
      </Field.Error>
    </Field.Root>
  )
}
```

## Input Component

Current pattern using native input:

```tsx
import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "md:text-sm",
        className
      )}
      {...props}
    />
  )
}
```

## Checkbox with Field

```tsx
import { Field } from "@base-ui-components/react/field"
import { Checkbox } from "@base-ui-components/react/checkbox"

function CheckboxField() {
  return (
    <Field.Root className="flex items-center gap-2">
      <Checkbox.Root
        className={cn(
          "h-4 w-4 shrink-0 rounded-sm border border-primary",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        )}
      >
        <Checkbox.Indicator className="flex items-center justify-center text-current">
          <CheckIcon className="h-3.5 w-3.5" />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <Field.Label className="text-sm font-medium leading-none">
        Accept terms and conditions
      </Field.Label>
    </Field.Root>
  )
}
```

## Select Component

Using Base UI Select:

```tsx
import { Select } from "@base-ui-components/react/select"

function SelectField() {
  return (
    <Field.Root>
      <Field.Label>Country</Field.Label>
      <Select.Root>
        <Select.Trigger
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border px-3 py-2",
            "bg-transparent text-sm shadow-xs",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <Select.Value placeholder="Select a country" />
          <Select.Icon>
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup
              className={cn(
                "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 shadow-md",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
              )}
            >
              <Select.Item value="us" className="...">
                <Select.ItemText>United States</Select.ItemText>
              </Select.Item>
              <Select.Item value="uk" className="...">
                <Select.ItemText>United Kingdom</Select.ItemText>
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </Field.Root>
  )
}
```

## Form Validation Pattern

Base UI Field integrates with native validation:

```tsx
function ValidatedForm() {
  return (
    <form noValidate>
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <Field.Control
          type="email"
          required
          pattern="[^@]+@[^@]+\.[^@]+"
        />
        <Field.Error match="valueMissing">
          Email is required
        </Field.Error>
        <Field.Error match="patternMismatch">
          Please enter a valid email
        </Field.Error>
      </Field.Root>
    </form>
  )
}
```

The `match` prop corresponds to `ValidityState` properties:
- `valueMissing` - required field is empty
- `typeMismatch` - type validation failed (email, url)
- `patternMismatch` - regex pattern failed
- `tooShort` / `tooLong` - length constraints
- `rangeUnderflow` / `rangeOverflow` - min/max values

## Switch Component

```tsx
import { Switch } from "@base-ui-components/react/switch"

function SwitchField() {
  return (
    <Field.Root className="flex items-center gap-2">
      <Switch.Root
        className={cn(
          "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full",
          "border-2 border-transparent shadow-xs transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
        )}
      >
        <Switch.Thumb
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg",
            "ring-0 transition-transform",
            "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
          )}
        />
      </Switch.Root>
      <Field.Label>Enable notifications</Field.Label>
    </Field.Root>
  )
}
```

## Textarea

```tsx
function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2",
        "text-base shadow-xs placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "md:text-sm",
        className
      )}
      {...props}
    />
  )
}
```
