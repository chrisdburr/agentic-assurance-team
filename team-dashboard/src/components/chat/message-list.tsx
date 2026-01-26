"use client";

import type { DisplayMessage } from "@/types";
import { MessageItem } from "./message-item";
import { LoadMoreButton } from "./load-more-button";

interface MessageListProps {
  messages: DisplayMessage[];
  olderMessageCount?: number;
  onLoadMore?: () => void;
}

export function MessageList({
  messages,
  olderMessageCount = 0,
  onLoadMore,
}: MessageListProps) {
  return (
    <div className="space-y-6">
      {olderMessageCount > 0 && onLoadMore && (
        <LoadMoreButton olderCount={olderMessageCount} onClick={onLoadMore} />
      )}
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}
