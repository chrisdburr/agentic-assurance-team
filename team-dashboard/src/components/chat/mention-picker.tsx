"use client";

import { AtSign, Terminal, Users } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface MentionOption {
  value: string;
  label: string;
  description: string;
}

export const MENTION_OPTIONS: MentionOption[] = [
  { value: "alice", label: "Alice", description: "Philosopher - epistemology" },
  { value: "bob", label: "Bob", description: "Computer scientist - AI/ML" },
  {
    value: "charlie",
    label: "Charlie",
    description: "Psychologist - HCI/trust",
  },
  { value: "team", label: "Team", description: "Mention all agents" },
];

export const COMMAND_OPTIONS: MentionOption[] = [
  { value: "standup", label: "/standup", description: "Start daily standup" },
  { value: "status", label: "/status", description: "Check team status" },
  {
    value: "orchestrate:decompose",
    label: "/orchestrate:decompose",
    description: "Decompose task into issues",
  },
  {
    value: "orchestrate:status",
    label: "/orchestrate:status",
    description: "Check epic progress",
  },
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
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selected = containerRef.current?.querySelector(
      '[data-selected="true"]'
    );
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filteredOptions.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg border bg-popover shadow-md"
      ref={containerRef}
    >
      <div className="border-b px-2 py-1.5 font-medium text-muted-foreground text-xs">
        {title}
      </div>
      <div className="max-h-[200px] overflow-y-auto p-1">
        {filteredOptions.map((option, index) => (
          <div
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
            data-selected={index === selectedIndex}
            key={option.value}
            onClick={() => onSelect(option.value)}
          >
            {type === "mention" && option.value === "team" ? (
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-sm">
                {option.label}
              </span>
              <span className="truncate text-muted-foreground text-xs">
                {option.description}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 border-t px-2 py-1.5 text-muted-foreground text-xs">
        <span>
          <kbd className="rounded bg-muted px-1">↑↓</kbd> navigate
        </span>
        <span>
          <kbd className="rounded bg-muted px-1">↵</kbd> select
        </span>
        <span>
          <kbd className="rounded bg-muted px-1">esc</kbd> close
        </span>
      </div>
    </div>
  );
}
