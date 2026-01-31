"use client";

import type { TimelineItem } from "@/types";
import { LoadMoreButton } from "./load-more-button";
import { MessageItem } from "./message-item";
import { SystemMessageItem } from "./system-message-item";

interface MessageListProps {
  items: TimelineItem[];
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
      {items.map((item) =>
        item.kind === "message" ? (
          <MessageItem key={item.data.id} message={item.data} />
        ) : (
          <SystemMessageItem
            content={item.data.content}
            fading={item.data.fading}
            key={item.data.id}
            timestamp={item.data.timestamp}
          />
        )
      )}
    </div>
  );
}
