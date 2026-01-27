# Navigation Component Patterns

Patterns for Sidebar, Tabs, Menu, and navigation components.

## Sidebar

The dashboard uses a custom sidebar implementation with collapsible states.

### Structure

```tsx
<SidebarProvider>
  <Sidebar>
    <SidebarHeader>
      {/* Logo, app name */}
    </SidebarHeader>
    <SidebarContent>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <Icon />
            <span>Dashboard</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarContent>
    <SidebarFooter>
      {/* User info, settings */}
    </SidebarFooter>
  </Sidebar>
</SidebarProvider>
```

### Sidebar Context

Use the context to control sidebar state:

```tsx
const { state, toggleSidebar, setOpen } = useSidebar()

// state: "expanded" | "collapsed"
```

### Responsive Behavior

```tsx
// Desktop: collapsible sidebar
// Mobile: sheet-based sidebar

<Sidebar className="hidden md:flex" />

// Mobile trigger
<Button
  className="md:hidden"
  onClick={() => setOpen(true)}
>
  <MenuIcon />
</Button>
```

### Sidebar Colors

Sidebar has its own color variables:

```tsx
className={cn(
  "bg-sidebar text-sidebar-foreground",
  "border-sidebar-border"
)}

// Active state
"bg-sidebar-accent text-sidebar-accent-foreground"

// Primary items
"bg-sidebar-primary text-sidebar-primary-foreground"
```

## Tabs

Using Base UI Tabs:

```tsx
import { Tabs } from "@base-ui-components/react/tabs"

function TabsExample() {
  return (
    <Tabs.Root defaultValue="tab1">
      <Tabs.List
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1",
          "text-muted-foreground"
        )}
      >
        <Tabs.Tab
          value="tab1"
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1",
            "text-sm font-medium ring-offset-background transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50",
            "data-[state=active]:bg-background data-[state=active]:text-foreground",
            "data-[state=active]:shadow"
          )}
        >
          Tab 1
        </Tabs.Tab>
        <Tabs.Tab value="tab2" className="...">
          Tab 2
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="tab1" className="mt-2">
        Content for tab 1
      </Tabs.Panel>
      <Tabs.Panel value="tab2" className="mt-2">
        Content for tab 2
      </Tabs.Panel>
    </Tabs.Root>
  )
}
```

### Controlled Tabs

```tsx
const [activeTab, setActiveTab] = useState("tab1")

<Tabs.Root value={activeTab} onValueChange={setActiveTab}>
  {/* ... */}
</Tabs.Root>
```

## Dropdown Menu

Using Base UI Menu:

```tsx
import { Menu } from "@base-ui-components/react/menu"

function DropdownMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "inline-flex items-center justify-center rounded-md px-3 py-2",
          "text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        )}
      >
        Options
        <ChevronDownIcon className="ml-2 h-4 w-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup
            className={cn(
              "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1",
              "text-popover-foreground shadow-md",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            )}
          >
            <Menu.Item
              className={cn(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5",
                "text-sm outline-none transition-colors",
                "focus:bg-accent focus:text-accent-foreground",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              )}
            >
              Edit
            </Menu.Item>
            <Menu.Separator className="-mx-1 my-1 h-px bg-muted" />
            <Menu.Item className="...">Delete</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
```

### Submenus

```tsx
<Menu.Item>
  <Menu.SubmenuTrigger className="...">
    More Options
    <ChevronRightIcon className="ml-auto h-4 w-4" />
  </Menu.SubmenuTrigger>
  <Menu.Portal>
    <Menu.Positioner>
      <Menu.Popup className="...">
        <Menu.Item>Sub Item 1</Menu.Item>
        <Menu.Item>Sub Item 2</Menu.Item>
      </Menu.Popup>
    </Menu.Positioner>
  </Menu.Portal>
</Menu.Item>
```

## Breadcrumb

Simple breadcrumb navigation:

```tsx
function Breadcrumb({
  items,
}: {
  items: Array<{ label: string; href?: string }>
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            {index > 0 && <ChevronRightIcon className="h-4 w-4" />}
            {item.href ? (
              <a
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <span className="text-foreground font-medium">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
```

## Navigation Links

Active state styling pattern:

```tsx
function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      data-active={active || undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
        "transition-colors hover:bg-accent hover:text-accent-foreground",
        "data-[active]:bg-accent data-[active]:text-accent-foreground",
        "data-[active]:font-medium"
      )}
    >
      {children}
    </a>
  )
}
```

## Keyboard Navigation

All navigation components support keyboard interaction:

- **Tab/Shift+Tab**: Move between focusable items
- **Arrow keys**: Navigate within menus/tabs
- **Enter/Space**: Activate current item
- **Escape**: Close menus/dropdowns
- **Home/End**: Jump to first/last item
