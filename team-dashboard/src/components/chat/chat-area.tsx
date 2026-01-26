"use client";

import { useEffect, useCallback, useState } from "react";
import useSWR from "swr";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { ScrollToTopButton } from "./scroll-to-top-button";
import { fetchChannelMessages, fetchDMMessages, sendMessage } from "@/lib/api";
import { filterRecentMessages } from "@/lib/message-utils";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import type { Message } from "@/types";
import { useWebSocket } from "@/hooks/use-websocket";

const LOAD_MORE_BATCH = 20;

interface ChatAreaProps {
  channel?: string;
  agent?: string;
  title: string;
}

async function fetcher(key: string): Promise<Message[]> {
  const [type, id] = key.split(":");
  if (type === "channel") {
    return fetchChannelMessages(id);
  } else {
    return fetchDMMessages(id);
  }
}

export function ChatArea({ channel, agent, title }: ChatAreaProps) {
  const key = channel ? `channel:${channel}` : `dm:${agent}`;
  const target = channel || agent || "";

  // State for showing older messages
  const [showOlderCount, setShowOlderCount] = useState(0);

  // Subscribe to WebSocket events
  const { lastMessage, isConnected } = useWebSocket();

  // Use polling fallback (5s) when WebSocket is disconnected
  const {
    data: messages = [],
    mutate,
    isLoading,
  } = useSWR(key, fetcher, {
    refreshInterval: isConnected ? 0 : 5000,
    revalidateOnFocus: true,
  });

  // Filter messages into recent and older
  const { recent, older } = filterRecentMessages(messages);

  // Get visible older messages (from the end, most recent of the older)
  const visibleOlder = showOlderCount > 0 ? older.slice(-showOlderCount) : [];
  const visibleMessages = [...visibleOlder, ...recent];

  // Remaining older messages not yet loaded
  const remainingOlderCount = older.length - showOlderCount;

  // Chat scroll management
  const { showScrollToTop, scrollToTop, getViewport } = useChatScroll({
    chatKey: key,
    messageCount: visibleMessages.length,
  });

  // Reset older messages count when changing chats
  useEffect(() => {
    setShowOlderCount(0);
  }, [key]);

  // Handle loading more older messages with scroll preservation
  const handleLoadMore = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) {
      setShowOlderCount((prev) => Math.min(prev + LOAD_MORE_BATCH, older.length));
      return;
    }

    const prevScrollHeight = viewport.scrollHeight;

    setShowOlderCount((prev) => Math.min(prev + LOAD_MORE_BATCH, older.length));

    // Preserve scroll position after new content is rendered
    requestAnimationFrame(() => {
      const heightDiff = viewport.scrollHeight - prevScrollHeight;
      viewport.scrollTop += heightDiff;
    });
  }, [getViewport, older.length]);

  // Optimistic send handler
  const handleSend = useCallback(
    async (content: string) => {
      // Create optimistic message
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        from_agent: "user",
        to_agent: target,
        content,
        thread_id: `temp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        read_by: "[]",
      };

      // Immediately add to UI (optimistic update)
      mutate([...messages, optimisticMessage], { revalidate: false });

      try {
        // Send to server
        await sendMessage(target, content);
        // Revalidate to get the real message with server-assigned ID
        mutate();
      } catch (error) {
        // Remove optimistic message on error
        mutate(
          messages.filter((m) => m.id !== optimisticMessage.id),
          { revalidate: false }
        );
        throw error; // Re-throw so MessageInput can show error
      }
    },
    [target, messages, mutate]
  );

  // Refresh when we get a new WebSocket message
  useEffect(() => {
    if (lastMessage?.type === "message") {
      mutate();
    }
  }, [lastMessage, mutate]);

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="border-b px-6 py-3">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      <div className="relative flex-1">
        <ScrollToTopButton onClick={scrollToTop} visible={showScrollToTop} />
        <ScrollArea className="absolute inset-0 px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-muted-foreground">Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-muted-foreground">No messages yet</span>
            </div>
          ) : (
            <MessageList
              messages={visibleMessages}
              olderMessageCount={remainingOlderCount}
              onLoadMore={handleLoadMore}
            />
          )}
        </ScrollArea>
      </div>

      <MessageInput channel={channel} agent={agent} onSend={handleSend} />
    </div>
  );
}
