"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { SendIcon, StopCircleIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AssistantInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function AssistantInput({
  onSend,
  onStop,
  isLoading,
  disabled,
}: AssistantInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (value.trim() && !disabled && !isLoading) {
      onSend(value);
      setValue("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to submit, Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask me anything about Team Chat..."
        disabled={disabled}
        className={cn(
          "min-h-[44px] max-h-[200px] resize-none",
          "focus-visible:ring-1",
        )}
        rows={1}
      />
      {isLoading ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={onStop}
          className="shrink-0"
        >
          <StopCircleIcon className="size-4" />
          <span className="sr-only">Stop</span>
        </Button>
      ) : (
        <Button
          type="button"
          size="icon"
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className="shrink-0"
        >
          <SendIcon className="size-4" />
          <span className="sr-only">Send</span>
        </Button>
      )}
    </div>
  );
}
