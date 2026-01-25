"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMessage } from "@/lib/api";

interface MessageInputProps {
  channel?: string;
  agent?: string;
}

export function MessageInput({ channel, agent }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    const to = channel || agent;
    if (!to) return;

    setSending(true);
    try {
      await sendMessage(to, message.trim());
      setMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
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
