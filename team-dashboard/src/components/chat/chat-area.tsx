"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { fetchChannelMessages, fetchDMMessages } from "@/lib/api";
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

  const { data: messages = [], mutate, isLoading } = useSWR(key, fetcher, {
    refreshInterval: 0, // We'll use WebSocket for updates
    revalidateOnFocus: false,
  });

  // Subscribe to WebSocket events
  const { lastMessage } = useWebSocket();

  // Refresh when we get a new message
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

      <MessageInput channel={channel} agent={agent} />
    </div>
  );
}
