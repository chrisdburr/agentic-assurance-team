"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDistanceToNow } from "@/lib/date";

interface SystemMessageItemProps {
  content: string;
  timestamp: string;
}

export function SystemMessageItem({
  content,
  timestamp,
}: SystemMessageItemProps) {
  const time = new Date(timestamp);

  return (
    <div className="flex justify-center">
      <div className="max-w-[90%] w-full">
        <div className="flex items-center gap-2 mb-1 justify-center">
          <span className="text-xs text-muted-foreground">
            System - {formatDistanceToNow(time)}
          </span>
        </div>
        <div className="bg-muted/50 border border-border rounded-lg px-4 py-3">
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-pre:my-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
