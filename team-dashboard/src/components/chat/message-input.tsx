"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MentionPicker, MENTION_OPTIONS, COMMAND_OPTIONS } from "./mention-picker";

// Supported slash commands
export type SlashCommand = "standup" | "status" | "help";

export interface CommandResult {
  command: SlashCommand;
  success: boolean;
  message: string;
}

interface MessageInputProps {
  channel?: string;
  agent?: string;
  onSend: (content: string) => Promise<void>;
  onCommand?: (command: SlashCommand) => Promise<CommandResult>;
}

interface TriggerState {
  type: "mention" | "command";
  startIndex: number;
  query: string;
}

// Parse a slash command from input
function parseCommand(input: string): SlashCommand | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "/standup") return "standup";
  if (trimmed === "/status") return "status";
  if (trimmed === "/help") return "help";
  return null;
}

// Detect trigger character and extract query
function detectTrigger(value: string, cursorPosition: number): TriggerState | null {
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

export function MessageInput({ channel, agent, onSend, onCommand }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<TriggerState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get filtered options for keyboard navigation
  const getFilteredOptions = useCallback(() => {
    if (!trigger) return [];
    const options = trigger.type === "mention" ? MENTION_OPTIONS : COMMAND_OPTIONS;
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

  const handleSelect = useCallback((value: string) => {
    if (!trigger || !inputRef.current) return;

    const prefix = trigger.type === "mention" ? "@" : "/";
    const replacement = `${prefix}${value} `;
    const before = message.slice(0, trigger.startIndex);
    const after = message.slice(trigger.startIndex + trigger.query.length + 1);
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
  }, [trigger, message]);

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
    const command = parseCommand(content);
    if (command && onCommand) {
      try {
        const result = await onCommand(command);
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
      setError(`Unknown command: ${unknownCmd}. Type /help for available commands.`);
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
    <form onSubmit={handleSubmit} className="border-t px-6 py-4">
      {error && (
        <div className="text-sm text-red-500 mb-2">{error}</div>
      )}
      <div className="relative flex gap-2">
        {trigger && (
          <MentionPicker
            type={trigger.type}
            query={trigger.query}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
            onClose={handleClose}
          />
        )}
        <Input
          ref={inputRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
          disabled={sending}
          autoComplete="off"
        />
        <Button type="submit" size="icon" disabled={sending || !message.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
