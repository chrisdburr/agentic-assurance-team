"use client";

import { Clock, Power, PowerOff, RefreshCw, Timer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWebSocket } from "@/hooks/use-websocket";
import { fetchMonitoringData } from "@/lib/api";
import type { MonitoringData } from "@/types";
import { AgentCard } from "./agent-card";
import { EventsLog } from "./events-log";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function MonitoringDashboard() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lastMessage, isConnected } = useWebSocket();

  const loadData = useCallback(async () => {
    try {
      const result = await fetchMonitoringData();
      setData(result);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load monitoring data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh on WebSocket events
  useEffect(() => {
    if (
      lastMessage?.type === "agent_triggered" ||
      lastMessage?.type === "agent_session_ended" ||
      lastMessage?.type === "agent_trigger_failed" ||
      lastMessage?.type === "session_refreshed"
    ) {
      loadData();
    }
  }, [lastMessage, loadData]);

  // Auto-refresh every 5 seconds when agents are active
  useEffect(() => {
    if (!data) return;

    const hasActiveAgents = Object.values(data.agents).some((a) => a.active);
    if (!hasActiveAgents) return;

    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [data, loadData]);

  if (loading) {
    return (
      <div className="space-y-6 overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton className="h-64" key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-500/50">
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
            <Button className="mt-4" onClick={loadData}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const agents = Object.entries(data.agents);

  return (
    <div className="space-y-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl">Agent Monitoring</h1>
          <p className="text-muted-foreground text-sm">
            Monitor agent health, status, and trigger sessions manually
          </p>
        </div>
        <Button onClick={loadData} size="icon" variant="outline">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Dispatcher Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Dispatcher Status</CardTitle>
            {data.enabled ? (
              <Badge className="bg-green-500">
                <Power className="mr-1 h-3 w-3" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="secondary">
                <PowerOff className="mr-1 h-3 w-3" />
                Disabled
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Timer className="h-4 w-4" />
              <span>Poll Interval: {formatMs(data.pollInterval)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Cooldown: {formatMs(data.cooldown)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-muted-foreground">
                WebSocket: {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {agents.map(([agentId, agentData]) => (
          <AgentCard
            agentId={agentId}
            data={agentData}
            key={agentId}
            onTrigger={loadData}
          />
        ))}
      </div>

      {/* Events Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <EventsLog />
        </CardContent>
      </Card>
    </div>
  );
}
