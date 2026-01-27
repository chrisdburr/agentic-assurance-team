# Framer Motion Integration

Advanced animation patterns using Framer Motion with shadcn components.

## When to Use Framer Motion

Use Framer Motion instead of tw-animate-css when you need:
- Complex orchestrated animations
- Physics-based animations (spring, inertia)
- Gesture handling (drag, pan, hover)
- Exit animations with AnimatePresence
- Layout animations
- Shared element transitions

## Installation

```bash
npm install framer-motion
```

## Basic Patterns

### Animated Component Wrapper

```tsx
import { motion } from "framer-motion"

function AnimatedCard({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}
```

### Motion Variants

Define reusable animation states:

```tsx
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

function FadeInComponent({ children }) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}
```

## AnimatePresence for Exit Animations

Exit animations require AnimatePresence wrapper:

```tsx
import { AnimatePresence, motion } from "framer-motion"

function Modal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="bg-background rounded-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

## Staggered Animations

Animate list items sequentially:

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

function StaggeredList({ items }) {
  return (
    <motion.ul
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {items.map((item) => (
        <motion.li key={item.id} variants={itemVariants}>
          {item.content}
        </motion.li>
      ))}
    </motion.ul>
  )
}
```

## Layout Animations

Smooth transitions when layout changes:

```tsx
function ExpandableCard({ isExpanded }) {
  return (
    <motion.div
      layout
      className={cn(
        "bg-card rounded-lg p-4",
        isExpanded ? "w-full" : "w-64"
      )}
    >
      <motion.h3 layout="position">Title</motion.h3>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            Expanded content here
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
```

## Gesture Animations

### Hover and Tap

```tsx
function InteractiveButton({ children }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
    >
      {children}
    </motion.button>
  )
}
```

### Drag

```tsx
function DraggableCard({ children }) {
  return (
    <motion.div
      drag
      dragConstraints={{ left: 0, right: 300, top: 0, bottom: 300 }}
      dragElastic={0.1}
      className="bg-card p-4 rounded-lg cursor-grab active:cursor-grabbing"
    >
      {children}
    </motion.div>
  )
}
```

## Accessibility: Reduced Motion

Respect user preferences:

```tsx
import { useReducedMotion } from "framer-motion"

function AccessibleAnimation({ children }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
    >
      {children}
    </motion.div>
  )
}
```

### Global Motion Config

Apply reduced motion globally:

```tsx
import { MotionConfig } from "framer-motion"

function App({ children }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  )
}
```

## Integrating with shadcn Components

### Animated Dialog

```tsx
import { Dialog } from "@/components/ui/dialog"
import { motion, AnimatePresence } from "framer-motion"

function AnimatedDialog({ open, onOpenChange, children }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] bg-background rounded-lg p-6"
              >
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog>
  )
}
```

## Performance Tips

1. **Use `layout` sparingly**: Layout animations can be expensive
2. **Prefer `transform` and `opacity`**: These are GPU-accelerated
3. **Use `will-change` hint**: `className="will-change-transform"`
4. **Avoid animating width/height**: Use scale transforms instead
5. **Use `lazy` motion**: Import `LazyMotion` for smaller bundle
