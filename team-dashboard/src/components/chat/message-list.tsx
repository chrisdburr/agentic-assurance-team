"use client";

import type { DisplayMessage } from "@/types";
import { LoadMoreButton } from "./load-more-button";
import { MessageItem } from "./message-item";

interface MessageListProps {
  items: DisplayMessage[];
  olderMessageCount?: number;
  onLoadMore?: () => void;
}

export function MessageList({
  items,
  olderMessageCount = 0,
  onLoadMore,
}: MessageListProps) {
  return (
    <div className="space-y-6">
      {olderMessageCount > 0 && onLoadMore && (
        <LoadMoreButton olderCount={olderMessageCount} onClick={onLoadMore} />
      )}
      {items.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}
