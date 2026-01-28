"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { fetchAgents } from "@/lib/api";
import type { Agent } from "@/types";
import { AgentDetailDialog } from "./agent-detail-dialog";
import { AgentLibraryCard } from "./agent-library-card";
import { CreateAgentDialog } from "./create-agent-dialog";

export function AgentsLibrary() {
  const {
    data: agents,
    error,
    isLoading,
    mutate,
  } = useSWR<Agent[]>("agents", fetchAgents, {
    refreshInterval: 30_000,
  });

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const handleAgentClick = (agent: Agent) => {
    setSelectedAgent(agent);
    setDetailDialogOpen(true);
  };

  const handleAgentCreated = () => {
    mutate();
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive">
          Failed to load agents: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl">Agents</h1>
          <p className="text-muted-foreground">
            View and manage your AI agents
          </p>
        </div>
        <CreateAgentDialog onAgentCreated={handleAgentCreated} />
      </div>

      {agents && agents.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">
            No agents found. Create your first agent to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents?.map((agent) => (
            <AgentLibraryCard
              agent={agent}
              key={agent.id}
              onClick={() => handleAgentClick(agent)}
            />
          ))}
        </div>
      )}

      <AgentDetailDialog
        agent={selectedAgent}
        onOpenChange={setDetailDialogOpen}
        open={detailDialogOpen}
      />
    </div>
  );
}
