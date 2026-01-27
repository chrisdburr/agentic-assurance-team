"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAgent } from "@/lib/constants";
import { cn } from "@/lib/utils";

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <span
        className="h-2 w-2 animate-[typing-bounce_1.4s_ease-in-out_infinite] rounded-full bg-muted-foreground/60"
        style={{ animationDelay: "0s" }}
      />
      <span
        className="h-2 w-2 animate-[typing-bounce_1.4s_ease-in-out_infinite] rounded-full bg-muted-foreground/60"
        style={{ animationDelay: "0.2s" }}
      />
      <span
        className="h-2 w-2 animate-[typing-bounce_1.4s_ease-in-out_infinite] rounded-full bg-muted-foreground/60"
        style={{ animationDelay: "0.4s" }}
      />
    </div>
  );
}

interface TypingIndicatorProps {
  agents: string[];
}

export function TypingIndicator({ agents }: TypingIndicatorProps) {
  if (agents.length === 0) {
    return null;
  }

  // Show the first active agent
  const agentId = agents[0];
  const agent = getAgent(agentId);

  return (
    <div className="group fade-in slide-in-from-bottom-2 flex animate-in gap-3 duration-200">
      <Avatar className="mt-0.5 h-8 w-8 shrink-0">
        {agent.avatar && <AvatarImage alt={agent.name} src={agent.avatar} />}
        <AvatarFallback className={cn(agent.bgColor, "text-white text-xs")}>
          {agent.name[0]}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 max-w-[85%] flex-1">
        <div className="mb-1 flex items-baseline gap-2">
          <span className={cn("font-semibold text-sm", agent.textColor)}>
            {agent.name}
          </span>
          <span className="text-muted-foreground text-xs">typing...</span>
        </div>

        <div className="inline-block rounded-2xl rounded-tl-sm bg-muted">
          <TypingDots />
        </div>
      </div>
    </div>
  );
}
