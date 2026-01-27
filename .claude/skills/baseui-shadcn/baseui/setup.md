# Base UI Setup with shadcn

## Starting a New Project

Use the interactive CLI to create a project with Base UI:

```bash
npx shadcn@latest init
```

When prompted:
1. Select "Base UI" as your component library
2. Choose your styling approach (CSS variables recommended)
3. Configure paths as needed

This generates a `components.json` that specifies Base UI:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  },
  "library": "base-ui"
}
```

## Adding Components

Install individual components as needed:

```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add input
```

The CLI automatically uses the correct primitive (Base UI or Radix) based on your `components.json`.

## Manual Setup (Existing Project)

If adding Base UI to an existing project:

### 1. Install the package

```bash
npm install @base-ui-components/react
```

### 2. Update components.json

Add or update the `library` field:

```json
{
  "library": "base-ui"
}
```

### 3. Install components

```bash
npx shadcn@latest add dialog --overwrite
```

The `--overwrite` flag replaces existing Radix-based components with Base UI versions.

## Project Structure

After setup, components live in `src/components/ui/`:

```
src/
├── components/
│   └── ui/
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       └── ...
└── lib/
    └── utils.ts      # cn() helper
```

## Required Dependencies

Base UI projects need:

```json
{
  "dependencies": {
    "@base-ui-components/react": "^1.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  }
}
```

## Verification

After setup, verify by adding a simple component:

```bash
npx shadcn@latest add button
```

Check the generated file imports from Base UI:

```tsx
// Should see this for Base UI projects:
import { Button as BaseButton } from '@base-ui-components/react/button'

// NOT this (Radix):
import { Slot } from '@radix-ui/react-slot'
```
