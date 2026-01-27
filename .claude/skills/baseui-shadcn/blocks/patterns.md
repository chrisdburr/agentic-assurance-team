# shadcn Blocks Patterns

Using shadcn blocks for common layouts and patterns.

## What Are Blocks?

Blocks are pre-built, copy-paste UI sections that combine multiple components. They're larger than individual components but smaller than full pages.

## Installing Blocks

```bash
# Browse available blocks
npx shadcn@latest add --all

# Add specific block
npx shadcn@latest add login-01
```

## Common Block Categories

### Authentication

```bash
npx shadcn@latest add login-01
npx shadcn@latest add login-02
npx shadcn@latest add signup-01
```

### Dashboard

```bash
npx shadcn@latest add dashboard-01
npx shadcn@latest add dashboard-02
```

### Sidebar

```bash
npx shadcn@latest add sidebar-01
npx shadcn@latest add sidebar-02
```

## Block Structure

Blocks typically include:
- Layout wrapper
- Multiple shadcn components
- Responsive design
- Dark mode support

Example login block structure:

```tsx
// blocks/login-01.tsx
export function LoginForm() {
  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>
          Enter your email below to login to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="m@example.com" required />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center">
              <Label htmlFor="password">Password</Label>
              <a href="#" className="ml-auto text-sm underline">
                Forgot your password?
              </a>
            </div>
            <Input id="password" type="password" required />
          </div>
          <Button type="submit" className="w-full">
            Login
          </Button>
          <Button variant="outline" className="w-full">
            Login with Google
          </Button>
        </div>
        <div className="mt-4 text-center text-sm">
          Don&apos;t have an account?{" "}
          <a href="#" className="underline">Sign up</a>
        </div>
      </CardContent>
    </Card>
  )
}
```

## Customizing Blocks

### 1. Copy the block to your project

Blocks are meant to be copied and modified, not imported as dependencies.

### 2. Modify to fit your needs

```tsx
// Original
<Button type="submit" className="w-full">
  Login
</Button>

// Customized
<Button type="submit" className="w-full" disabled={isLoading}>
  {isLoading ? <Spinner className="mr-2" /> : null}
  Login
</Button>
```

### 3. Connect to your backend

```tsx
export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    // Your auth logic here
    await signIn(email, password)
    setIsLoading(false)
  }

  return (
    <form onSubmit={onSubmit}>
      {/* ... */}
    </form>
  )
}
```

## Creating Custom Blocks

Follow the shadcn conventions:

```tsx
// blocks/custom-header.tsx
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function CustomHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <a href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">App Name</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              Features
            </Button>
            <Button variant="ghost" size="sm">
              Pricing
            </Button>
          </nav>
          <Avatar className="h-8 w-8">
            <AvatarImage src="/avatar.png" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
```

## Block Best Practices

1. **Keep blocks focused**: One block = one purpose
2. **Use semantic HTML**: Proper headings, landmarks, labels
3. **Support dark mode**: Test both themes
4. **Be responsive**: Mobile-first approach
5. **Extract repeated patterns**: If you use a block pattern multiple times, consider making it a reusable component

## Blocks vs Components

| Aspect | Components | Blocks |
|--------|-----------|--------|
| Size | Small, single-purpose | Larger, combines components |
| Reusability | High, import anywhere | Medium, copy and customize |
| Customization | Via props | Via code modification |
| State management | Usually stateless | Often includes state |
| Example | Button, Input, Card | LoginForm, DashboardLayout |
