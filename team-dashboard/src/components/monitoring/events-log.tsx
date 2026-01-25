"use client";

import { useEffect, useState } from "react";
import { Activity, Play, Square, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWebSocket } from "@/hooks/use-websocket";
import { getAgent } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface AgentEvent {
  id: string;
  type: "triggered" | "ended" | "failed";
  agent: string;
  timestamp: string;
  exitCode?: number;
  error?: string;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function EventIcon({ type }: { type: AgentEvent["type"] }) {
  switch (type) {
    case "triggered":
      return <Play className="h-4 w-4 text-green-500" />;
    case "ended":
      return <Square className="h-4 w-4 text-blue-500" />;
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
}

export function EventsLog() {
  const { lastMessage } = useWebSocket();
  const [events, setEvents] = useState<AgentEvent[]>([]);

  useEffect(() => {
    if (!lastMessage) return;

    // Handle agent events
    if (
      lastMessage.type === "agent_triggered" ||
      lastMessage.type === "agent_session_ended" ||
      lastMessage.type === "agent_trigger_failed"
    ) {
      const data = lastMessage.data as {
        agent?: string;
        timestamp?: string;
        exitCode?: number;
        error?: string;
      };

      if (data?.agent) {
        const eventType =
          lastMessage.type === "agent_triggered"
            ? "triggered"
            : lastMessage.type === "agent_session_ended"
              ? "ended"
              : "failed";

        const newEvent: AgentEvent = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: eventType,
          agent: data.agent,
          timestamp: data.timestamp || new Date().toISOString(),
          exitCode: data.exitCode,
          error: data.error,
        };

        // Prepend new event and keep last 20
        setEvents((prev) => [newEvent, ...prev].slice(0, 20));
      }
    }
  }, [lastMessage]);

  const getEventMessage = (event: AgentEvent): string => {
    const agentName = getAgent(event.agent).name;
    switch (event.type) {
      case "triggered":
        return `${agentName} started`;
      case "ended":
        return event.exitCode === 0
          ? `${agentName} finished`
          : `${agentName} exited (code ${event.exitCode})`;
      case "failed":
        return `${agentName} failed: ${event.error || "Unknown error"}`;
      default:
        return `${agentName} event`;
    }
  };

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <Activity className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No recent events</p>
        <p className="text-xs">Events will appear here when agents are triggered</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-64">
      <div className="space-y-2 pr-4">
        {events.map((event) => {
          const agent = getAgent(event.agent);
          return (
            <div
              key={event.id}
              className={cn(
                "flex items-start gap-3 p-2 rounded-md",
                "bg-muted/50 hover:bg-muted/80 transition-colors"
              )}
            >
              <EventIcon type={event.type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm">{getEventMessage(event)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(event.timestamp)}
                </p>
              </div>
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0 mt-1.5",
                  agent.bgColor
                )}
              />
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
