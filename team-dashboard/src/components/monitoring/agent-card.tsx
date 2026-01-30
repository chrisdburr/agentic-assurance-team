"use client";

import { Activity, Clock, Play, RefreshCw, Zap } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { refreshAgentSession, triggerAgent } from "@/lib/api";
import { getAgent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AgentMonitoringData } from "@/types";
import { HealthIndicator } from "./health-indicator";

interface AgentCardProps {
  agentId: string;
  data: AgentMonitoringData;
  onTrigger?: () => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export function AgentCard({ agentId, data, onTrigger }: AgentCardProps) {
  const [isTriggering, setIsTriggering] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agent = getAgent(agentId);

  const handleTrigger = async () => {
    setIsTriggering(true);
    setError(null);
    try {
      await triggerAgent(agentId);
      onTrigger?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to trigger");
    } finally {
      setIsTriggering(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      await refreshAgentSession(agentId);
      onTrigger?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh session");
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusBadge = () => {
    if (data.active) {
      return (
        <Badge className="bg-blue-500" variant="default">
          Active
        </Badge>
      );
    }
    if (data.cooldownRemainingMs && data.cooldownRemainingMs > 0) {
      return <Badge variant="secondary">Cooldown</Badge>;
    }
    return (
      <Badge className="text-muted-foreground" variant="outline">
        Idle
      </Badge>
    );
  };

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar size="lg">
                {agent.avatar && (
                  <AvatarImage alt={agent.name} src={agent.avatar} />
                )}
                <AvatarFallback className={cn(agent.bgColor, "text-white")}>
                  {agent.name[0]}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -right-0.5 -bottom-0.5">
                <HealthIndicator size="md" status={data.health} />
              </span>
            </div>
            <div>
              <CardTitle className="text-lg">{agent.name}</CardTitle>
              <div className="mt-1 flex items-center gap-2">
                {getStatusBadge()}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Zap className="h-4 w-4" />
            <span>Triggers: {data.triggerCount}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {data.lastTrigger
                ? formatRelativeTime(data.lastTrigger)
                : "Never"}
            </span>
          </div>
        </div>

        {/* Active duration or cooldown */}
        {data.active && data.activeForMs !== null && (
          <div className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-blue-500" />
            <span>Running for {formatDuration(data.activeForMs)}</span>
          </div>
        )}
        {data.cooldownRemainingMs !== null && data.cooldownRemainingMs > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Clock className="h-4 w-4" />
            <span>Cooldown: {formatDuration(data.cooldownRemainingMs)}</span>
          </div>
        )}

        {/* Last exit code if non-zero */}
        {data.lastExitCode !== null && data.lastExitCode !== 0 && (
          <div className="text-red-500 text-sm">
            Last exit code: {data.lastExitCode}
          </div>
        )}

        {/* Error message */}
        {error && <div className="text-red-500 text-sm">{error}</div>}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={isTriggering || data.active}
            onClick={handleTrigger}
            variant={data.active ? "secondary" : "default"}
          >
            <Play className="mr-2 h-4 w-4" />
            {isTriggering
              ? "Triggering..."
              : data.active
                ? "Running"
                : "Trigger"}
          </Button>
          <Button
            disabled={isRefreshing || data.active}
            onClick={handleRefresh}
            size="icon"
            title="Refresh session"
            variant="outline"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
