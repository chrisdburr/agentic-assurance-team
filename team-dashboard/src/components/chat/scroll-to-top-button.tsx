"use client";

import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScrollToTopButtonProps {
  onClick: () => void;
  visible: boolean;
}

export function ScrollToTopButton({ onClick, visible }: ScrollToTopButtonProps) {
  if (!visible) return null;

  return (
    <Button
      variant="secondary"
      size="icon"
      className="absolute top-2 right-6 z-10 shadow-md"
      onClick={onClick}
      aria-label="Scroll to top"
    >
      <ChevronUp className="h-4 w-4" />
    </Button>
  );
}
