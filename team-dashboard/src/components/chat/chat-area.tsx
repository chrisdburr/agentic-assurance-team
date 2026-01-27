"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchChannelMessages,
  fetchDMMessages,
  fetchTeamStatus,
  sendChannelMessage,
  sendMessage,
  startStandup,
} from "@/lib/api";
import { filterRecentMessages } from "@/lib/message-utils";
import type { ChannelMessage, DisplayMessage, Message } from "@/types";
import {
  type CommandResult,
  MessageInput,
  type SlashCommand,
} from "./message-input";
import { MessageList } from "./message-list";
import { ScrollToTopButton } from "./scroll-to-top-button";
import { SystemMessageItem } from "./system-message-item";
import { TypingIndicator } from "./typing-indicator";

// Convert DM Message to DisplayMessage
function normalizeMessage(m: Message): DisplayMessage {
  return {
    id: m.id,
    from: m.from_agent,
    content: m.content,
    timestamp: m.timestamp,
    thread_id: m.thread_id,
    mentions: m.mentions ? JSON.parse(m.mentions) : [],
  };
}

// Convert ChannelMessage to DisplayMessage
function normalizeChannelMessage(m: ChannelMessage): DisplayMessage {
  return {
    id: m.id,
    from: m.from,
    content: m.content,
    timestamp: m.timestamp,
    thread_id: m.thread_id,
    mentions: m.mentions,
  };
}

import { useWebSocket } from "@/hooks/use-websocket";

// System message type for slash command results
interface SystemMessage {
  id: string;
  type: "system";
  content: string;
  timestamp: string;
}

const LOAD_MORE_BATCH = 20;

interface ChatAreaProps {
  channel?: string;
  agent?: string;
  title: string;
}

async function fetcher(key: string): Promise<DisplayMessage[]> {
  const [type, id] = key.split(":");
  if (type === "channel") {
    const messages = await fetchChannelMessages(id);
    return messages.map(normalizeChannelMessage);
  }
  const messages = await fetchDMMessages(id);
  return messages.map(normalizeMessage);
}

