"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWebSocket } from "@/hooks/use-websocket";
import {
  checkOrchestrationStatus,
  fetchChannelMessages,
  fetchDMMessages,
  fetchTeamStatus,
  sendChannelMessage,
  sendMessage,
  startDecomposition,
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

function statusEmoji(status: string): string {
  if (status === "active") {
    return "🟢";
  }
  if (status === "idle") {
    return "🟡";
  }
  return "⚫";
}

const LOAD_MORE_BATCH = 20;

interface ChatAreaProps {
  channel?: string;
  agent?: string;
  title: string;
}

// Individual command handlers extracted for lint complexity
function handleHelpCommand(): CommandResult {
  toast.info("Available Commands", {
    description:
      "/help - Show this help message\n" +
      "/status - Show team member status\n" +
      "/standup - Start a standup session (Alice → Bob → Charlie)\n" +
      "/orchestrate:decompose <task> - Decompose a task into issues\n" +
      "/orchestrate:status <epic-id> - Check progress on an epic",
    duration: 10_000,
  });
  return { command: "help", success: true, message: "Help displayed" };
}

async function handleStatusCommand(): Promise<CommandResult> {
  const { team } = await fetchTeamStatus();
  if (team.length === 0) {
    toast.info("Team Status", {
      description: "No status updates available.",
      duration: 8000,
    });
  } else {
    const statusLines = team.map((s) => {
      const emoji = statusEmoji(s.status);
      const working = s.working_on ? ` - ${s.working_on}` : "";
      return `${emoji} ${s.agent_id}: ${s.status}${working}`;
    });
    toast.info("Team Status", {
      description: statusLines.join("\n"),
      duration: 10_000,
    });
  }
  return { command: "status", success: true, message: "Status displayed" };
}

async function handleStandupCommand(target: string): Promise<CommandResult> {
  const toastId = toast.loading("Starting standup session...", {
    description: "Each agent will respond in sequence.",
  });
  const result = await startStandup(target);
  if (result.success) {
    toast.success("Standup initiated", {
      id: toastId,
      description: `Session ID: ${result.session_id}\nAgents will post updates: Alice, Bob, Charlie.`,
      duration: 10_000,
    });
  } else {
    toast.error("Standup failed", {
      id: toastId,
      description: result.error || "Unknown error",
      duration: 15_000,
    });
  }
  return { command: "standup", success: true, message: "Standup initiated" };
}

async function handleDecomposeCommand(
  target: string,
  args?: string
): Promise<CommandResult> {
  if (!args) {
    toast.warning("Missing argument", {
      description:
        "Usage: /orchestrate:decompose <task description>\n" +
        "Example: /orchestrate:decompose Build a calibration pipeline for sensor data",
      duration: 8000,
    });
    return {
      command: "orchestrate:decompose",
      success: false,
      message: "Missing task argument",
    };
  }
  const toastId = toast.loading("Starting task decomposition...", {
    description: "The orchestrator will break down your task.",
  });
  const result = await startDecomposition(args, target);
  if (result.success) {
    toast.success("Decomposition started", {
      id: toastId,
      description: `Session ID: ${result.session_id}\nUpdates will appear in #${result.channel || target}.`,
      duration: 10_000,
    });
  } else {
    toast.error("Decomposition failed", {
      id: toastId,
      description: result.error || "Unknown error",
      duration: 15_000,
    });
  }
  return {
    command: "orchestrate:decompose",
    success: true,
    message: "Decomposition initiated",
  };
}

async function handleOrchestrationStatusCommand(
  target: string,
  args?: string
): Promise<CommandResult> {
  if (!args) {
    toast.warning("Missing argument", {
      description:
        "Usage: /orchestrate:status <epic-id>\n" +
        "Example: /orchestrate:status team-abc123",
      duration: 8000,
    });
    return {
      command: "orchestrate:status",
      success: false,
      message: "Missing epic ID argument",
    };
  }
  const toastId = toast.loading("Checking epic progress...", {
    description: `Reviewing status of ${args}.`,
  });
  const result = await checkOrchestrationStatus(args, target);
  if (result.success) {
    toast.success("Status check started", {
      id: toastId,
      description: `Session ID: ${result.session_id}\nProgress report will appear in #${result.channel || target}.`,
      duration: 10_000,
    });
  } else {
    toast.error("Status check failed", {
      id: toastId,
      description: result.error || "Unknown error",
      duration: 15_000,
    });
  }
  return {
    command: "orchestrate:status",
    success: true,
    message: "Status check initiated",
  };
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
  const visibleMessages = useMemo(() => {
    const visibleOlder =
      effectiveShowOlderCount > 0 ? older.slice(-effectiveShowOlderCount) : [];
    return [...visibleOlder, ...recent];
  }, [older, recent, effectiveShowOlderCount]);

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

  // Reset older messages count when changing chats
  // biome-ignore lint/correctness/useExhaustiveDependencies: key is intentionally used to reset state when switching conversations
  useEffect(() => {
    setShowOlderCount(0);
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: key is intentionally used to re-attach scroll listener when switching conversations
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

  // Handle slash commands — dispatches to extracted handler functions
  const handleCommand = useCallback(
    async (command: SlashCommand, args?: string): Promise<CommandResult> => {
      const commandText = `/${command}${args ? ` ${args}` : ""}`;
      handleSend(commandText).catch(() => {
        /* fire-and-forget */
      });
      try {
        switch (command) {
          case "help":
            return handleHelpCommand();
          case "status":
            return await handleStatusCommand();
          case "standup":
            return await handleStandupCommand(target);
          case "orchestrate:decompose":
            return await handleDecomposeCommand(target, args);
          case "orchestrate:status":
            return await handleOrchestrationStatusCommand(target, args);
          default:
            return {
              command,
              success: false,
              message: `Unknown command: ${command}`,
            };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Command failed";
        toast.error("Command failed", {
          description: errorMsg,
          duration: 15_000,
        });
        return { command, success: false, message: errorMsg };
      }
    },
    [target, handleSend]
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

  // Scope typing indicator to current conversation
  const relevantAgents = agent
    ? activeAgents.filter((a) => a === agent)
    : activeAgents;

  function renderContent() {
    if (isLoading) {
      return (
        <div className="flex h-32 items-center justify-center">
          <span className="text-muted-foreground">Loading messages...</span>
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="flex h-32 items-center justify-center">
          <span className="text-muted-foreground">No messages yet</span>
        </div>
      );
    }

    return (
      <>
        <MessageList
          items={visibleMessages}
          olderMessageCount={remainingOlderCount}
          onLoadMore={handleLoadMore}
        />
        {relevantAgents.length > 0 && (
          <div className="mt-6">
            <TypingIndicator agents={relevantAgents} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="border-b px-6 py-3">
        <h2 className="font-semibold text-lg">{title}</h2>
      </div>

      <div className="relative min-h-0 flex-1">
        <ScrollToTopButton onClick={scrollToTop} visible={showScrollToTop} />
        <ScrollArea className="h-full px-6 py-4" ref={scrollRef}>
          {renderContent()}
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
