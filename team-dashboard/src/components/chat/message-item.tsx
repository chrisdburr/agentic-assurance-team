"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAgent } from "@/lib/constants";
import type { Message } from "@/types";
import { formatDistanceToNow } from "@/lib/date";

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const agent = getAgent(message.from_agent);
  const timestamp = new Date(message.timestamp);

  return (
    <div className="flex gap-3 group hover:bg-accent/50 -mx-2 px-2 py-1 rounded">
      <Avatar className="h-8 w-8 mt-0.5">
        <AvatarFallback className={agent.bgColor}>
          {agent.name[0]}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`font-semibold ${agent.textColor}`}>
            {agent.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(timestamp)}
          </span>
        </div>

        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    </div>
  );
}
