"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAgent } from "@/lib/constants";
import type { Message } from "@/types";
import { formatDistanceToNow } from "@/lib/date";
import { cn } from "@/lib/utils";

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const agent = getAgent(message.from_agent);
  const timestamp = new Date(message.timestamp);
  const isUser = message.from_agent === "user";

  if (isUser) {
    // User messages: right-aligned, simple bubble
    return (
      <div className="flex justify-end gap-3 group">
        <div className="max-w-[80%]">
          <div className="flex items-baseline gap-2 justify-end mb-1">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(timestamp)}
            </span>
            <span className="font-semibold text-sm">You</span>
          </div>
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 text-sm">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Agent messages: left-aligned with avatar and markdown
  return (
    <div className="flex gap-3 group">
      <Avatar className="h-8 w-8 mt-0.5 shrink-0">
        <AvatarFallback className={cn(agent.bgColor, "text-white text-xs")}>
          {agent.name[0]}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 max-w-[85%]">
        <div className="flex items-baseline gap-2 mb-1">
          <span className={cn("font-semibold text-sm", agent.textColor)}>
            {agent.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(timestamp)}
          </span>
        </div>

        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-pre:my-2 prose-table:my-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
