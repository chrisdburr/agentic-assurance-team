"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDistanceToNow } from "@/lib/date";
import { cn } from "@/lib/utils";

interface SystemMessageItemProps {
  content: string;
  timestamp: string;
  fading?: boolean;
}

export function SystemMessageItem({
  content,
  timestamp,
  fading,
}: SystemMessageItemProps) {
  const time = new Date(timestamp);

  return (
    <div
      className={cn(
        "flex justify-center transition-opacity duration-500",
        fading ? "opacity-0" : "opacity-100"
      )}
    >
      <div className="w-full max-w-[90%]">
        <div className="mb-1 flex items-center justify-center gap-2">
          <span className="text-muted-foreground text-xs">
            System - {formatDistanceToNow(time)}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
          <div className="prose prose-sm dark:prose-invert prose-headings:my-3 prose-li:my-0 prose-ol:my-2 prose-p:my-2 prose-pre:my-2 prose-ul:my-2 max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
