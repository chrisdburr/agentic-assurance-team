"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

interface AssistantContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistantModal() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error("useAssistantModal must be used within AssistantProvider");
  }
  return context;
}

interface AssistantProviderProps {
  children: ReactNode;
}

export function AssistantProvider({ children }: AssistantProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Global keyboard listener for CMD+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Check for CMD+K (Mac) or Ctrl+K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        toggle();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return (
    <AssistantContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </AssistantContext.Provider>
  );
}
