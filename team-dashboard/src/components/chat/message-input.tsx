"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MessageInputProps {
  channel?: string;
  agent?: string;
  onSend: (content: string) => Promise<void>;
}

export function MessageInput({ channel, agent, onSend }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    setError(null);
    const content = message.trim();
    setMessage(""); // Clear input immediately for better UX

    try {
      await onSend(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setMessage(content); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const placeholder = channel
    ? `Message #${channel}`
    : agent
      ? `Message @${agent}`
      : "Type a message...";

  return (
    <form onSubmit={handleSubmit} className="border-t p-4">
      {error && (
        <div className="text-sm text-red-500 mb-2">{error}</div>
      )}
      <div className="flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
          disabled={sending}
        />
        <Button type="submit" size="icon" disabled={sending || !message.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
