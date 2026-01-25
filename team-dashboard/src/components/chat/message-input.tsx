"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MessageInputProps {
  channel?: string;
  agent?: string;
}

export function MessageInput({ channel, agent }: MessageInputProps) {
  const [message, setMessage] = useState("");

  // Note: Sending messages is out of scope for MVP (needs POST endpoint)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    // TODO: Implement message sending when POST endpoint is available
    console.log("Would send:", { channel, agent, message });
    setMessage("");
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
          disabled // Disabled until POST endpoint is available
        />
        <Button type="submit" size="icon" disabled>
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Message sending coming soon
      </p>
    </form>
  );
}
