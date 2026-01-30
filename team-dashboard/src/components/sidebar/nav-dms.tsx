"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getAgent } from "@/lib/constants";
import type { Agent } from "@/types";

interface NavDMsProps {
  activeAgents?: string[];
  unreadCounts?: Record<string, number>;
}

const STORAGE_KEY = "sidebar-dms-open";
const SYSTEM_AGENT_IDS = ["alice", "bob", "charlie"];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function NavDMs({ activeAgents = [], unreadCounts = {} }: NavDMsProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === "true" : true;
  });
  const { data, error, isLoading } = useSWR<{ agents: Agent[] }>(
    "/api/backend/agents",
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
    }
  );

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(open));
  }, [open]);

  // Filter out non-core system agents (e.g. code-review, team-app-assistant)
  // Sort: core agents first (in fixed order), then user agents alphabetically
  const agents = (data?.agents ?? [])
    .filter((a) => !a.is_system || SYSTEM_AGENT_IDS.includes(a.id))
    .sort((a, b) => {
      const aSystem = SYSTEM_AGENT_IDS.indexOf(a.id);
      const bSystem = SYSTEM_AGENT_IDS.indexOf(b.id);
      if (aSystem !== -1 && bSystem !== -1) {
        return aSystem - bSystem;
      }
      if (aSystem !== -1) {
        return -1;
      }
      if (bSystem !== -1) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <SidebarGroup>
      <Collapsible onOpenChange={(value) => setOpen(value)} open={open}>
        <SidebarGroupLabel>
          <CollapsibleTrigger className="flex flex-1 items-center gap-1">
            <ChevronRight className="h-3 w-3 transition-transform data-[open]:rotate-90" />
            Direct Messages
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarMenu>
            {isLoading && (
              <SidebarMenuItem>
                <SidebarMenuButton disabled>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground">Loading...</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {error && (
              <SidebarMenuItem>
                <SidebarMenuButton disabled>
                  <span className="text-destructive text-sm">
                    Failed to load
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {!(isLoading || error) &&
              agents.map((agent) => {
                const style = getAgent(agent.id);
                const displayName =
                  agent.name.charAt(0).toUpperCase() + agent.name.slice(1);
                const href = `/dm/${agent.id}`;
                const isActive = pathname === href;
                const isOnline = activeAgents.includes(agent.id);
                const unread = unreadCounts[agent.id] || 0;

                return (
                  <SidebarMenuItem key={agent.id}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link className="flex items-center gap-2" href={href}>
                        <div className="relative">
                          <Avatar className="h-6 w-6">
                            {style.avatar && (
                              <AvatarImage
                                alt={displayName}
                                src={style.avatar}
                              />
                            )}
                            <AvatarFallback className={style.bgColor}>
                              {displayName[0]}
                            </AvatarFallback>
                          </Avatar>
                          {isOnline && (
                            <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-green-500" />
                          )}
                        </div>
                        <span className="flex-1">{displayName}</span>
                        {unread > 0 && (
                          <Badge
                            className="h-5 px-1.5 text-xs"
                            variant="destructive"
                          >
                            {unread}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}
