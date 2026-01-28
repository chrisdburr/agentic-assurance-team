"use client";

import { Bot, Check, Copy } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAgent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";

interface AgentDetailDialogProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentDetailDialog({
  agent,
  open,
  onOpenChange,
}: AgentDetailDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!agent) {
    return null;
  }

  const displayInfo = getAgent(agent.id);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(agent.system_prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar>
              {displayInfo.avatar && (
                <AvatarImage alt={agent.name} src={displayInfo.avatar} />
              )}
              <AvatarFallback
                className={cn(
                  displayInfo.bgColor,
                  "text-white",
                  !agent.is_team_agent && "bg-muted-foreground"
                )}
              >
                {agent.is_team_agent ? (
                  agent.name[0].toUpperCase()
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="capitalize">{agent.name}</DialogTitle>
              <DialogDescription>{agent.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Model: {agent.model}</Badge>
            {agent.is_team_agent && (
              <Badge variant="secondary">Team Agent</Badge>
            )}
            {agent.allowed_tools && agent.allowed_tools.length > 0 && (
              <Badge variant="outline">
                {agent.allowed_tools.length} tools
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">System Prompt</h4>
              <Button onClick={handleCopy} size="sm" variant="ghost">
                {copied ? (
                  <Check className="mr-1 h-4 w-4" />
                ) : (
                  <Copy className="mr-1 h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <ScrollArea className="h-[300px] rounded-md border bg-muted/50 p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {agent.system_prompt}
              </pre>
            </ScrollArea>
          </div>

          {agent.allowed_tools && agent.allowed_tools.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Allowed Tools</h4>
              <div className="flex flex-wrap gap-1">
                {agent.allowed_tools.map((tool) => (
                  <Badge
                    className="font-mono text-xs"
                    key={tool}
                    variant="outline"
                  >
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
