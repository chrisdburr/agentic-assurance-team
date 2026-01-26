"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { WSEvent } from "@/types";

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: WSEvent | null;
  activeAgents: string[];
}

export const WebSocketContext = createContext<WebSocketContextType | null>(
  null
);

interface Props {
  children: ReactNode;
}

export function WebSocketProvider({ children }: Props) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSEvent | null>(null);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Use configured WebSocket URL or fall back to same-origin /ws
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ||
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WS] Connected");
        setIsConnected(true);
        setLastMessage({ type: "connected" });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WSEvent;
          console.log("[WS] Message:", data);
          setLastMessage(data);

          // Track active agents
          if (data.type === "agent_triggered" && data.data) {
            const agentData = data.data as { agent?: string };
            if (agentData.agent) {
              setActiveAgents((prev) =>
                prev.includes(agentData.agent!)
                  ? prev
                  : [...prev, agentData.agent!]
              );
            }
          } else if (data.type === "agent_session_ended" && data.data) {
            const agentData = data.data as { agent?: string };
            if (agentData.agent) {
              setActiveAgents((prev) =>
                prev.filter((a) => a !== agentData.agent)
              );
            }
          }
        } catch (e) {
          console.error("[WS] Parse error:", e);
        }
      };

      ws.onclose = () => {
        console.log("[WS] Disconnected");
        setIsConnected(false);
        wsRef.current = null;

        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("[WS] Reconnecting...");
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error("[WS] Error:", error);
        setLastMessage({ type: "error", data: error });
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[WS] Connection error:", error);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage, activeAgents }}>
      {children}
    </WebSocketContext.Provider>
  );
}
