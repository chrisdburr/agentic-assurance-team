"use client";

import { Bot } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAgent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";

interface AgentLibraryCardProps {
  agent: Agent;
  onClick: () => void;
}

export function AgentLibraryCard({ agent, onClick }: AgentLibraryCardProps) {
  // Try to get display info from constants (for team agents)
  const displayInfo = getAgent(agent.id);

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <Avatar>
            {displayInfo.avatar && (
              <AvatarImage alt={agent.name} src={displayInfo.avatar} />
            )}
            <AvatarFallback
              className={cn(
                displayInfo.bgColor,
                "text-white",
                agent.is_system && "bg-muted-foreground"
              )}
            >
              {agent.is_system ? (
                <Bot className="h-4 w-4" />
              ) : (
                agent.name[0].toUpperCase()
              )}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base capitalize">
              {agent.name}
            </CardTitle>
            <div className="mt-1 flex items-center gap-2">
              <Badge className="text-xs" variant="outline">
                {agent.model}
              </Badge>
              {agent.is_system && (
                <Badge className="text-xs" variant="secondary">
                  System
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-2 text-muted-foreground text-sm">
          {agent.description}
        </p>
      </CardContent>
    </Card>
  );
}