export function ChatArea({ channel, agent, title }: ChatAreaProps) {
  const key = channel ? `channel:${channel}` : `dm:${agent}`;
  const target = channel || agent || "";

  // State for showing older messages
  const [showOlderCount, setShowOlderCount] = useState(0);

  // State for system messages (slash command results)
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);

  // Subscribe to WebSocket events
  const { lastMessage, isConnected, activeAgents } = useWebSocket();

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

  // If no recent messages but we have older ones, auto-show latest batch
  const effectiveShowOlderCount =
    recent.length === 0 && older.length > 0 && showOlderCount === 0
      ? Math.min(LOAD_MORE_BATCH, older.length)
      : showOlderCount;

  // Get visible older messages (from the end, most recent of the older)
  const visibleOlder =
    effectiveShowOlderCount > 0 ? older.slice(-effectiveShowOlderCount) : [];
  const visibleMessages = [...visibleOlder, ...recent];

  // Remaining older messages not yet loaded
  const remainingOlderCount = older.length - effectiveShowOlderCount;

  // Scroll management
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const isInitialLoad = useRef(true);
  const isNearBottomRef = useRef(true);

  // Get the actual scrollable viewport inside ScrollArea
  const getViewport = useCallback(() => {
    return scrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null;
  }, []);

  const scrollToBottom = useCallback(() => {
    const viewport = getViewport();
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [getViewport]);

  const scrollToTop = useCallback(() => {
    const viewport = getViewport();
    if (viewport) {
      viewport.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [getViewport]);

  // Reset older messages count and system messages when changing chats
  useEffect(() => {
    setShowOlderCount(0);
    setSystemMessages([]);
    isInitialLoad.current = true;
  }, [key]);

  // Auto-scroll to bottom on initial load and when messages change
  useEffect(() => {
    if (visibleMessages.length > 0) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (isInitialLoad.current) {
          scrollToBottom();
          isInitialLoad.current = false;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visibleMessages.length, scrollToBottom]);

  // Track scroll position for scroll-to-top button and auto-scroll
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) {
      return;
    }

    const handleScroll = () => {
      setShowScrollToTop(viewport.scrollTop > 200);
      // Track if user is near bottom for auto-scroll behavior
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      isNearBottomRef.current = distanceFromBottom < 100;
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [getViewport, key]);

  // Handle loading more older messages with scroll preservation
  const handleLoadMore = useCallback(() => {
    const viewport = getViewport();
    const currentVisible = effectiveShowOlderCount;

    if (!viewport) {
      setShowOlderCount(
        Math.min(currentVisible + LOAD_MORE_BATCH, older.length)
      );
      return;
    }

    const prevScrollHeight = viewport.scrollHeight;

    setShowOlderCount(Math.min(currentVisible + LOAD_MORE_BATCH, older.length));

    // Preserve scroll position after new content is rendered
    requestAnimationFrame(() => {
      const heightDiff = viewport.scrollHeight - prevScrollHeight;
      viewport.scrollTop += heightDiff;
    });
  }, [getViewport, older.length, effectiveShowOlderCount]);

  // Optimistic send handler
  const handleSend = useCallback(
    async (content: string) => {
      // Create optimistic message
      const optimisticMessage: DisplayMessage = {
        id: `temp-${Date.now()}`,
        from: "user",
        content,
        thread_id: null,
        timestamp: new Date().toISOString(),
        mentions: [],
      };

      // Immediately add to UI (optimistic update)
      mutate([...messages, optimisticMessage], { revalidate: false });

      // Always scroll to bottom when user sends a message
      setTimeout(() => scrollToBottom(), 50);

      try {
        // Send to appropriate API based on channel vs DM
        if (channel) {
          await sendChannelMessage(target, content);
        } else {
          await sendMessage(target, content);
        }
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
    [target, channel, messages, mutate, scrollToBottom]
  );

  // Handle slash commands
  const handleCommand = useCallback(
    async (command: SlashCommand): Promise<CommandResult> => {
      const addSystemMessage = (content: string) => {
        const sysMsg: SystemMessage = {
          id: `sys-${Date.now()}`,
          type: "system",
          content,
          timestamp: new Date().toISOString(),
        };
        setSystemMessages((prev) => [...prev, sysMsg]);
      };

      try {
        switch (command) {
          case "help": {
            addSystemMessage(
              "**Available Commands:**\n" +
                "- `/help` - Show this help message\n" +
                "- `/status` - Show team member status\n" +
                "- `/standup` - Start a standup session (Alice → Bob → Charlie)"
            );
            return { command, success: true, message: "Help displayed" };
          }

          case "status": {
            const { team } = await fetchTeamStatus();
            if (team.length === 0) {
              addSystemMessage("**Team Status:** No status updates available.");
            } else {
              const statusLines = team.map((s) => {
                const status =
                  s.status === "active"
                    ? "🟢"
                    : s.status === "idle"
                      ? "🟡"
                      : "⚫";
                const working = s.working_on ? ` - ${s.working_on}` : "";
                return `${status} **${s.agent_id}**: ${s.status}${working}`;
              });
              addSystemMessage("**Team Status:**\n" + statusLines.join("\n"));
            }
            return { command, success: true, message: "Status displayed" };
          }

          case "standup": {
            addSystemMessage(
              "**Starting standup session...** Each agent will respond in sequence. Watch the channel for updates."
            );
            const result = await startStandup();
            if (result.success) {
              addSystemMessage(
                `**Standup initiated.** Session ID: \`${result.session_id}\`\n\nAgents will post their updates to the channel: Alice, then Bob, then Charlie.`
              );
            } else {
              addSystemMessage(
                `**Standup failed:** ${result.error || "Unknown error"}`
              );
            }
            return { command, success: true, message: "Standup initiated" };
          }

          default:
            return {
              command,
              success: false,
              message: `Unknown command: ${command}`,
            };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Command failed";
        addSystemMessage(`**Error:** ${errorMsg}`);
        return { command, success: false, message: errorMsg };
      }
    },
    []
  );

  // Refresh when we get a new WebSocket message and auto-scroll if near bottom
  useEffect(() => {
    if (
      lastMessage?.type === "message" ||
      lastMessage?.type === "channel_message"
    ) {
      mutate();
      // Auto-scroll to bottom if user was already near bottom
      if (isNearBottomRef.current) {
        setTimeout(() => scrollToBottom(), 50);
      }
    }
  }, [lastMessage, mutate, scrollToBottom]);

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="border-b px-6 py-3">
        <h2 className="font-semibold text-lg">{title}</h2>
      </div>

      <div className="relative min-h-0 flex-1">
        <ScrollToTopButton onClick={scrollToTop} visible={showScrollToTop} />
        <ScrollArea className="h-full px-6 py-4" ref={scrollRef}>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <span className="text-muted-foreground">Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <span className="text-muted-foreground">No messages yet</span>
            </div>
          ) : (
            <>
              <MessageList
                messages={visibleMessages}
                olderMessageCount={remainingOlderCount}
                onLoadMore={handleLoadMore}
              />
              {systemMessages.map((sysMsg) => (
                <div className="mt-4" key={sysMsg.id}>
                  <SystemMessageItem
                    content={sysMsg.content}
                    timestamp={sysMsg.timestamp}
                  />
                </div>
              ))}
              {activeAgents.length > 0 && (
                <div className="mt-6">
                  <TypingIndicator agents={activeAgents} />
                </div>
              )}
            </>
          )}
        </ScrollArea>
      </div>

      <MessageInput
        agent={agent}
        channel={channel}
        onCommand={handleCommand}
        onSend={handleSend}
      />
    </div>
  );
}
