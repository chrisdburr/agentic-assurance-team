"use client";

import {
  Activity,
  AlertCircle,
  MessageSquare,
  Play,
  Square,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useWebSocket } from "@/hooks/use-websocket";
import { fetchEvents } from "@/lib/api";
import { getAgent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { SessionEvent } from "@/types";

/** Important event types shown by default */
const IMPORTANT_EVENT_TYPES = [
  "SessionStart",
  "Stop",
  "SessionEnd",
  "PostToolUseFailure",
  "UserPromptSubmit",
];

function eventKey(e: SessionEvent): string {
  return `${e.timestamp}-${e.agent}-${e.event}-${e.session_id}`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function EventIcon({ event }: { event: string }) {
  switch (event) {
    case "SessionStart":
      return <Play className="h-4 w-4 text-green-500" />;
    case "Stop":
    case "SessionEnd":
      return <Square className="h-4 w-4 text-blue-500" />;
    case "PostToolUseFailure":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "PreToolUse":
    case "PostToolUse":
      return <Wrench className="h-4 w-4 text-amber-500" />;
    case "UserPromptSubmit":
      return <MessageSquare className="h-4 w-4 text-purple-500" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
}

function getEventMessage(event: SessionEvent): string {
  const agentName = getAgent(event.agent).name;
  switch (event.event) {
    case "SessionStart":
      return `${agentName} session started`;
    case "Stop":
    case "SessionEnd":
      return `${agentName} session ended`;
    case "PostToolUseFailure":
      return `${agentName} tool failed${event.tool_name ? `: ${event.tool_name}` : ""}`;
    case "PreToolUse":
      return `${agentName} using ${event.tool_name || "tool"}`;
    case "PostToolUse":
      return `${agentName} finished ${event.tool_name || "tool"}`;
    case "UserPromptSubmit":
      return `${agentName} received prompt`;
    default:
      return `${agentName}: ${event.event}`;
  }
}

export function EventsLog() {
  const { lastMessage } = useWebSocket();
  const [showAll, setShowAll] = useState(false);
  const [wsEvents, setWsEvents] = useState<SessionEvent[]>([]);

  // SWR fetches historical events with 15s refresh
  const swrParams = useMemo(
    () =>
      showAll
        ? { limit: 50 }
        : { limit: 50, event_types: IMPORTANT_EVENT_TYPES },
    [showAll]
  );

  const { data, error, isLoading, mutate } = useSWR(
    ["events", showAll],
    () => fetchEvents(swrParams),
    {
      refreshInterval: 15_000,
    }
  );

  // Clear WS buffer when SWR refreshes (they'll be included in the API response)
  useEffect(() => {
    if (data) {
      setWsEvents([]);
    }
  }, [data]);

  // Handle real-time WebSocket events
  const handleWsMessage = useCallback(
    (msg: typeof lastMessage) => {
      if (!msg) {
        return;
      }

      // Map dispatcher WebSocket events to SessionEvent shape
      if (
        msg.type === "agent_triggered" ||
        msg.type === "agent_session_ended" ||
        msg.type === "agent_trigger_failed"
      ) {
        const d = msg.data as {
          agent?: string;
          timestamp?: string;
          error?: string;
        };
        if (!d?.agent) {
          return;
        }

        let eventType: string;
        if (msg.type === "agent_triggered") {
          eventType = "SessionStart";
        } else if (msg.type === "agent_session_ended") {
          eventType = "Stop";
        } else {
          eventType = "PostToolUseFailure";
        }

        const mapped: SessionEvent = {
          timestamp: d.timestamp || new Date().toISOString(),
          event: eventType,
          agent: d.agent,
          session_id: "",
          error: d.error,
        };

        // Apply filter
        if (!(showAll || IMPORTANT_EVENT_TYPES.includes(mapped.event))) {
          return;
        }

        setWsEvents((prev) => [mapped, ...prev].slice(0, 20));
      }
    },
    [showAll]
  );

  useEffect(() => {
    handleWsMessage(lastMessage);
  }, [lastMessage, handleWsMessage]);

  // Merge and deduplicate: WS events first, then SWR data
  const events = useMemo(() => {
    const apiEvents = data?.events ?? [];
    const all = [...wsEvents, ...apiEvents];

    // Deduplicate by composite key
    const seen = new Set<string>();
    const unique: SessionEvent[] = [];
    for (const e of all) {
      const k = eventKey(e);
      if (!seen.has(k)) {
        seen.add(k);
        unique.push(e);
      }
    }

    // Sort descending by timestamp
    unique.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return unique.slice(0, 50);
  }, [wsEvents, data]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {["a", "b", "c", "d"].map((id) => (
          <div
            className="flex items-start gap-3 rounded-md bg-muted/50 p-2"
            key={id}
          >
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <AlertCircle className="mb-2 h-8 w-8 text-red-500 opacity-50" />
        <p className="text-sm">Failed to load events</p>
        <button
          className="mt-2 text-xs underline hover:text-foreground"
          onClick={() => mutate()}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          {events.length} event{events.length !== 1 ? "s" : ""}
          {data?.total && data.total > events.length ? ` of ${data.total}` : ""}
        </p>
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <span>Show all events</span>
          <Switch
            checked={showAll}
            id="show-all-events"
            onCheckedChange={setShowAll}
          />
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Activity className="mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">No recent events</p>
          <p className="text-xs">
            Events will appear here when agents are active
          </p>
        </div>
      ) : (
        <ScrollArea className="h-64">
          <div className="space-y-2 pr-4">
            {events.map((event) => {
              const agent = getAgent(event.agent);
              return (
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-md p-2",
                    "bg-muted/50 transition-colors hover:bg-muted/80"
                  )}
                  key={eventKey(event)}
                >
                  <EventIcon event={event.event} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{getEventMessage(event)}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatTime(event.timestamp)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      agent.bgColor
                    )}
                  />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
