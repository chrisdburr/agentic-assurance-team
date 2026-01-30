"use client";

import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  COMMAND_OPTIONS,
  MENTION_OPTIONS,
  MentionPicker,
} from "./mention-picker";

// Supported slash commands
export type SlashCommand =
  | "standup"
  | "status"
  | "help"
  | "orchestrate:decompose"
  | "orchestrate:status";

export interface CommandResult {
  command: SlashCommand;
  success: boolean;
  message: string;
}

interface ParsedCommand {
  command: SlashCommand;
  args?: string;
}

interface MessageInputProps {
  channel?: string;
  agent?: string;
  onSend: (content: string) => Promise<void>;
  onCommand?: (command: SlashCommand, args?: string) => Promise<CommandResult>;
}

interface TriggerState {
  type: "mention" | "command";
  startIndex: number;
  query: string;
}

const COMMAND_MAP: Record<string, SlashCommand> = {
  "/standup": "standup",
  "/status": "status",
  "/help": "help",
  "/orchestrate:decompose": "orchestrate:decompose",
  "/orchestrate:status": "orchestrate:status",
};

// Parse a slash command (with optional args) from input
function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  const spaceIndex = trimmed.indexOf(" ");
  const commandPart = (
    spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex)
  ).toLowerCase();
  const command = COMMAND_MAP[commandPart];
  if (!command) {
    return null;
  }
  const args =
    spaceIndex === -1
      ? undefined
      : trimmed.slice(spaceIndex + 1).trim() || undefined;
  return { command, args };
}

// Detect trigger character and extract query
function detectTrigger(
  value: string,
  cursorPosition: number
): TriggerState | null {
  // Look backwards from cursor position to find trigger character
  let i = cursorPosition - 1;

  while (i >= 0) {
    const char = value[i];

    // Found a trigger character
    if (char === "@" || char === "/") {
      // Check if it's at the start or after a space (not in the middle of a word)
      if (i === 0 || value[i - 1] === " ") {
        const query = value.slice(i + 1, cursorPosition);
        // Don't trigger if there's a space in the query (user has moved on)
        if (!query.includes(" ")) {
          return {
            type: char === "@" ? "mention" : "command",
            startIndex: i,
            query,
          };
        }
      }
      break;
    }

    // Stop if we hit a space (no trigger found)
    if (char === " ") {
      break;
    }

    i--;
  }

  return null;
}

export function MessageInput({
  channel,
  agent,
  onSend,
  onCommand,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<TriggerState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get filtered options for keyboard navigation
  const getFilteredOptions = useCallback(() => {
    if (!trigger) return [];
    const options =
      trigger.type === "mention" ? MENTION_OPTIONS : COMMAND_OPTIONS;
    return options.filter(
      (option) =>
        option.value.toLowerCase().includes(trigger.query.toLowerCase()) ||
        option.label.toLowerCase().includes(trigger.query.toLowerCase())
    );
  }, [trigger]);

  // Reset selected index when trigger changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [trigger?.query, trigger?.type]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;

    setMessage(value);
    setTrigger(detectTrigger(value, cursorPosition));
  };

  const handleSelect = useCallback(
    (value: string) => {
      if (!(trigger && inputRef.current)) return;

      const prefix = trigger.type === "mention" ? "@" : "/";
      const replacement = `${prefix}${value} `;
      const before = message.slice(0, trigger.startIndex);
      const after = message.slice(
        trigger.startIndex + trigger.query.length + 1
      );
      const newMessage = before + replacement + after;

      setMessage(newMessage);
      setTrigger(null);

      // Focus input and set cursor position after the inserted text
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newPosition = before.length + replacement.length;
          inputRef.current.setSelectionRange(newPosition, newPosition);
        }
      }, 0);
    },
    [trigger, message]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!trigger) return;

    const filteredOptions = getFilteredOptions();
    if (filteredOptions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        if (filteredOptions.length > 0) {
          e.preventDefault();
          handleSelect(filteredOptions[selectedIndex].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        setTrigger(null);
        break;
      case "Tab":
        if (filteredOptions.length > 0) {
          e.preventDefault();
          handleSelect(filteredOptions[selectedIndex].value);
        }
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    // Close picker if open
    if (trigger) {
      setTrigger(null);
    }

    setSending(true);
    setError(null);
    const content = message.trim();
    setMessage(""); // Clear input immediately for better UX

    // Check for slash command
    const parsed = parseCommand(content);
    if (parsed && onCommand) {
      try {
        const result = await onCommand(parsed.command, parsed.args);
        if (!result.success) {
          setError(result.message);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Command failed");
      } finally {
        setSending(false);
      }
      return;
    }

    // Check for unknown slash command
    if (content.startsWith("/")) {
      const unknownCmd = content.split(/\s/)[0];
      setError(
        `Unknown command: ${unknownCmd}. Type /help for available commands.`
      );
      setSending(false);
      return;
    }

    try {
      await onSend(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setMessage(content); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const handleClose = useCallback(() => {
    setTrigger(null);
  }, []);

  const placeholder = channel
    ? `Message #${channel}`
    : agent
      ? `Message @${agent}`
      : "Type a message...";

  return (
    <form className="border-t px-6 py-4" onSubmit={handleSubmit}>
      {error && <div className="mb-2 text-red-500 text-sm">{error}</div>}
      <div className="relative flex gap-2">
        {trigger && (
          <MentionPicker
            onClose={handleClose}
            onSelect={handleSelect}
            query={trigger.query}
            selectedIndex={selectedIndex}
            type={trigger.type}
          />
        )}
        <Input
          autoComplete="off"
          className="flex-1"
          disabled={sending}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          ref={inputRef}
          value={message}
        />
        <Button disabled={sending || !message.trim()} size="icon" type="submit">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
