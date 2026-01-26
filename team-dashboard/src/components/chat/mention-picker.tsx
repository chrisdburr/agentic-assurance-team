"use client";

import { useEffect, useRef } from "react";
import { AtSign, Terminal, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MentionOption {
  value: string;
  label: string;
  description: string;
}

export const MENTION_OPTIONS: MentionOption[] = [
  { value: "alice", label: "Alice", description: "Philosopher - epistemology" },
  { value: "bob", label: "Bob", description: "Computer scientist - AI/ML" },
  { value: "charlie", label: "Charlie", description: "Psychologist - HCI/trust" },
  { value: "team", label: "Team", description: "Mention all agents" },
];

export const COMMAND_OPTIONS: MentionOption[] = [
  { value: "standup", label: "/standup", description: "Start daily standup" },
  { value: "status", label: "/status", description: "Check team status" },
  { value: "help", label: "/help", description: "Show available commands" },
];

interface MentionPickerProps {
  type: "mention" | "command";
  query: string;
  selectedIndex: number;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function MentionPicker({
  type,
  query,
  selectedIndex,
  onSelect,
  onClose,
}: MentionPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const options = type === "mention" ? MENTION_OPTIONS : COMMAND_OPTIONS;
  const Icon = type === "mention" ? AtSign : Terminal;
  const title = type === "mention" ? "Mention" : "Commands";

  // Filter options based on query
  const filteredOptions = options.filter(
    (option) =>
      option.value.toLowerCase().includes(query.toLowerCase()) ||
      option.label.toLowerCase().includes(query.toLowerCase())
  );

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selected = containerRef.current?.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filteredOptions.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 mb-2 w-72 z-50 rounded-lg border bg-popover shadow-md"
    >
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b">
        {title}
      </div>
      <div className="max-h-[200px] overflow-y-auto p-1">
        {filteredOptions.map((option, index) => (
          <div
            key={option.value}
            data-selected={index === selectedIndex}
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
          >
            {type === "mention" && option.value === "team" ? (
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-sm truncate">{option.label}</span>
              <span className="text-xs text-muted-foreground truncate">
                {option.description}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="px-2 py-1.5 text-xs text-muted-foreground border-t flex gap-3">
        <span><kbd className="px-1 bg-muted rounded">↑↓</kbd> navigate</span>
        <span><kbd className="px-1 bg-muted rounded">↵</kbd> select</span>
        <span><kbd className="px-1 bg-muted rounded">esc</kbd> close</span>
      </div>
    </div>
  );
}
