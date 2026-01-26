"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAgent } from "@/lib/constants";
import type { DisplayMessage } from "@/types";
import { formatDistanceToNow } from "@/lib/date";
import { cn } from "@/lib/utils";

// Parse @mentions in text and return React elements with highlighting
function renderWithMentions(text: string): React.ReactNode {
  const mentionRegex = /@(alice|bob|charlie|team)\b/gi;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  // Reset regex state
  mentionRegex.lastIndex = 0;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add the styled mention
    const mention = match[0];
    parts.push(
      <span
        key={`${match.index}-${mention}`}
        className="text-blue-600 dark:text-blue-400 font-semibold"
      >
        {mention}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last mention
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

interface MessageItemProps {
  message: DisplayMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  const agent = getAgent(message.from);
  const timestamp = new Date(message.timestamp);
  const isUser = message.from === "user";

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
            {renderWithMentions(message.content)}
          </div>
        </div>
      </div>
    );
  }

  // Agent messages: left-aligned with avatar and markdown
  return (
    <div className="flex gap-3 group">
      <Avatar className="h-8 w-8 mt-0.5 shrink-0">
        {agent.avatar && <AvatarImage src={agent.avatar} alt={agent.name} />}
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
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Custom text renderer to highlight @mentions
                text: ({ children }) => {
                  if (typeof children === "string") {
                    return <>{renderWithMentions(children)}</>;
                  }
                  return <>{children}</>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
