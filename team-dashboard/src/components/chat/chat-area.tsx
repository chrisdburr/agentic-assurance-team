"use client";

import { useEffect, useRef, useCallback } from "react";
import useSWR from "swr";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { fetchChannelMessages, fetchDMMessages, sendMessage } from "@/lib/api";
import type { Message } from "@/types";
import { useWebSocket } from "@/hooks/use-websocket";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const key = channel ? `channel:${channel}` : `dm:${agent}`;
  const target = channel || agent || "";

  // Subscribe to WebSocket events
  const { lastMessage, isConnected } = useWebSocket();

  // Use polling fallback (5s) when WebSocket is disconnected
  const { data: messages = [], mutate, isLoading } = useSWR(key, fetcher, {
    refreshInterval: isConnected ? 0 : 5000,
    revalidateOnFocus: true,
  });

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
        mutate(messages.filter((m) => m.id !== optimisticMessage.id), {
          revalidate: false,
        });
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="border-b px-4 py-2">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-muted-foreground">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-muted-foreground">No messages yet</span>
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
      </ScrollArea>

      <MessageInput channel={channel} agent={agent} onSend={handleSend} />
    </div>
  );
}
